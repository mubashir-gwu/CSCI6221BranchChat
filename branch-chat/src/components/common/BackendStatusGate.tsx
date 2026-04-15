"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ServerCrash, Loader2 } from "lucide-react";

const POLL_INTERVAL_MS = 3000;

type Status = "checking" | "ok" | "down";

export default function BackendStatusGate({
  children,
  onRecover,
}: {
  children?: React.ReactNode;
  onRecover?: () => void;
}) {
  const [status, setStatus] = useState<Status>(onRecover ? "down" : "checking");
  const [manualChecking, setManualChecking] = useState(false);
  const cancelledRef = useRef(false);

  async function probe(): Promise<boolean> {
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      return res.ok;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    cancelledRef.current = false;

    async function run() {
      while (!cancelledRef.current) {
        const ok = await probe();
        if (cancelledRef.current) return;
        if (ok) {
          if (onRecover) {
            onRecover();
            return;
          }
          setStatus("ok");
          return;
        }
        setStatus("down");
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    }

    run();
    return () => {
      cancelledRef.current = true;
    };
  }, [onRecover]);

  async function handleManualRetry() {
    setManualChecking(true);
    try {
      const ok = await probe();
      if (cancelledRef.current) return;
      if (ok) {
        if (onRecover) onRecover();
        else setStatus("ok");
      }
    } finally {
      if (!cancelledRef.current) setManualChecking(false);
    }
  }

  if (status === "ok") return <>{children}</>;

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <ServerCrash className="h-10 w-10 text-destructive mb-2" />
          <CardTitle>Backend services are unavailable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            We can't reach the database right now. We'll retry automatically as soon as it's back.
          </p>
          <Button onClick={handleManualRetry} disabled={manualChecking} className="w-full">
            {manualChecking ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              "Retry now"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
