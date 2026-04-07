"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Trash2Icon } from "lucide-react";
import { PROVIDERS } from "@/constants/providers";
import BranchIndicator from "./BranchIndicator";
import BranchMenu from "./BranchMenu";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import type { TreeNode } from "@/types/tree";

interface ChatMessageProps {
  node: TreeNode;
  childCount: number;
  childNodes: TreeNode[];
  activeChildId: string | null;
  isActive: boolean;
  onBranchClick: (nodeId: string) => void;
  onNavigateToNode?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
}

export default function ChatMessage({
  node,
  childCount,
  childNodes,
  activeChildId,
  isActive,
  onBranchClick,
  onNavigateToNode,
  onDelete,
}: ChatMessageProps) {
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isUser = node.role === "user";
  const provider = node.provider
    ? PROVIDERS[node.provider as keyof typeof PROVIDERS]
    : null;

  // Close branch menu when clicking outside
  useEffect(() => {
    if (!showBranchMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowBranchMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showBranchMenu]);

  return (
    <div
      className={`group flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
    >
      <div
        className={`relative max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted border-l-4"
        } ${isActive ? "ring-2 ring-ring" : ""}`}
        style={
          !isUser && provider
            ? { borderLeftColor: provider.color }
            : undefined
        }
      >
        {/* Provider/model badge for assistant messages */}
        {!isUser && node.provider && node.model && (
          <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: provider?.color ?? "#6B7280" }}
            />
            <span>
              {provider?.displayName ?? node.provider} / {node.model}
            </span>
          </div>
        )}

        {/* Message content with Markdown rendering */}
        <div
          className={`prose prose-sm prose-code:text-sm prose-pre:overflow-x-auto max-w-none wrap-break-word ${
            isUser
              ? "prose-invert prose-p:text-primary-foreground prose-headings:text-primary-foreground prose-strong:text-primary-foreground prose-code:text-primary-foreground"
              : "dark:prose-invert"
          }`}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "");
                const codeString = String(children).replace(/\n$/, "");

                if (match) {
                  return (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{ fontSize: "0.925rem" }}
                    >
                      {codeString}
                    </SyntaxHighlighter>
                  );
                }

                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {node.content}
          </ReactMarkdown>
        </div>

        {/* Branch indicator + menu when node has multiple children */}
        {childCount > 1 && (
          <div className="relative mt-2" ref={menuRef}>
            <BranchIndicator
              nodeId={node.id}
              branchCount={childCount}
              onClick={() => setShowBranchMenu((prev) => !prev)}
            />
            {showBranchMenu && (
              <div className="absolute left-0 z-50 mt-1">
                <BranchMenu
                  parentNodeId={node.id}
                  children={childNodes}
                  activeChildId={activeChildId}
                  onSelect={(childId) => {
                    setShowBranchMenu(false);
                    onBranchClick(childId);
                  }}
                  onNavigateToNode={onNavigateToNode ? (nodeId) => {
                    setShowBranchMenu(false);
                    onNavigateToNode(nodeId);
                  } : undefined}
                />
              </div>
            )}
          </div>
        )}

        {/* Delete button (visible on hover, user messages only) */}
        {onDelete && isUser && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="absolute -top-2 -right-2 hidden rounded-full bg-card border border-border p-1 text-red-400/70 shadow-sm transition-colors hover:text-red-500 group-hover:block"
            aria-label="Delete message and replies"
          >
            <Trash2Icon className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {onDelete && isUser && (
        <ConfirmDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          title="Delete message"
          description="Delete this message and all replies? This cannot be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={() => onDelete(node.id)}
        />
      )}
    </div>
  );
}
