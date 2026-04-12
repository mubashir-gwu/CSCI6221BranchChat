import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { validateTreeIntegrity } from "@/lib/tree";
import { getAvailableProviders, isProviderAvailable } from "@/lib/providers/availability";
import { Conversation } from "@/models/Conversation";
import { Node } from "@/models/Node";
import { MODELS } from "@/constants/models";
import { logger } from "@/lib/logger";
import type { ExportedTree } from "@/types/export";

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const route = "/api/import";
  const start = Date.now();

  logger.info("Route entered", { context: { route, method: "POST", requestId } });

  const session = await auth();
  if (!session?.user?.id) {
    logger.warn("Unauthorized request", { context: { route, method: "POST", requestId } });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const jsonData: ExportedTree = body.jsonData;

    if (!jsonData || typeof jsonData !== "object") {
      return NextResponse.json(
        { error: "Missing jsonData field" },
        { status: 400 }
      );
    }

    if (jsonData.version !== 1) {
      return NextResponse.json(
        { error: "Unsupported export version" },
        { status: 400 }
      );
    }

    if (!Array.isArray(jsonData.nodes) || jsonData.nodes.length === 0) {
      return NextResponse.json(
        { error: "Export must contain at least one node" },
        { status: 400 }
      );
    }

    // Validate tree integrity
    try {
      validateTreeIntegrity(jsonData.nodes);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Invalid tree structure" },
        { status: 400 }
      );
    }

    await connectDB();

    // Generate new ObjectIds and build old→new mapping
    const idMap = new Map<string, Types.ObjectId>();
    for (const node of jsonData.nodes) {
      idMap.set(node.id, new Types.ObjectId());
    }

    // Find the root node
    const rootNode = jsonData.nodes.find((n) => n.parentId === null)!;
    const newRootId = idMap.get(rootNode.id)!;

    // Determine default provider — fall back if unavailable
    let defaultProvider = "openai";
    let defaultModel = "gpt-4o";

    if (!isProviderAvailable(defaultProvider)) {
      const available = getAvailableProviders();
      if (available.length > 0) {
        defaultProvider = available[0];
        const providerModels = MODELS[defaultProvider as keyof typeof MODELS];
        defaultModel = providerModels?.[0]?.id ?? defaultModel;
      }
    }

    // Create new conversation
    const conversation = await Conversation.create({
      userId: session.user.id,
      title: jsonData.title || "Imported Conversation",
      defaultProvider,
      defaultModel,
      rootNodeId: newRootId,
    });

    // Remap and insert all nodes
    const remappedNodes = jsonData.nodes.map((node) => ({
      _id: idMap.get(node.id)!,
      conversationId: conversation._id,
      parentId: node.parentId ? idMap.get(node.parentId)! : null,
      role: node.role,
      content: node.content,
      provider: node.provider,
      model: node.model,
      ...(node.thinkingContent ? { thinkingContent: node.thinkingContent } : {}),
      ...(node.citations?.length ? { citations: node.citations.filter((c: any) => c?.url && c?.title) } : {}),
      ...(node.attachments?.length ? { attachments: node.attachments } : {}),
      createdAt: node.createdAt ? new Date(node.createdAt) : new Date(),
    }));

    await Node.insertMany(remappedNodes);

    logger.info("Route completed", { context: { route, method: "POST", userId: session.user.id, requestId }, status: 201, nodeCount: remappedNodes.length, defaultProvider, durationMs: Date.now() - start });
    return NextResponse.json(
      {
        conversationId: conversation._id.toString(),
        title: conversation.title,
        nodeCount: remappedNodes.length,
      },
      { status: 201 }
    );
  } catch (error: any) {
    logger.error("Route error", { context: { route, method: "POST", userId: session.user.id, requestId }, error: error?.message, stack: error?.stack });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
