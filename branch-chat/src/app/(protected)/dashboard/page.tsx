"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useConversation } from "@/hooks/useConversation";
import { MODELS } from "@/constants/models";
import { toast } from "sonner";
import { fetchOrThrowOnBackendDown } from "@/lib/fetchClient";

export default function DashboardPage() {
  const { state, dispatch } = useConversation();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  async function handleCreateConversation() {
    setCreating(true);
    try {
      const res = await fetchOrThrowOnBackendDown("/api/conversations", {
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
    } catch (err) {
      if ((err as Error)?.name === "BackendUnavailableError") {
        setFatalError(err as Error);
        return;
      }
      toast.error("Failed to create conversation");
    } finally {
      setCreating(false);
    }
  }

  if (fatalError) throw fatalError;

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md space-y-6 text-center">
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
