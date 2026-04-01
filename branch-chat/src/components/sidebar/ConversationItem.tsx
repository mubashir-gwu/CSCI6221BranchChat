"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { useConversation } from "@/hooks/useConversation";
import type { ConversationResponse } from "@/types/api";
import { toast } from "sonner";

interface ConversationItemProps {
  conversation: ConversationResponse;
  isActive: boolean;
}

export default function ConversationItem({
  conversation,
  isActive,
}: ConversationItemProps) {
  const router = useRouter();
  const { dispatch } = useConversation();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  async function handleRename() {
    const trimmed = editTitle.trim();
    if (!trimmed || trimmed === conversation.title) {
      setIsEditing(false);
      setEditTitle(conversation.title);
      return;
    }

    try {
      const res = await fetch(`/api/conversations/${conversation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });

      if (!res.ok) throw new Error("Failed to rename");

      const data = await res.json();
      dispatch({
        type: "UPDATE_CONVERSATION",
        payload: { id: conversation.id, title: data.title, updatedAt: data.updatedAt },
      });
      setIsEditing(false);
    } catch {
      toast.error("Failed to rename conversation");
      setEditTitle(conversation.title);
      setIsEditing(false);
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/conversations/${conversation.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");

      dispatch({ type: "REMOVE_CONVERSATION", payload: conversation.id });

      if (isActive) {
        router.push("/dashboard");
      }

      toast.success("Conversation deleted");
    } catch {
      toast.error("Failed to delete conversation");
    }
  }

  return (
    <>
      <div
        className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent ${
          isActive ? "bg-accent" : ""
        }`}
        onClick={() => {
          if (!isEditing) {
            router.push(`/chat/${conversation.id}`);
          }
        }}
      >
        {isEditing ? (
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") {
                setIsEditing(false);
                setEditTitle(conversation.title);
              }
            }}
            className="h-6 text-sm"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 truncate">{conversation.title}</span>
        )}

        {!isEditing && (
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                setEditTitle(conversation.title);
                setIsEditing(true);
              }}
            >
              <span className="text-xs">✎</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteDialog(true);
              }}
            >
              <span className="text-xs">✕</span>
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Conversation"
        description="This will permanently delete this conversation and all its messages. This action cannot be undone."
        onConfirm={handleDelete}
        confirmLabel="Delete"
        destructive
      />
    </>
  );
}
