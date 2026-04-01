import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { ApiKey } from "@/models/ApiKey";
import { encrypt } from "@/lib/encryption";

const ALLOWED_PROVIDERS = ["openai", "anthropic", "gemini"];

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { provider } = await params;

  if (!ALLOWED_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { apiKey } = body;
    if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
      return NextResponse.json({ error: "API key is required" }, { status: 400 });
    }

    const { encryptedKey, iv, authTag } = encrypt(apiKey.trim());

    await connectDB();

    await ApiKey.findOneAndUpdate(
      { userId: session.user.id, provider },
      { encryptedKey, iv, authTag },
      { upsert: true, new: true }
    );

    return NextResponse.json({ message: "API key saved" });
  } catch (error) {
    if (error instanceof Error && error.name === "CastError") {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { provider } = await params;

  if (!ALLOWED_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  try {
    await connectDB();

    await ApiKey.deleteOne({ userId: session.user.id, provider });

    return NextResponse.json({ message: "API key deleted" });
  } catch (error) {
    if (error instanceof Error && error.name === "CastError") {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
