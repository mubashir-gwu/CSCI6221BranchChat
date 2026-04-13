"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Trash2Icon, FileText, ChevronDown, ChevronRight, GitBranchPlus, Undo2 } from "lucide-react";
import { PROVIDERS } from "@/constants/providers";
import { Badge } from "@/components/ui/badge";
import BranchIndicator from "./BranchIndicator";
import BranchMenu from "./BranchMenu";
import CopyMarkdownButton from "./CopyMarkdownButton";
import ThinkingBlock from "./ThinkingBlock";
import CitationList from "./CitationList";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import type { TreeNode } from "@/types/tree";

interface ChatMessageProps {
  node: TreeNode;
  childCount: number;
  childNodes: TreeNode[];
  activeChildId: string | null;
  isActive: boolean;
  isLast: boolean;
  onBranchClick: (nodeId: string) => void;
  onNavigateToNode?: (nodeId: string) => void;
  onBranchFromHere?: (nodeId: string) => void;
  onGoBack?: () => void;
  onDelete?: (nodeId: string) => void;
  streamingThinkingContent?: string;
}

export default function ChatMessage({
  node,
  childCount,
  childNodes,
  activeChildId,
  isActive,
  isLast,
  onBranchClick,
  onNavigateToNode,
  onBranchFromHere,
  onGoBack,
  onDelete,
  streamingThinkingContent,
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

  const actionButtons = (
    <div className="hidden flex-col items-center gap-1 group-hover:flex">
      <CopyMarkdownButton content={node.content} />
      {onDelete && isUser && (
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="text-red-400/70 transition-colors hover:text-red-500"
          title="Delete message and replies"
          aria-label="Delete message and replies"
        >
          <Trash2Icon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <div
      className={`group flex items-start gap-2 ${isUser ? "justify-end" : "justify-start"} mb-4`}
    >
      {isUser && actionButtons}
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

        {/* Thinking content (completed messages) */}
        {!isUser && node.thinkingContent && (
          <ThinkingBlock content={node.thinkingContent} />
        )}

        {/* Streaming thinking content */}
        {!isUser && streamingThinkingContent && (
          <ThinkingBlock content={streamingThinkingContent} isStreaming />
        )}

        {/* Message content with Markdown rendering */}
        <div
          className={`prose prose-sm prose-code:text-sm prose-pre:overflow-x-auto prose-pre:bg-[#282c34] prose-pre:text-[#abb2bf] prose-pre:border-0 prose-pre:rounded-lg max-w-none wrap-break-word ${
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
                      customStyle={{ fontSize: "0.925rem", margin: 0, padding: 0, background: "transparent" }}
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

        {/* Citations */}
        {!isUser && node.citations && Array.isArray(node.citations) && node.citations.length > 0 && (
          <CitationList citations={node.citations} />
        )}

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
                  onNavigateToNode={onNavigateToNode && !isLast ? (nodeId) => {
                    setShowBranchMenu(false);
                    onNavigateToNode(nodeId);
                  } : undefined}
                />
              </div>
            )}
          </div>
        )}

        {/* Go back button when navigated via "branch from here" */}
        {!isUser && isActive && onGoBack && (
          <button onClick={onGoBack} className="mt-2 cursor-pointer">
            <Badge variant="secondary" className="gap-1 text-xs">
              <Undo2 className="h-3 w-3" />
              Go back to previous branch
            </Badge>
          </button>
        )}

        {/* New branch button for assistant messages (not last, not showing go-back) */}
        {!isUser && childCount <= 1 && !isLast && !(isActive && onGoBack) && onBranchFromHere && (
          <button onClick={() => onBranchFromHere(node.id)} className="mt-2 cursor-pointer">
            <Badge variant="secondary" className="gap-1 text-xs">
              <GitBranchPlus className="h-3 w-3" />
              New branch from here
            </Badge>
          </button>
        )}

      </div>
      {!isUser && actionButtons}

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
    const handleImageClick = () => {
      const byteString = atob(attachment.data);
      const bytes = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) {
        bytes[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: attachment.mimeType });
      window.open(URL.createObjectURL(blob), '_blank');
    };
    return (
      <img
        src={dataUrl}
        alt={attachment.filename}
        className="max-h-48 rounded border cursor-pointer"
        onClick={handleImageClick}
      />
    );
  }

  if (attachment.mimeType === 'application/pdf') {
    const handlePdfClick = () => {
      const byteString = atob(attachment.data);
      const bytes = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) {
        bytes[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      window.open(URL.createObjectURL(blob), '_blank');
    };
    return (
      <button
        onClick={handlePdfClick}
        className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-muted/50 ${
          isUser ? 'border-primary-foreground/30 text-primary-foreground' : 'border-border'
        }`}
      >
        <FileText className="h-4 w-4 text-red-500" />
        <span className="max-w-[150px] truncate">{attachment.filename}</span>
      </button>
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
