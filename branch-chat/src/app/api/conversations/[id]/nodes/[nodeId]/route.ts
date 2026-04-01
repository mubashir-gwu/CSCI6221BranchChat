import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { Node } from "@/models/Node";
import type { ChildrenMap } from "@/types/tree";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, nodeId } = await params;

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

    const targetNode = allNodes.find((n) => n._id.toString() === nodeId);
    if (!targetNode) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }

    // Build children map
    const childrenMap: ChildrenMap = new Map();
    for (const n of allNodes) {
      const nId = n._id.toString();
      if (!childrenMap.has(nId)) childrenMap.set(nId, []);
      const pId = n.parentId?.toString() ?? null;
      if (pId !== null) {
        if (!childrenMap.has(pId)) childrenMap.set(pId, []);
        childrenMap.get(pId)!.push(nId);
      }
    }

    // Find all descendants via BFS
    const toDelete = [nodeId];
    const queue = [nodeId];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = childrenMap.get(currentId) ?? [];
      for (const childId of children) {
        toDelete.push(childId);
        queue.push(childId);
      }
    }

    const result = await Node.deleteMany({ _id: { $in: toDelete } });

    const newActiveNodeId = targetNode.parentId?.toString() ?? null;

    return NextResponse.json({
      deletedCount: result.deletedCount,
      newActiveNodeId,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "CastError") {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
