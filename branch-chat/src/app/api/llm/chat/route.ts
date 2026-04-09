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
import type { LLMMessage, StreamChunk } from "@/lib/providers/types";
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
      role: "system",
      content:
        "Generate a concise title (max 6 words) for a conversation that starts with this message. Reply with only the title, no quotes or punctuation.",
    },
    { role: "user", content: firstUserMessage },
  ];
  const response = await llmProvider.sendMessage(titleMessages, model);
  const title = response.content.trim().slice(0, 200);

  await Conversation.findByIdAndUpdate(conversationId, { title });

  // Track token usage for the title generation call
  if (response.inputTokens || response.outputTokens) {
    await TokenUsage.findOneAndUpdate(
      { userId, provider },
      {
        $inc: {
          inputTokens: response.inputTokens || 0,
          outputTokens: response.outputTokens || 0,
          callCount: 1,
        },
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
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const route = "/api/llm/chat";
  const start = Date.now();

  logger.info("Route entered", { context: { route, method: "POST", requestId } });

  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { conversationId, parentNodeId, content, provider, model } = body;

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

    const messages = buildContext(parentNodeId, content.trim(), nodesMap, modelDef.contextWindow);

    // Insert user node before streaming starts
    const userNode = await Node.create({
      conversationId,
      parentId: parentNodeId,
      role: "user",
      content: content.trim(),
      provider: null,
      model: null,
    });

    // If first message, set rootNodeId
    if (parentNodeId === null) {
      await Conversation.findByIdAndUpdate(conversationId, { rootNodeId: userNode._id });
    }

    // Capture userId before stream (session already validated above)
    const userId = session!.user!.id;

    // Start streaming
    const llmProvider = getProvider(provider);
    logger.info("LLM stream started", { context: { requestId, conversationId, userId: userId }, provider, model, messageCount: messages.length });
    logger.debug("LLM messages", { context: { requestId, conversationId }, messages });

    const encoder = new TextEncoder();
    let accumulated = '';
    let hasReceivedContent = false;

    const stream = new ReadableStream({
      async start(controller) {
        // Initial padding comment to flush browser buffers
        controller.enqueue(encoder.encode(':\n\n'));

        try {
          const generator = llmProvider.streamMessage(messages, model);

          for await (const chunk of generator) {
            if (request.signal?.aborted) {
              break;
            }

            if (chunk.type === 'token') {
              hasReceivedContent = true;
              accumulated += chunk.content;
              controller.enqueue(
                encoder.encode(encodeSSEEvent('token', { content: chunk.content }))
              );
            } else if (chunk.type === 'done') {
              // Save assistant node
              const assistantNode = await Node.create({
                conversationId,
                parentId: userNode._id,
                role: "assistant",
                content: chunk.content,
                provider,
                model,
              });

              // Track token usage
              try {
                await TokenUsage.findOneAndUpdate(
                  { userId: userId, provider },
                  {
                    $inc: {
                      inputTokens: chunk.inputTokens ?? 0,
                      outputTokens: chunk.outputTokens ?? 0,
                      callCount: 1,
                    },
                  },
                  { upsert: true }
                );
              } catch {
                // Token tracking failure should not break the stream
              }

              logger.info("LLM stream completed", { context: { requestId, conversationId, userId: userId }, provider, model, inputTokens: chunk.inputTokens, outputTokens: chunk.outputTokens, durationMs: Date.now() - start });

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

              // Auto-title (fire-and-forget, non-streaming)
              if (conversation.title === "New Conversation") {
                generateTitle(
                  conversationId,
                  content.trim(),
                  provider,
                  model,
                  userId
                ).catch((titleErr: any) => {
                  logger.error("Auto-title: failed", { context: { conversationId }, error: titleErr?.message });
                });
              }
            } else if (chunk.type === 'error') {
              // Handle error chunk from provider
              if (hasReceivedContent) {
                // Partial content received — save partial assistant node
                const partialNode = await Node.create({
                  conversationId,
                  parentId: userNode._id,
                  role: "assistant",
                  content: accumulated,
                  provider,
                  model,
                });
                controller.enqueue(
                  encoder.encode(encodeSSEEvent('error', {
                    message: chunk.message,
                    partial: true,
                    userNode: serializeNode(userNode),
                    assistantNode: serializeNode(partialNode),
                  }))
                );
              } else {
                // No content received — clean up orphaned user node
                await Node.deleteOne({ _id: userNode._id });
                if (parentNodeId === null) {
                  await Conversation.findByIdAndUpdate(conversationId, { rootNodeId: null });
                }
                controller.enqueue(
                  encoder.encode(encodeSSEEvent('error', {
                    message: chunk.message,
                    partial: false,
                  }))
                );
              }
            }
          }
        } catch (err: any) {
          logger.error("LLM stream error", { context: { route, method: "POST", userId: userId, requestId, conversationId }, provider, model, error: err?.message, stack: err?.stack });

          if (hasReceivedContent) {
            // Save partial content
            const partialNode = await Node.create({
              conversationId,
              parentId: userNode._id,
              role: "assistant",
              content: accumulated,
              provider,
              model,
            });
            controller.enqueue(
              encoder.encode(encodeSSEEvent('error', {
                message: err?.message ?? 'Stream error',
                partial: true,
                userNode: serializeNode(userNode),
                assistantNode: serializeNode(partialNode),
              }))
            );
          } else {
            // Clean up orphaned user node
            await Node.deleteOne({ _id: userNode._id });
            if (parentNodeId === null) {
              await Conversation.findByIdAndUpdate(conversationId, { rootNodeId: null });
            }
            controller.enqueue(
              encoder.encode(encodeSSEEvent('error', {
                message: err?.message ?? 'Stream error',
                partial: false,
              }))
            );
          }
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
