'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { PROVIDERS } from '@/constants/providers';
import type { ProviderName } from '@/constants/providers';
import { User, Bot, GitBranch } from 'lucide-react';

interface TreeNodeData {
  label: string;
  role: 'user' | 'assistant' | 'system';
  provider: string | null;
  isActive: boolean;
  hasMultipleChildren: boolean;
}

function TreeNodeComponent({ data }: { data: TreeNodeData }) {
  const providerKey = data.provider as ProviderName | null;
  const providerColor = providerKey && PROVIDERS[providerKey]
    ? PROVIDERS[providerKey].color
    : '#6B7280';

  const isUser = data.role === 'user';

  return (
    <div
      className={`
        relative rounded-lg border px-3 py-2 text-xs shadow-sm
        min-w-40 max-w-45
        cursor-pointer hover:border-primary/50
        ${data.isActive
          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background border-primary'
          : 'border-border bg-card'
        }
      `}
      style={{
        borderLeftColor: providerColor,
        borderLeftWidth: '3px',
      }}
    >
      <Handle type="target" position={Position.Top} className="h-0! w-0! min-h-0! min-w-0! border-0! bg-transparent!" />

      <div className="flex items-center gap-1.5">
        <div
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: providerColor + '20', color: providerColor }}
        >
          {isUser ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
        </div>

        <span className="truncate text-foreground">{data.label || '...'}</span>

        {data.hasMultipleChildren && (
          <GitBranch className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="h-0! w-0! min-h-0! min-w-0! border-0! bg-transparent!" />
    </div>
  );
}

export default memo(TreeNodeComponent);
