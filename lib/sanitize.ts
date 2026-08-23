"use client";

import DOMPurify from "dompurify";

export function sanitizeEmailHtml(html: string, showImages: boolean): string {
  if (!html) return "";
  const hook = (node: Element) => {
    if (!showImages && node.tagName === "IMG") {
      node.removeAttribute("src");
      node.removeAttribute("srcset");
      node.setAttribute("alt", node.getAttribute("alt") || "[image blocked]");
    }
    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
  };
  DOMPurify.addHook("afterSanitizeAttributes", hook);
  try {
    return DOMPurify.sanitize(html, {
      FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "link", "meta", "base"],
      FORBID_ATTR: ["onerror", "onclick", "onload", "onmouseover", "style"],
      ALLOW_UNKNOWN_PROTOCOLS: false,
    });
  } finally {
    DOMPurify.removeHook("afterSanitizeAttributes");
  }
}
