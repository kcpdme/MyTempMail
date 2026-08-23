"use client";

import { KeyboardEvent, useEffect, useState } from "react";
import { Minus, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ComposeModal({
  open,
  mode,
  fromOptions,
  defaultFrom,
  initialTo,
  initialSubject,
  initialBody,
  onClose,
  onSend,
}: {
  open: boolean;
  mode: "compose" | "reply" | "forward";
  fromOptions: string[];
  defaultFrom: string;
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
  onClose: () => void;
  onSend: (input: { from: string; to: string[]; subject: string; text: string }) => Promise<void>;
}) {
  const [from, setFrom] = useState(defaultFrom);
  const [chips, setChips] = useState<string[]>([]);
  const [draftTo, setDraftTo] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFrom(defaultFrom);
    setChips(initialTo ? [initialTo.replace(/.*<([^>]+)>/, "$1").trim()] : []);
    setDraftTo("");
    setSubject(initialSubject ?? "");
    setText(initialBody ?? "");
    setError(null);
    setMinimized(false);
  }, [open, defaultFrom, initialTo, initialSubject, initialBody]);

  function addChip(value: string) {
    const email = value.trim().replace(/,$/, "");
    if (!email) return;
    setChips((prev) => (prev.includes(email) ? prev : [...prev, email]));
    setDraftTo("");
  }

  function onToKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addChip(draftTo);
    }
    if (event.key === "Backspace" && !draftTo) {
      setChips((prev) => prev.slice(0, -1));
    }
  }

  async function send() {
    const to = draftTo.trim() ? [...chips, draftTo.trim()] : chips;
    setBusy(true);
    setError(null);
    try {
      await onSend({ from, to, subject, text });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "reply" ? `Reply to ${initialTo || "sender"}` : mode === "forward" ? "Forward" : "New Message";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className={
          minimized
            ? "inset-x-3 bottom-4 top-auto h-auto max-h-none translate-y-0 rounded-2xl border border-zinc-800 md:left-auto md:right-4 md:w-[min(720px,calc(100vw-1.5rem))]"
            : "flex h-dvh max-h-dvh flex-col md:h-auto md:max-h-[90vh]"
        }
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <DialogTitle className="truncate pr-2 text-sm font-semibold">{title}</DialogTitle>
          <div className="flex items-center gap-1">
            <Button type="button" size="icon" variant="ghost" className="hidden md:inline-flex" onClick={() => setMinimized((v) => !v)}>
              <Minus className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {!minimized && (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm pb-[max(1rem,env(safe-area-inset-bottom))]">
            <label className="block">
              <span className="text-zinc-500">From</span>
              <select
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 h-12 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-base md:h-9 md:text-sm"
              >
                {fromOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <span className="text-zinc-500">To</span>
              <div className="mt-1 flex min-h-9 flex-wrap items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1">
                {chips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setChips((prev) => prev.filter((item) => item !== chip))}
                    className="rounded-full bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-200"
                  >
                    {chip} ×
                  </button>
                ))}
                <input
                  value={draftTo}
                  onChange={(e) => setDraftTo(e.target.value)}
                  onKeyDown={onToKey}
                  onBlur={() => addChip(draftTo)}
                  placeholder="name@example.com"
                  className="h-10 min-w-[140px] flex-1 bg-transparent text-base outline-none md:h-7 md:text-sm"
                />
              </div>
            </div>
            <label className="block">
              <span className="text-zinc-500">Subject</span>
              <Input className="mt-1" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-zinc-500">Message</span>
              <textarea
                rows={8}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    void send();
                  }
                }}
                className="mt-1 min-h-[12rem] w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-base leading-6 text-zinc-200 outline-none focus:border-emerald-500/60 md:min-h-0 md:text-xs md:leading-5"
              />
            </label>
            {error && <p className="text-red-400">{error}</p>}
            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="hidden text-[11px] text-zinc-500 md:block">⌘/Ctrl + Enter to send</p>
              <div className="flex w-full gap-2 md:ml-auto md:w-auto">
                <Button type="button" variant="ghost" className="flex-1 md:flex-none" onClick={onClose}>
                  Discard
                </Button>
                <Button type="button" className="flex-1 md:flex-none" onClick={() => void send()} disabled={busy}>
                  {busy ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
