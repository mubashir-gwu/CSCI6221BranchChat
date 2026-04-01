import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { Node } from "@/models/Node";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
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

    return NextResponse.json({
      nodes: nodes.map((n) => ({
        id: n._id.toString(),
        parentId: n.parentId?.toString() ?? null,
        role: n.role,
        content: n.content,
        provider: n.provider ?? null,
        model: n.model ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "CastError") {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
