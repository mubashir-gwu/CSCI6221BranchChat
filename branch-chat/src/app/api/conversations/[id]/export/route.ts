import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { connectDB, isBackendUnavailableError, BACKEND_UNAVAILABLE_RESPONSE } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { Node } from "@/models/Node";
import { logger } from "@/lib/logger";
import type { ExportedTree } from "@/types/export";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  const route = "/api/conversations/[id]/export";
  const start = Date.now();

  logger.info("Route entered", { context: { route, method: "GET", requestId } });

  const session = await auth();
  if (!session?.user?.id) {
    logger.warn("Unauthorized request", { context: { route, method: "GET", requestId } });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const fromNodeId = _request.nextUrl.searchParams.get("fromNodeId");

  try {
    await connectDB();

    const conversation = await Conversation.findOne({
      _id: id,
      userId: session.user.id,
    });

    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const allNodes = await Node.find({ conversationId: id }).lean();

    let exportNodes = allNodes;
    if (fromNodeId) {
      const byId = new Map<string, (typeof allNodes)[number]>();
      for (const n of allNodes) byId.set(n._id.toString(), n);
      if (!byId.has(fromNodeId)) {
        return NextResponse.json({ error: "Node not found" }, { status: 404 });
      }
      const pathIds = new Set<string>();
      let cursorId: string | null = fromNodeId;
      while (cursorId) {
        if (pathIds.has(cursorId)) break;
        pathIds.add(cursorId);
        const n = byId.get(cursorId);
        cursorId = n?.parentId ? n.parentId.toString() : null;
      }
      exportNodes = allNodes.filter((n) => pathIds.has(n._id.toString()));
    }

    // Build childrenMap restricted to exported nodes
    const includedIds = new Set(exportNodes.map((n) => n._id.toString()));
    const childrenMap = new Map<string, string[]>();
    for (const node of exportNodes) {
      const nodeId = node._id.toString();
      if (!childrenMap.has(nodeId)) childrenMap.set(nodeId, []);
      if (node.parentId !== null) {
        const parentId = node.parentId.toString();
        if (!includedIds.has(parentId)) continue;
        if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
        childrenMap.get(parentId)!.push(nodeId);
      }
    }

    const exportedTree: ExportedTree = {
      version: 1,
      exportedAt: new Date().toISOString(),
      title: conversation.title,
      nodes: exportNodes.map((n: any) => ({
        id: n._id.toString(),
        parentId: n.parentId?.toString() || null,
        childrenIds: childrenMap.get(n._id.toString()) || [],
        role: n.role as "user" | "assistant" | "system",
        content: n.content,
        provider: n.provider ?? null,
        model: n.model ?? null,
        ...(n.thinkingContent ? { thinkingContent: n.thinkingContent } : {}),
        ...(n.citations?.length ? { citations: n.citations } : {}),
        ...(n.attachments?.length ? { attachments: n.attachments } : {}),
        createdAt: n.createdAt.toISOString(),
      })),
    };

    const baseName = conversation.title.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-");
    const filename = fromNodeId ? `${baseName}-branch.json` : `${baseName}.json`;

    logger.info("Route completed", { context: { route, method: "GET", userId: session.user.id, requestId, conversationId: id }, status: 200, nodeCount: exportNodes.length, durationMs: Date.now() - start });
    return new NextResponse(JSON.stringify(exportedTree, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    logger.error("Route error", { context: { route, method: "GET", userId: session.user.id, requestId, conversationId: id }, error: error?.message, stack: error?.stack });
    if (isBackendUnavailableError(error)) {
      return NextResponse.json(BACKEND_UNAVAILABLE_RESPONSE.body, { status: BACKEND_UNAVAILABLE_RESPONSE.status });
    }
    if (error instanceof Error && error.name === "CastError") {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
