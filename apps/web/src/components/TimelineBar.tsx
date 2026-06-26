import type { TimelinePoint } from "@repocity/shared";
import { Clock3 } from "lucide-react";

interface TimelineBarProps {
  timeline: TimelinePoint[];
  value: number;
  onChange: (value: number) => void;
}

export function TimelineBar({ timeline, value, onChange }: TimelineBarProps) {
  if (!timeline.length) return null;
  const selected = timeline[value] ?? timeline.at(-1)!;
  return (
    <section className="timeline-bar" aria-label="Commit timeline">
      <div className="timeline-readout">
        <Clock3 size={16} />
        <span>{selected.label}</span>
        <strong>{selected.commits} commits</strong>
        <span>{selected.filesChanged} files</span>
      </div>
      <input
        type="range"
        min={0}
        max={timeline.length - 1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label="Timeline month"
      />
    </section>
  );
}

