import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { buildContext } from "@/lib/contextBuilder";
import { getProvider } from "@/lib/providers";
import { Conversation } from "@/models/Conversation";
import { ApiKey } from "@/models/ApiKey";
import { Node } from "@/models/Node";
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

    // Validate model against provider's model list
    const providerModels = MODELS[provider as keyof typeof MODELS];
    const modelDef = providerModels?.find((m) => m.id === model);
    if (!modelDef) {
      return NextResponse.json({ error: `Invalid model: ${model}` }, { status: 400 });
    }

    // Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Decrypt API key (skip for mock provider)
    let apiKey = "";
    if (provider !== "mock") {
      const keyDoc = await ApiKey.findOne({ userId: session.user.id, provider }).lean() as any;
      if (!keyDoc) {
        return NextResponse.json(
          { error: `No API key found for ${provider}.` },
          { status: 422 }
        );
      }
      apiKey = decrypt(keyDoc.encryptedKey, keyDoc.iv, keyDoc.authTag);
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
      const llmResponse = await getProvider(provider).sendMessage(messages, model, apiKey);

      // Insert assistant node
      const assistantNode = await Node.create({
        conversationId,
        parentId: userNode._id,
        role: "assistant",
        content: llmResponse.content,
        provider,
        model,
      });

      return NextResponse.json(
        {
          userNode: serializeNode(userNode),
          assistantNode: serializeNode(assistantNode),
        },
        { status: 201 }
      );
    } catch (llmError: any) {
      // User node is kept for retry (FR-035)
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
