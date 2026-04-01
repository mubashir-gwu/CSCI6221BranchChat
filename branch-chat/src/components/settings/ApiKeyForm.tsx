"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface ApiKeyFormProps {
  provider: string;
  displayName: string;
  color: string;
  currentMaskedKey: string | null;
  onSave: () => void;
  onDelete: () => void;
}

export default function ApiKeyForm({
  provider,
  displayName,
  color,
  currentMaskedKey,
  onSave,
  onDelete,
}: ApiKeyFormProps) {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/settings/api-keys/${provider}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save API key");
      }
      toast.success(`${displayName} API key saved`);
      setApiKey("");
      onSave();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save API key");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/settings/api-keys/${provider}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete API key");
      }
      toast.success(`${displayName} API key deleted`);
      onDelete();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete API key");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Badge style={{ backgroundColor: color, color: "#fff" }}>
            {displayName}
          </Badge>
          {currentMaskedKey && (
            <span className="text-sm font-mono text-muted-foreground">
              {currentMaskedKey}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor={`key-${provider}`} className="sr-only">
              API Key
            </Label>
            <Input
              id={`key-${provider}`}
              type="password"
              placeholder={currentMaskedKey ? "Enter new key to replace" : "Enter API key"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <Button onClick={handleSave} disabled={saving || !apiKey.trim()}>
            {saving ? "Saving..." : "Save"}
          </Button>
          {currentMaskedKey && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
