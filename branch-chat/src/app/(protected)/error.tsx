"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ServerCrash, Loader2 } from "lucide-react";

const POLL_INTERVAL_MS = 3000;

export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isBackendDown = error?.name === "BackendUnavailableError";
  const [checking, setChecking] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    console.error("Protected route error:", error);
  }, [error]);

  useEffect(() => {
    if (!isBackendDown) return;
    cancelledRef.current = false;

    async function poll() {
      while (!cancelledRef.current) {
        try {
          const res = await fetch("/api/health", { cache: "no-store" });
          if (res.ok && !cancelledRef.current) {
            reset();
            return;
          }
        } catch {
          // network error — keep polling
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    }

    poll();
    return () => {
      cancelledRef.current = true;
    };
  }, [isBackendDown, reset]);

  async function handleManualRetry() {
    setChecking(true);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      if (res.ok) {
        reset();
        return;
      }
    } catch {
      // ignore
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <ServerCrash className="h-10 w-10 text-destructive mb-2" />
          <CardTitle>
            {isBackendDown
              ? "Backend services are unavailable"
              : "Something went wrong"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            {isBackendDown
              ? "We can't reach the database right now. We'll retry automatically as soon as it's back."
              : "An unexpected error occurred while loading this page."}
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={handleManualRetry} disabled={checking}>
              {checking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                "Retry now"
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
