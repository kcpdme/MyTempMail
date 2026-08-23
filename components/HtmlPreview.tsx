"use client";

import { sanitizeEmailHtml } from "@/lib/sanitize";

export function HtmlPreview({ html, showImages }: { html: string; showImages: boolean }) {
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    html, body { background: #09090b; color: #e4e4e7; margin: 0; }
    body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; padding: 16px; word-break: break-word; line-height: 1.55; }
    img { max-width: 100%; height: auto; }
    a { color: #34d399; }
    blockquote { border-left: 2px solid #3f3f46; margin: 0; padding-left: 12px; color: #a1a1aa; }
  </style></head><body>${sanitizeEmailHtml(html, showImages)}</body></html>`;

  return (
    <iframe
      title="Email preview"
      sandbox=""
      srcDoc={srcDoc}
      className="h-full min-h-[280px] w-full rounded-xl border border-zinc-800 bg-zinc-950"
    />
  );
}
