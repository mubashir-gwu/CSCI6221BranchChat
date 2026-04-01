"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useConversation } from "@/hooks/useConversation";
import { MODELS } from "@/constants/models";
import { toast } from "sonner";

export default function DashboardPage() {
  const { state, dispatch } = useConversation();
  const router = useRouter();
  const [hasKeys, setHasKeys] = useState<boolean | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function checkKeys() {
      try {
        const res = await fetch("/api/settings/api-keys");
        if (!res.ok) return;
        const data = await res.json();
        setHasKeys(data.keys.length > 0);
      } catch {
        // Ignore — banner won't show
      }
    }
    checkKeys();
  }, []);

  async function handleCreateConversation() {
    setCreating(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Conversation",
          defaultProvider: "openai",
          defaultModel: MODELS.openai[0].id,
        }),
      });

      if (!res.ok) throw new Error("Failed to create");

      const data = await res.json();
      dispatch({ type: "ADD_CONVERSATION", payload: data });
      router.push(`/chat/${data.id}`);
    } catch {
      toast.error("Failed to create conversation");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md space-y-6 text-center">
        {hasKeys === false && (
          <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="pt-6">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Add your API keys in{" "}
                <button
                  className="underline font-medium"
                  onClick={() => router.push("/settings")}
                >
                  Settings
                </button>{" "}
                to get started with real LLM providers.
              </p>
            </CardContent>
          </Card>
        )}

        {state.conversations.length === 0 ? (
          <>
            <h2 className="text-2xl font-semibold">Welcome to BranchChat</h2>
            <p className="text-muted-foreground">
              No conversations yet. Create one to get started!
            </p>
            <Button onClick={handleCreateConversation} disabled={creating}>
              {creating ? "Creating..." : "New Conversation"}
            </Button>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-semibold">Welcome back</h2>
            <p className="text-muted-foreground">
              Select a conversation from the sidebar or create a new one.
            </p>
            <Button onClick={handleCreateConversation} disabled={creating}>
              {creating ? "Creating..." : "New Conversation"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
