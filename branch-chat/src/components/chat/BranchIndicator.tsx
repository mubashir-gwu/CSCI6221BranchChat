"use client";

import { Badge } from "@/components/ui/badge";
import { GitBranchIcon } from "lucide-react";

interface BranchIndicatorProps {
  nodeId: string;
  branchCount: number;
  onClick: () => void;
}

export default function BranchIndicator({
  nodeId,
  branchCount,
  onClick,
}: BranchIndicatorProps) {
  return (
    <button onClick={onClick} className="cursor-pointer">
      <Badge variant="secondary" className="gap-1 text-xs">
        <GitBranchIcon className="h-3 w-3" />
        {branchCount} branches
      </Badge>
    </button>
  );
}
