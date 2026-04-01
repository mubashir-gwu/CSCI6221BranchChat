import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Stub — NextAuth v5 route protection will be implemented in F-02
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|register|api/auth).*)"],
};
