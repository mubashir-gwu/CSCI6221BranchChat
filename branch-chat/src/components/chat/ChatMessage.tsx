"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Trash2Icon, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { PROVIDERS } from "@/constants/providers";
import BranchIndicator from "./BranchIndicator";
import BranchMenu from "./BranchMenu";
import CopyMarkdownButton from "./CopyMarkdownButton";
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
          className={`prose prose-sm prose-code:text-sm prose-pre:overflow-x-auto prose-pre:border-0 prose-pre:bg-transparent prose-pre:p-0 max-w-none wrap-break-word ${
            isUser
              ? "prose-invert prose-p:text-primary-foreground prose-headings:text-primary-foreground prose-strong:text-primary-foreground prose-code:text-primary-foreground prose-li:text-primary-foreground prose-ul:marker:text-primary-foreground prose-ol:marker:text-primary-foreground prose-a:text-primary-foreground prose-blockquote:text-primary-foreground prose-th:text-primary-foreground prose-td:text-primary-foreground prose-em:text-primary-foreground"
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

        {/* Attachment previews */}
        {node.attachments && node.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {node.attachments.map((att, idx) => (
              <AttachmentPreview key={`${att.filename}-${idx}`} attachment={att} isUser={isUser} />
            ))}
          </div>
        )}

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

        {/* Action buttons (visible on hover) */}
        <div className="absolute -top-2 -right-2 hidden gap-1 group-hover:flex">
          <div className="rounded-full bg-card border border-border p-1 shadow-sm">
            <CopyMarkdownButton content={node.content} />
          </div>
          {onDelete && isUser && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-full bg-card border border-border p-1 text-red-400/70 shadow-sm transition-colors hover:text-red-500"
              aria-label="Delete message and replies"
            >
              <Trash2Icon className="h-3 w-3" />
            </button>
          )}
        </div>
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

function AttachmentPreview({
  attachment,
  isUser,
}: {
  attachment: { filename: string; mimeType: string; data: string; size: number };
  isUser: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (attachment.mimeType.startsWith('image/')) {
    const dataUrl = `data:${attachment.mimeType};base64,${attachment.data}`;
    return (
      <a href={dataUrl} target="_blank" rel="noopener noreferrer">
        <img
          src={dataUrl}
          alt={attachment.filename}
          className="max-h-48 rounded border cursor-pointer"
        />
      </a>
    );
  }

  if (attachment.mimeType === 'application/pdf') {
    const dataUrl = `data:application/pdf;base64,${attachment.data}`;
    return (
      <a
        href={dataUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-muted/50 ${
          isUser ? 'border-primary-foreground/30 text-primary-foreground' : 'border-border'
        }`}
      >
        <FileText className="h-4 w-4 text-red-500" />
        <span className="max-w-[150px] truncate">{attachment.filename}</span>
      </a>
    );
  }

  // Text files
  const decodedText = (() => {
    try {
      return atob(attachment.data);
    } catch {
      return '[Unable to decode file content]';
    }
  })();

  return (
    <div className={`rounded-md border text-xs ${isUser ? 'border-primary-foreground/30' : 'border-border'}`}>
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className={`flex items-center gap-1.5 px-2 py-1 hover:bg-muted/50 w-full text-left ${
          isUser ? 'text-primary-foreground' : ''
        }`}
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <FileText className="h-4 w-4" />
        <span className="max-w-[150px] truncate">{attachment.filename}</span>
      </button>
      {expanded && (
        <pre className={`px-2 py-1 border-t max-h-48 overflow-auto whitespace-pre-wrap text-xs ${
          isUser ? 'border-primary-foreground/30 text-primary-foreground' : 'border-border'
        }`}>
          {decodedText}
        </pre>
      )}
    </div>
  );
}
