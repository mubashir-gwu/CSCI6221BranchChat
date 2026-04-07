import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { buildContext } from "@/lib/contextBuilder";
import { getProvider } from "@/lib/providers";
import { isProviderAvailable } from "@/lib/providers/availability";
import { Conversation } from "@/models/Conversation";
import { Node } from "@/models/Node";
import { TokenUsage } from "@/models/TokenUsage";
import { PROVIDERS } from "@/constants/providers";
import { MODELS } from "@/constants/models";
import type { NodeResponse } from "@/types/api";

export const maxDuration = 60;

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
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { conversationId, parentNodeId, content, provider, model } = body;

    // Auth check — before any validation to prevent information leakage
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate required fields
    if (!conversationId || content === undefined || content === null || !provider || !model) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Content must be a non-empty string" }, { status: 400 });
    }

    // Validate provider
    if (!(provider in PROVIDERS)) {
      return NextResponse.json({ error: `Invalid provider: ${provider}` }, { status: 400 });
    }

    // Mock only in development
    if (provider === "mock" && process.env.NODE_ENV !== "development") {
      return NextResponse.json({ error: "Mock provider is only available in development" }, { status: 400 });
    }

    // Check provider availability (env var key configured)
    if (!isProviderAvailable(provider)) {
      return NextResponse.json(
        { error: `Provider ${provider} is not configured.` },
        { status: 422 }
      );
    }

    // Validate model against provider's model list
    const providerModels = MODELS[provider as keyof typeof MODELS];
    const modelDef = providerModels?.find((m) => m.id === model);
    if (!modelDef) {
      return NextResponse.json({ error: `Invalid model: ${model}` }, { status: 400 });
    }

    await connectDB();

    // Verify conversation ownership
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    if (conversation.userId.toString() !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      return NextResponse.json(
        { error: "Parent node not found in this conversation" },
        { status: 400 }
      );
    }

    const messages = buildContext(parentNodeId, content.trim(), nodesMap, modelDef.contextWindow);

    // Insert user node
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

    // Call LLM provider
    try {
      const llmResponse = await getProvider(provider).sendMessage(messages, model);

      // Insert assistant node
      const assistantNode = await Node.create({
        conversationId,
        parentId: userNode._id,
        role: "assistant",
        content: llmResponse.content,
        provider,
        model,
      });

      // Track token usage (non-blocking)
      try {
        await TokenUsage.findOneAndUpdate(
          { userId: session.user.id, provider },
          {
            $inc: {
              inputTokens: llmResponse.inputTokens ?? 0,
              outputTokens: llmResponse.outputTokens ?? 0,
              callCount: 1,
            },
          },
          { upsert: true }
        );
      } catch {
        // Token tracking failure should not break the chat response
      }

      return NextResponse.json(
        {
          userNode: serializeNode(userNode),
          assistantNode: serializeNode(assistantNode),
        },
        { status: 201 }
      );
    } catch (llmError: any) {
      // Clean up the user node on LLM failure to avoid orphaned branches
      await Node.deleteOne({ _id: userNode._id });
      // If this was the first message, reset rootNodeId
      if (parentNodeId === null) {
        await Conversation.findByIdAndUpdate(conversationId, { rootNodeId: null });
      }

      if (llmError?.status === 429) {
        return NextResponse.json(
          { error: `Rate limited by ${provider}.` },
          { status: 429 }
        );
      }
      if (llmError?.status === 401) {
        return NextResponse.json(
          { error: "Invalid API key" },
          { status: 502 }
        );
      }
      return NextResponse.json(
        { error: `${provider} API error` },
        { status: 502 }
      );
    }
  } catch (error: any) {
    if (error?.name === "CastError") {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
