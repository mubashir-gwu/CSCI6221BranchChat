import { NextResponse } from "next/server";

// Stub — will be replaced with NextAuth v5 config in F-02
export async function GET() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}

export async function POST() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}

export async function auth() {
  return null;
}
