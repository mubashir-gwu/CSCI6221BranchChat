import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { Node } from "@/models/Node";
import { logger } from "@/lib/logger";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  const route = "/api/conversations/[id]/nodes";
  const start = Date.now();

  logger.info("Route entered", { context: { route, method: "GET", requestId } });

  const session = await auth();
  if (!session?.user?.id) {
    logger.warn("Unauthorized request", { context: { route, method: "GET", requestId } });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await connectDB();

    const conversation = await Conversation.findOne({
      _id: id,
      userId: session.user.id,
    });

    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const nodes = await Node.find({ conversationId: id }).lean();

    logger.info("Route completed", { context: { route, method: "GET", userId: session.user.id, requestId, conversationId: id }, status: 200, nodeCount: nodes.length, durationMs: Date.now() - start });
    return NextResponse.json({
      nodes: nodes.map((n: any) => ({
        id: n._id.toString(),
        parentId: n.parentId?.toString() ?? null,
        role: n.role,
        content: n.content,
        provider: n.provider ?? null,
        model: n.model ?? null,
        ...(n.thinkingContent ? { thinkingContent: n.thinkingContent } : {}),
        ...(n.attachments?.length ? { attachments: n.attachments } : {}),
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    logger.error("Route error", { context: { route, method: "GET", userId: session.user.id, requestId, conversationId: id }, error: error?.message, stack: error?.stack });
    if (error instanceof Error && error.name === "CastError") {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
