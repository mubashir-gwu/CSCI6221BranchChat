"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConversation } from "@/hooks/useConversation";
import ConversationItem from "@/components/sidebar/ConversationItem";
import { MODELS } from "@/constants/models";
import { toast } from "sonner";

export default function ConversationList() {
  const { state, dispatch } = useConversation();
  const router = useRouter();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImport(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      let jsonData;
      try {
        jsonData = JSON.parse(text);
      } catch {
        toast.error("Invalid JSON file");
        return;
      }

      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonData }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to import conversation");
        return;
      }

      const data = await res.json();
      dispatch({
        type: "ADD_CONVERSATION",
        payload: {
          id: data.conversationId,
          title: data.title,
          defaultProvider: "openai",
          defaultModel: MODELS.openai[0].id,
          rootNodeId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
      toast.success(`Imported "${data.title}" (${data.nodeCount} nodes)`);
      router.push(`/chat/${data.conversationId}`);
    } catch {
      toast.error("Failed to import conversation");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleCreate() {
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    setCreating(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmed,
          defaultProvider: "openai",
          defaultModel: MODELS.openai[0].id,
        }),
      });

      if (!res.ok) throw new Error("Failed to create");

      const data = await res.json();
      dispatch({ type: "ADD_CONVERSATION", payload: data });
      setShowNewDialog(false);
      setNewTitle("");
      router.push(`/chat/${data.id}`);
    } catch {
      toast.error("Failed to create conversation");
    } finally {
      setCreating(false);
    }
  }

  const sorted = [...state.conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h2 className="text-sm font-semibold">Conversations</h2>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? "Importing..." : "Import"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowNewDialog(true)}>
            + New
          </Button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImport(file);
        }}
      />

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {sorted.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">
              No conversations yet
            </p>
          ) : (
            sorted.map((c) => (
              <ConversationItem
                key={c.id}
                conversation={c}
                isActive={c.id === state.activeConversationId}
              />
            ))
          )}
        </div>
      </ScrollArea>

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Conversation title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !creating) handleCreate();
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newTitle.trim()}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
