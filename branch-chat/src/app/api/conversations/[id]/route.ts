import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { connectDB, isBackendUnavailableError, BACKEND_UNAVAILABLE_RESPONSE } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { Node } from "@/models/Node";
import { logger } from "@/lib/logger";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  const route = "/api/conversations/[id]";
  const start = Date.now();

  logger.info("Route entered", { context: { route, method: "PATCH", requestId } });

  const session = await auth();
  if (!session?.user?.id) {
    logger.warn("Unauthorized request", { context: { route, method: "PATCH", requestId } });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { title } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0 || title.trim().length > 200) {
      return NextResponse.json(
        { error: "Title must be between 1 and 200 characters" },
        { status: 400 }
      );
    }

    await connectDB();

    const conversation = await Conversation.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      { title: title.trim() },
      { new: true }
    );

    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    logger.info("Route completed", { context: { route, method: "PATCH", userId: session.user.id, requestId, conversationId: id }, status: 200, durationMs: Date.now() - start });
    return NextResponse.json({
      id: conversation._id.toString(),
      title: conversation.title,
      updatedAt: conversation.updatedAt.toISOString(),
    });
  } catch (error: any) {
    logger.error("Route error", { context: { route, method: "PATCH", userId: session.user.id, requestId, conversationId: id }, error: error?.message, stack: error?.stack });
    if (isBackendUnavailableError(error)) {
      return NextResponse.json(BACKEND_UNAVAILABLE_RESPONSE.body, { status: BACKEND_UNAVAILABLE_RESPONSE.status });
    }
    if (error instanceof Error && error.name === "CastError") {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  const route = "/api/conversations/[id]";
  const start = Date.now();

  logger.info("Route entered", { context: { route, method: "DELETE", requestId } });

  const session = await auth();
  if (!session?.user?.id) {
    logger.warn("Unauthorized request", { context: { route, method: "DELETE", requestId } });
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

    await Node.deleteMany({ conversationId: id });
    await Conversation.deleteOne({ _id: id });

    logger.info("Route completed", { context: { route, method: "DELETE", userId: session.user.id, requestId, conversationId: id }, status: 200, durationMs: Date.now() - start });
    return NextResponse.json({ deleted: true });
  } catch (error: any) {
    logger.error("Route error", { context: { route, method: "DELETE", userId: session.user.id, requestId, conversationId: id }, error: error?.message, stack: error?.stack });
    if (isBackendUnavailableError(error)) {
      return NextResponse.json(BACKEND_UNAVAILABLE_RESPONSE.body, { status: BACKEND_UNAVAILABLE_RESPONSE.status });
    }
    if (error instanceof Error && error.name === "CastError") {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
