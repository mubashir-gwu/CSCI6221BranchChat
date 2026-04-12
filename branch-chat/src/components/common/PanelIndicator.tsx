"use client";

interface PanelIndicatorProps {
  activeIndex: number;
  count: number;
}

export default function PanelIndicator({ activeIndex, count }: PanelIndicatorProps) {
  return (
    <div className="md:hidden">
      <div className="flex gap-2 justify-center py-2">
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full ${
              i === activeIndex ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
