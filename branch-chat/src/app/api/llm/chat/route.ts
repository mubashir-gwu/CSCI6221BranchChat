import crypto from "crypto";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { buildContext } from "@/lib/contextBuilder";
import { getProvider } from "@/lib/providers";
import { isProviderAvailable } from "@/lib/providers/availability";
import { encodeSSEEvent } from "@/lib/providers/streamHelpers";
import { Conversation } from "@/models/Conversation";
import { Node } from "@/models/Node";
import { TokenUsage } from "@/models/TokenUsage";
import { PROVIDERS } from "@/constants/providers";
import { MODELS } from "@/constants/models";
import { logger } from "@/lib/logger";
import type { LLMMessage, LLMRequestOptions, StreamChunk } from "@/lib/providers/types";
import type { NodeResponse } from "@/types/api";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function generateTitle(
  conversationId: string,
  firstUserMessage: string,
  provider: string,
  model: string,
  userId: string
): Promise<string | null> {
  logger.info("Auto-title: generating", { context: { conversationId } });
  const llmProvider = getProvider(provider);
  const titleMessages: LLMMessage[] = [
    {
      role: "user",
      content: `Your task: generate a concise title (max 6 words) for a chat conversation based on its first message, quoted below. Do NOT respond to the message — just title it. The message may mention attached files, images, or screenshots that you cannot see; ignore those references and title the underlying topic. Reply with ONLY the title, no quotes or punctuation.

<message>
${firstUserMessage}
</message>`,
    },
  ];
  const response = await llmProvider.sendMessage(titleMessages, model, { thinkingEnabled: false, webSearchEnabled: false });
  const title = response.content.trim().slice(0, 200);

  await Conversation.findByIdAndUpdate(conversationId, { title });

  // Track token usage for the title generation call
  if (response.inputTokens || response.outputTokens) {
    await TokenUsage.findOneAndUpdate(
      { userId, model },
      {
        $inc: {
          inputTokens: response.inputTokens || 0,
          outputTokens: response.outputTokens || 0,
          callCount: 1,
        },
        $set: { provider },
      },
      { upsert: true }
    );
  }

  logger.info("Auto-title: success", { context: { conversationId }, title });
  return title;
}

function serializeNode(doc: any): NodeResponse {
  return {
    id: doc._id.toString(),
    parentId: doc.parentId?.toString() ?? null,
    role: doc.role,
    content: doc.content,
    provider: doc.provider ?? null,
    model: doc.model ?? null,
    ...(doc.thinkingContent ? { thinkingContent: doc.thinkingContent } : {}),
    ...(doc.citations?.length ? { citations: doc.citations } : {}),
    ...(doc.attachments?.length ? { attachments: doc.attachments } : {}),
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const route = "/api/llm/chat";
  const start = Date.now();

  logger.info("Route entered", { context: { route, method: "POST", requestId } });

  try {
    // Body size check — reject >20MB payloads
    const contentLength = parseInt(request.headers.get('content-length') || '0');
    const MAX_BODY_SIZE = 20 * 1024 * 1024; // 20MB
    if (contentLength > MAX_BODY_SIZE) {
      return Response.json({ error: 'Request body too large' }, { status: 413 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { conversationId, parentNodeId, content, provider, model, attachments, thinkingEnabled, webSearchEnabled } = body;

    // Auth check
    const session = await auth();
    if (!session?.user?.id) {
      logger.warn("Unauthorized request", { context: { route, method: "POST", requestId } });
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate required fields
    if (!conversationId || content === undefined || content === null || !provider || !model) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (typeof content !== "string" || !content.trim()) {
      return Response.json({ error: "Content must be a non-empty string" }, { status: 400 });
    }

    // Validate provider
    if (!(provider in PROVIDERS)) {
      return Response.json({ error: `Invalid provider: ${provider}` }, { status: 400 });
    }

    // Mock only in development
    if (provider === "mock" && process.env.NODE_ENV !== "development") {
      return Response.json({ error: "Mock provider is only available in development" }, { status: 400 });
    }

    // Check provider availability
    if (!isProviderAvailable(provider)) {
      return Response.json(
        { error: `Provider ${provider} is not configured.` },
        { status: 422 }
      );
    }

    // Validate model
    const providerModels = MODELS[provider as keyof typeof MODELS];
    const modelDef = providerModels?.find((m) => m.id === model);
    if (!modelDef) {
      return Response.json({ error: `Invalid model: ${model}` }, { status: 400 });
    }

    // Validate attachments
    const ALLOWED_MIME_TYPES = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'text/plain', 'text/markdown', 'text/csv',
    ];

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      if (attachments.length > 5) {
        return Response.json({ error: "Maximum 5 files per message" }, { status: 400 });
      }

      let totalSize = 0;
      for (const att of attachments) {
        if (!att.filename || !att.mimeType || !att.data || typeof att.size !== 'number') {
          return Response.json({ error: "Invalid attachment format" }, { status: 400 });
        }
        if (att.size > 5 * 1024 * 1024) {
          return Response.json({ error: `File ${att.filename} exceeds 5MB limit` }, { status: 400 });
        }
        if (!ALLOWED_MIME_TYPES.includes(att.mimeType)) {
          return Response.json({ error: `File type ${att.mimeType} is not allowed` }, { status: 400 });
        }
        totalSize += att.size;
      }

      if (totalSize > 10 * 1024 * 1024) {
        return Response.json({ error: "Total attachment size exceeds 10MB limit" }, { status: 400 });
      }
    }

    await connectDB();

    // Verify conversation ownership
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }
    if (conversation.userId.toString() !== session!.user!.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Load all nodes and build context
    const rawNodes = await Node.find({ conversationId }).lean() as any[];
    const nodesMap = new Map(
      rawNodes.map((n) => [
        n._id.toString(),
        {
          id: n._id.toString(),
          parentId: n.parentId?.toString() ?? null,
          role: n.role as "user" | "assistant" | "system",
          content: n.content as string,
          provider: n.provider ?? null,
          model: n.model ?? null,
          attachments: n.attachments ?? [],
          createdAt: n.createdAt.toISOString(),
        },
      ])
    );

    // Validate parentNodeId exists in this conversation
    if (parentNodeId !== null && !nodesMap.has(parentNodeId)) {
      return Response.json(
        { error: "Parent node not found in this conversation" },
        { status: 400 }
      );
    }

    // Map request attachments to LLMAttachment format for context builder
    const llmAttachments = attachments?.length
      ? attachments.map((a: { filename: string; mimeType: string; data: string; size: number }) => ({
          filename: a.filename,
          mimeType: a.mimeType,
          data: a.data,
          size: a.size,
        }))
      : undefined;

    const messages = buildContext(parentNodeId, content.trim(), nodesMap, modelDef.contextWindow, llmAttachments);

    // Capture userId before stream (session already validated above)
    const userId = session!.user!.id;

    // Build LLM request options
    const llmOptions: LLMRequestOptions = {
      thinkingEnabled: thinkingEnabled && modelDef.supportsThinking,
      thinkingLevel: modelDef.maxThinkingLevel ?? undefined,
      webSearchEnabled: webSearchEnabled ?? false,
    };

    // Start streaming — nodes are saved to DB only on successful completion
    const llmProvider = getProvider(provider);
    logger.info("LLM stream started", { context: { requestId, conversationId, userId }, provider, model, messageCount: messages.length, thinkingEnabled: llmOptions.thinkingEnabled });
    logger.debug("LLM messages", { context: { requestId, conversationId }, messages });

    const encoder = new TextEncoder();
    let accumulated = '';
    let accumulatedThinking = '';

    const stream = new ReadableStream({
      async start(controller) {
        // Initial padding comment to flush browser buffers
        controller.enqueue(encoder.encode(':\n\n'));

        try {
          const generator = llmProvider.streamMessage(messages, model, llmOptions);

          for await (const chunk of generator) {
            if (request.signal?.aborted) {
              logger.info("Stream aborted by client", { context: { requestId, conversationId } });
              break;
            }

            if (chunk.type === 'token') {
              accumulated += chunk.content;
              controller.enqueue(
                encoder.encode(encodeSSEEvent('token', { content: chunk.content }))
              );
            } else if (chunk.type === 'thinking') {
              accumulatedThinking += chunk.content;
              controller.enqueue(
                encoder.encode(encodeSSEEvent('thinking', { content: chunk.content }))
              );
            } else if (chunk.type === 'done') {
              // Save both nodes to DB only on successful completion
              const userNode = await Node.create({
                conversationId,
                parentId: parentNodeId,
                role: "user",
                content: content.trim(),
                provider: null,
                model: null,
                ...(attachments?.length ? { attachments } : {}),
              });

              const assistantNode = await Node.create({
                conversationId,
                parentId: userNode._id,
                role: "assistant",
                content: chunk.content,
                provider,
                model,
                thinkingContent: chunk.thinkingContent || null,
                ...(chunk.citations?.length ? { citations: chunk.citations } : {}),
              });

              // Set rootNodeId if first message
              if (parentNodeId === null) {
                await Conversation.findByIdAndUpdate(conversationId, { rootNodeId: userNode._id });
              }

              // Track token usage
              try {
                await TokenUsage.findOneAndUpdate(
                  { userId, model },
                  {
                    $inc: {
                      inputTokens: chunk.inputTokens ?? 0,
                      outputTokens: chunk.outputTokens ?? 0,
                      callCount: 1,
                      webSearchRequests: chunk.webSearchRequestCount ?? 0,
                    },
                    $set: { provider },
                  },
                  { upsert: true }
                );
              } catch {
                // Token tracking failure should not break the stream
              }

              logger.info("LLM stream completed", { context: { requestId, conversationId, userId }, provider, model, inputTokens: chunk.inputTokens, outputTokens: chunk.outputTokens, durationMs: Date.now() - start });

              // Send done event with node data
              controller.enqueue(
                encoder.encode(encodeSSEEvent('done', {
                  userNode: serializeNode(userNode),
                  assistantNode: serializeNode(assistantNode),
                  tokenUsage: {
                    inputTokens: chunk.inputTokens,
                    outputTokens: chunk.outputTokens,
                  },
                }))
              );

              // Auto-title: await and send via SSE so client gets it deterministically
              if (conversation.title === "New Conversation") {
                try {
                  const generatedTitle = await generateTitle(
                    conversationId,
                    content.trim(),
                    provider,
                    model,
                    userId
                  );
                  if (generatedTitle) {
                    controller.enqueue(
                      encoder.encode(encodeSSEEvent('title', { title: generatedTitle }))
                    );
                  }
                } catch (titleErr: any) {
                  logger.error("Auto-title: failed", { context: { conversationId }, error: titleErr?.message });
                }
              }
            } else if (chunk.type === 'error') {
              // Provider error — nothing saved to DB, just report
              controller.enqueue(
                encoder.encode(encodeSSEEvent('error', {
                  message: chunk.message,
                  partial: accumulated.length > 0,
                }))
              );
            }
          }
        } catch (err: any) {
          logger.error("LLM stream error", { context: { route, method: "POST", userId, requestId, conversationId }, provider, model, error: err?.message, stack: err?.stack });

          // Nothing saved to DB, just report the error
          controller.enqueue(
            encoder.encode(encodeSSEEvent('error', {
              message: err?.message ?? 'Stream error',
              partial: accumulated.length > 0,
            }))
          );
        } finally {
          controller.close();
        }
      },
      cancel() {
        // Client disconnected — abort signal will be picked up by the generator loop
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: any) {
    logger.error("Route error", { context: { route, method: "POST", requestId }, error: error?.message, stack: error?.stack });
    if (error?.name === "CastError") {
      return Response.json({ error: "Invalid ID format" }, { status: 400 });
    }
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
