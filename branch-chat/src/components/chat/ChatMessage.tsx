"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { PROVIDERS } from "@/constants/providers";
import BranchIndicator from "./BranchIndicator";
import type { TreeNode } from "@/types/tree";

interface ChatMessageProps {
  node: TreeNode;
  childCount: number;
  isActive: boolean;
  onBranchClick: (nodeId: string) => void;
}

export default function ChatMessage({
  node,
  childCount,
  isActive,
  onBranchClick,
}: ChatMessageProps) {
  const isUser = node.role === "user";
  const provider = node.provider
    ? PROVIDERS[node.provider as keyof typeof PROVIDERS]
    : null;

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
    >
      <div
        className={`relative max-w-[80%] overflow-hidden rounded-lg px-4 py-3 ${
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
          className={`prose prose-sm prose-code:text-sm max-w-none wrap-break-word overflow-x-auto ${
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

        {/* Branch indicator when node has multiple children */}
        {childCount > 1 && (
          <div className="mt-2">
            <BranchIndicator
              nodeId={node.id}
              branchCount={childCount}
              onClick={() => onBranchClick(node.id)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
