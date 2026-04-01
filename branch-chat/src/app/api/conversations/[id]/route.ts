import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { Node } from "@/models/Node";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
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

  return NextResponse.json({
    id: conversation._id.toString(),
    title: conversation.title,
    updatedAt: conversation.updatedAt.toISOString(),
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

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

  return NextResponse.json({ deleted: true });
}
