import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { ApiKey } from "@/models/ApiKey";
import { maskKey, decrypt } from "@/lib/encryption";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const apiKeys = await ApiKey.find({ userId: session.user.id }).lean();

    const keys = apiKeys.map((k) => {
      try {
        return {
          provider: k.provider,
          maskedKey: maskKey(decrypt(k.encryptedKey, k.iv, k.authTag)),
          updatedAt: k.updatedAt.toISOString(),
        };
      } catch (err) {
        console.error(`Failed to decrypt API key for provider ${k.provider}:`, err);
        return {
          provider: k.provider,
          maskedKey: "[error]",
          updatedAt: k.updatedAt.toISOString(),
        };
      }
    });

    return NextResponse.json({ keys });
  } catch (error) {
    if (error instanceof Error && error.name === "CastError") {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
