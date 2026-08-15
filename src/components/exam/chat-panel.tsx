"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Input, cx } from "@/components/ui";
import type { ChatLine } from "@/lib/types";

/** The examiner/candidate message thread. Same component on both sides. */
export function ChatPanel({
  lines,
  onSend,
  side,
  placeholder = "Type a message",
  emptyHint,
  disabled = false,
  height = "h-64",
}: {
  lines: ChatLine[];
  onSend: (body: string) => void;
  side: "CANDIDATE" | "EXAMINER";
  placeholder?: string;
  emptyHint?: string;
  disabled?: boolean;
  height?: string;
}) {
  const [draft, setDraft] = useState("");
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  const submit = () => {
    const body = draft.trim();
    if (!body || disabled) return;
    onSend(body);
    setDraft("");
  };

  return (
    <div className="flex min-h-0 flex-col">
      <div
        ref={logRef}
        className={cx("thin-scroll flex flex-col gap-2 overflow-y-auto px-4 py-3", height)}
      >
        {lines.length === 0 ? (
          <p className="my-auto text-center text-[13px] text-ink-3">
            {emptyHint ?? "No messages yet."}
          </p>
        ) : (
          lines.map((line) => {
            const mine = side === "EXAMINER" ? line.fromExaminer : !line.fromExaminer;
            return (
              <div
                key={line.id}
                className={cx(
                  "max-w-[85%] rounded-lg border px-3 py-2 text-[13px] leading-snug",
                  mine
                    ? "self-end border-ink bg-ink text-white"
                    : "self-start border-line bg-subtle text-ink",
                )}
              >
                {!mine ? (
                  <div className="mb-0.5 text-[11px] font-medium text-ink-3">{line.senderName}</div>
                ) : null}
                <div className="whitespace-pre-wrap break-words">{line.body}</div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-line px-3 py-2.5">
        <Input
          value={draft}
          disabled={disabled}
          maxLength={400}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <Button size="sm" variant="primary" disabled={disabled || !draft.trim()} onClick={submit}>
          Send
        </Button>
      </div>
    </div>
  );
}
