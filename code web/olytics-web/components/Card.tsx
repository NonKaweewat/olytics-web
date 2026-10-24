import type { ReactNode } from "react";

/** Panel with a title, an optional footnote, and a warning when some filters don't apply. */
export default function Card({
  title,
  metric,
  note,
  warn,
  children,
}: {
  title: string;
  metric?: string;
  note?: string;
  /** e.g. "ยังไม่ขึ้นกับตัวกรอง ภาค, รัฐ" — see lib/notes.ts ignoredNote(). */
  warn?: string;
  children: ReactNode;
}) {
  return (
    <div className="card">
      <h3>
        {title} {metric && <span className="metric">{metric}</span>}
      </h3>
      {children}
      {warn && <p className="warn">{warn}</p>}
      {note && <p className="note">{note}</p>}
    </div>
  );
}
