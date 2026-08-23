"use client";

import { Bell, BellOff, Inbox, RefreshCw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { displayName, relativeTime } from "@/lib/utils";
import type { InboxSummary } from "@/lib/types";

function splitAddress(email: string) {
  const at = email.lastIndexOf("@");
  if (at <= 0) return { local: email, host: "" };
  return { local: email.slice(0, at), host: email.slice(at + 1) };
}

export function InboxSidebar({
  addresses,
  active,
  messages,
  selectedId,
  unreadFor,
  isUnread,
  loading,
  autoRefresh,
  notify,
  onSelectAddress,
  onRemoveAddress,
  onSelectMessage,
  onRefresh,
  onToggleAuto,
  onToggleNotify,
  mockMode,
  onSeed,
}: {
  addresses: string[];
  active: string;
  messages: InboxSummary[];
  selectedId: string | null;
  unreadFor: (email: string) => number;
  isUnread: (id: string) => boolean;
  loading: boolean;
  autoRefresh: boolean;
  notify: boolean;
  onSelectAddress: (email: string) => void;
  onRemoveAddress: (email: string) => void;
  onSelectMessage: (id: string) => void;
  onRefresh: () => void;
  onToggleAuto: () => void;
  onToggleNotify: () => void;
  mockMode?: boolean;
  onSeed?: () => void;
}) {
  return (
    <aside className="flex h-full min-h-0 flex-col bg-zinc-950 md:border-r md:border-zinc-800">
      <div className="border-b border-zinc-800 px-3 py-3">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Active inboxes</p>
        <div className="flex flex-col gap-2">
          {addresses.map((email) => {
            const unread = unreadFor(email);
            const selected = email === active;
            const { local, host } = splitAddress(email);
            return (
              <div
                key={email}
                className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${
                  selected
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                    : "border-zinc-800 bg-zinc-900 text-zinc-300"
                }`}
              >
                <button type="button" onClick={() => onSelectAddress(email)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-mono text-sm font-medium">{local}</span>
                  <span className="block truncate text-[11px] text-zinc-500">@{host}</span>
                </button>
                {unread > 0 && (
                  <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-950">
                    {unread}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveAddress(email)}
                  className="rounded-full p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                  aria-label={`Remove ${email}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Inbox</p>
        <div className="flex items-center gap-1">
          <Tooltip content={notify ? "Desktop alerts on" : "Enable desktop alerts"}>
            <Button type="button" size="icon" variant="ghost" onClick={onToggleNotify} className="h-10 w-10 md:h-9 md:w-9">
              {notify ? <Bell className="h-4 w-4 text-emerald-400" /> : <BellOff className="h-4 w-4" />}
            </Button>
          </Tooltip>
          <Tooltip content={autoRefresh ? "Auto-refresh on (every 5s)" : "Enable auto-refresh"}>
            <Button
              type="button"
              size="sm"
              variant={autoRefresh ? "default" : "outline"}
              aria-pressed={autoRefresh}
              onClick={onToggleAuto}
              className="h-10 px-3 md:h-8"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${autoRefresh ? "bg-zinc-950 pulse-dot" : "bg-zinc-600"}`} />
              Auto
            </Button>
          </Tooltip>
          <Tooltip content="Refresh now">
            <Button type="button" size="sm" variant="secondary" onClick={onRefresh} className="h-10 px-3 md:h-8">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto mail-scroll">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <Inbox className="h-8 w-8 text-zinc-500" />
            </div>
            <p className="text-sm text-zinc-300">Your inbox is waiting for incoming mail…</p>
            <p className="text-xs text-zinc-500">Hit Refresh to check for mail, or turn on Auto.</p>
            {mockMode && (
              <button type="button" onClick={onSeed} className="text-xs text-emerald-400 underline">
                Seed test message
              </button>
            )}
          </div>
        ) : (
          <ul>
            {messages.map((item) => {
              const unread = isUnread(item.id);
              const selected = selectedId === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelectMessage(item.id)}
                    className={`block w-full border-b border-zinc-900 px-4 py-3.5 text-left transition-colors ${
                      selected ? "border-l-2 border-l-emerald-400 bg-zinc-900" : "hover:bg-zinc-900/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`min-w-0 truncate text-sm ${unread ? "font-semibold text-zinc-50" : "text-zinc-300"}`}>
                        {displayName(item.from)}
                      </span>
                      <span className="shrink-0 text-[11px] text-zinc-500">{relativeTime(item.receivedAt)}</span>
                    </div>
                    <div className={`truncate text-sm ${unread ? "font-medium text-zinc-100" : "text-zinc-400"}`}>
                      {item.subject}
                    </div>
                    <div className="truncate text-xs text-zinc-500">{item.snippet}</div>
                    {unread && (
                      <Badge className="mt-2 h-5 border-emerald-500/20 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-300">
                        New
                      </Badge>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
