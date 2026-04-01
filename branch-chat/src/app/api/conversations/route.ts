import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { MODELS } from "@/constants/models";
import { PROVIDERS } from "@/constants/providers";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const conversations = await Conversation.find({ userId: session.user.id })
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({
      conversations: conversations.map((c) => ({
        id: c._id.toString(),
        title: c.title,
        defaultProvider: c.defaultProvider,
        defaultModel: c.defaultModel,
        rootNodeId: c.rootNodeId?.toString() ?? null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "CastError") {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { title, defaultProvider, defaultModel } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0 || title.trim().length > 200) {
      return NextResponse.json(
        { error: "Title must be between 1 and 200 characters" },
        { status: 400 }
      );
    }

    if (!defaultProvider || !(defaultProvider in PROVIDERS)) {
      return NextResponse.json(
        { error: "Invalid provider" },
        { status: 400 }
      );
    }

    const providerModels = MODELS[defaultProvider as keyof typeof MODELS];
    if (!defaultModel || !providerModels?.some((m) => m.id === defaultModel)) {
      return NextResponse.json(
        { error: "Invalid model for the selected provider" },
        { status: 400 }
      );
    }

    await connectDB();

    const conversation = await Conversation.create({
      userId: session.user.id,
      title: title.trim(),
      defaultProvider,
      defaultModel,
    });

    return NextResponse.json(
      {
        id: conversation._id.toString(),
        title: conversation.title,
        defaultProvider: conversation.defaultProvider,
        defaultModel: conversation.defaultModel,
        rootNodeId: null,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.name === "CastError") {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
