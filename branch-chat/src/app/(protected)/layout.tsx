"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import ConversationProvider from "@/components/providers/ConversationProvider";
import UIProvider from "@/components/providers/UIProvider";
import ConversationList from "@/components/sidebar/ConversationList";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConversationProvider>
      <UIProvider>
        <div className="flex h-screen">
          {/* Sidebar */}
          <aside className="flex w-64 flex-col border-r bg-muted/30">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <Link href="/dashboard" className="text-lg font-semibold hover:opacity-80">BranchChat</Link>
            </div>
            <div className="flex-1 overflow-hidden">
              <ConversationList />
            </div>
            <div className="border-t p-2">
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

          {/* Main content */}
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </UIProvider>
    </ConversationProvider>
  );
}
