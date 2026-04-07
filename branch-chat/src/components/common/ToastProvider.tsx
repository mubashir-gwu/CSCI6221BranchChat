"use client";

import { Toaster } from "@/components/ui/sonner";
import { AlertTriangle } from "lucide-react";

export default function ToastProvider() {
  return (
    <Toaster
      icons={{
        error: <AlertTriangle className="h-4 w-4" />,
      }}
    />
  );
}
