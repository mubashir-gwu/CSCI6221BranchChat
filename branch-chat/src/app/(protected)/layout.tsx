"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { PanelLeftOpen, PanelLeftClose } from "lucide-react";
import ThemeToggle from "@/components/common/ThemeToggle";
import { Button } from "@/components/ui/button";
import ConversationProvider from "@/components/providers/ConversationProvider";
import UIProvider from "@/components/providers/UIProvider";
import ConversationList from "@/components/sidebar/ConversationList";
import { useUI } from "@/hooks/useUI";

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { state: uiState, dispatch: uiDispatch } = useUI();

  return (
    <div className="flex h-screen">
      {/* Sidebar — fixed full-screen overlay on mobile, inline on desktop */}
      {uiState.isSidebarOpen && (
        <aside className="fixed inset-0 z-40 flex flex-col bg-background md:bg-muted/30 md:static md:z-auto md:w-64 md:border-r">
          <div className="flex h-11 items-center justify-between border-b px-3">
            <Link href="/dashboard" className="text-lg font-semibold hover:opacity-80">BranchChat</Link>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <button
                onClick={() => uiDispatch({ type: "TOGGLE_SIDEBAR" })}
                className="md:hidden flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                aria-label="Close sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <ConversationList />
          </div>
          <div className="border-t p-2 space-y-1">
            <Link href="/usage">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
              >
                Usage
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              Logout
            </Button>
          </div>
        </aside>
      )}

      {/* Main content */}
      <main className="relative flex-1 overflow-auto">
        <button
          onClick={() => uiDispatch({ type: "TOGGLE_SIDEBAR" })}
          className="absolute top-13 left-2 z-10 flex h-8 w-8 items-center justify-center rounded-md border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label={uiState.isSidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          {uiState.isSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>
        {children}
      </main>
    </div>
  );
}

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConversationProvider>
      <UIProvider>
        <LayoutInner>{children}</LayoutInner>
      </UIProvider>
    </ConversationProvider>
  );
}
