"use client";

import { ArrowLeft, Copy, Forward, Paperclip, Reply, Trash2 } from "lucide-react";
import { useState } from "react";
import { HtmlPreview } from "@/components/HtmlPreview";
import { Button } from "@/components/ui/button";
import { displayAddress, displayName, initials } from "@/lib/utils";
import type { StoredMessage } from "@/lib/types";

export function MessageView({
  message,
  onBack,
  onReply,
  onForward,
  onDelete,
  onCopy,
}: {
  message: StoredMessage | null;
  onBack?: () => void;
  onReply: () => void;
  onForward: () => void;
  onDelete: () => void;
  onCopy: (kind: "text" | "html") => void;
}) {
  const [view, setView] = useState<"html" | "text">("html");
  const [showImages, setShowImages] = useState(false);

  if (!message) {
    return (
      <>
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-sm text-zinc-500 md:hidden">
          <p>Opening message…</p>
        </div>
        <div className="hidden h-full flex-col items-center justify-center gap-2 text-sm text-zinc-500 md:flex">
          <p>Select an email from the left to read</p>
        </div>
      </>
    );
  }

  const fromName = displayName(message.from);
  const prefersHtml = message.hasHtml && view === "html";

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-950">
      <div className="border-b border-zinc-800 px-4 py-3 md:px-5 md:py-4">
        {onBack && (
          <Button type="button" variant="ghost" size="sm" className="-ml-2 mb-2 h-10 md:hidden" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Inbox
          </Button>
        )}
        <h2 className="text-lg font-semibold tracking-tight break-words text-zinc-50 md:text-xl">{message.subject}</h2>
        <div className="mt-3 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-sm font-semibold text-violet-200">
            {initials(fromName)}
          </div>
          <div className="min-w-0 text-sm">
            <p className="font-medium text-zinc-100">{fromName}</p>
            <p className="break-all text-zinc-500">From: {displayAddress(message.from)}</p>
            <p className="break-all text-zinc-500">To: {message.to.join(", ")}</p>
            <p className="text-zinc-500">{new Date(message.receivedAt).toLocaleString()}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center">
          <Button type="button" size="sm" className="h-11 md:h-8" onClick={onReply}>
            <Reply className="h-4 w-4" /> Reply
          </Button>
          <Button type="button" size="sm" variant="secondary" className="h-11 md:h-8" onClick={onForward}>
            <Forward className="h-4 w-4" /> Forward
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-11 md:h-8" onClick={() => onCopy(prefersHtml ? "html" : "text")}>
            <Copy className="h-4 w-4" /> Copy {prefersHtml ? "HTML" : "raw"}
          </Button>
          <Button type="button" size="sm" variant="danger" className="h-11 md:h-8" onClick={onDelete}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
          <div className="col-span-2 flex items-center gap-3 pt-1 text-xs text-zinc-400 md:ml-auto md:w-auto md:pt-0">
            <button
              type="button"
              className={view === "html" ? "text-emerald-300" : ""}
              onClick={() => setView("html")}
              disabled={!message.hasHtml}
            >
              HTML
            </button>
            <span>/</span>
            <button type="button" className={view === "text" ? "text-emerald-300" : ""} onClick={() => setView("text")}>
              Plain text
            </button>
            {message.hasHtml && (
              <label className="ml-2 flex items-center gap-1">
                <input type="checkbox" checked={showImages} onChange={(e) => setShowImages(e.target.checked)} />
                Images
              </label>
            )}
          </div>
        </div>
      </div>
      {message.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-zinc-800 px-5 py-3 text-xs text-zinc-400">
          {message.attachments.map((file) => (
            <span key={file.id} className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1">
              <Paperclip className="h-3 w-3" />
              {file.filename}
            </span>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 p-4">
        {prefersHtml ? (
          <HtmlPreview html={message.html} showImages={showImages} />
        ) : (
          <pre className="prose prose-invert max-w-none h-full overflow-auto whitespace-pre-wrap font-sans text-sm leading-6 text-zinc-200">
            {message.text || "No plain-text body."}
          </pre>
        )}
      </div>
    </div>
  );
}
