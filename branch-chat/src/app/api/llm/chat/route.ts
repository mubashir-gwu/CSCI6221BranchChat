import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
