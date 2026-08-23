"use client";

import { Bell, BellOff, Inbox, RefreshCw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { displayName, relativeTime } from "@/lib/utils";
import type { InboxSummary } from "@/lib/types";

export function InboxSidebar({
  addresses,
  active,
  messages,
  selectedId,
  unreadFor,
  isUnread,
  loading,
  autoRefresh,
  pollProgress,
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
  pollProgress: number;
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
    <aside className="flex h-full min-h-0 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 px-3 py-3">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Active inboxes</p>
        <div className="flex flex-wrap gap-1.5">
          {addresses.map((email) => {
            const unread = unreadFor(email);
            const selected = email === active;
            return (
              <div
                key={email}
                className={`group flex items-center rounded-full border px-1 ${
                  selected
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : "border-zinc-800 bg-zinc-900 text-zinc-400"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectAddress(email)}
                  className="max-w-[160px] truncate px-2 py-1 font-mono text-[11px]"
                >
                  {email}
                </button>
                {unread > 0 && (
                  <span className="mr-1 rounded-full bg-emerald-500 px-1.5 text-[10px] font-semibold text-zinc-950">
                    {unread}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveAddress(email)}
                  className="rounded-full p-1 text-zinc-500 opacity-0 hover:text-zinc-200 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between px-3 py-2">
        <button type="button" onClick={onToggleAuto} className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="relative h-4 w-4">
            <span className="absolute inset-0 rounded-full border border-zinc-700" />
            {autoRefresh && (
              <span
                className="absolute inset-0 rounded-full border-2 border-emerald-400 border-t-transparent"
                style={{ transform: `rotate(${pollProgress * 3.6}deg)` }}
              />
            )}
            {autoRefresh && <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400 pulse-dot" />}
          </span>
          {autoRefresh ? "Auto-refresh 5s" : "Auto-refresh off"}
        </button>
        <div className="flex items-center gap-1">
          <Tooltip content={notify ? "Desktop alerts on" : "Enable desktop alerts"}>
            <Button type="button" size="icon" variant="ghost" onClick={onToggleNotify}>
              {notify ? <Bell className="h-4 w-4 text-emerald-400" /> : <BellOff className="h-4 w-4" />}
            </Button>
          </Tooltip>
          <Tooltip content="Refresh">
            <Button type="button" size="icon" variant="ghost" onClick={onRefresh}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
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
            <p className="text-xs text-zinc-500">Keep this tab visible, or hit Refresh.</p>
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
                    className={`block w-full border-b border-zinc-900 px-3 py-3 text-left transition-colors ${
                      selected ? "border-l-2 border-l-emerald-400 bg-zinc-900" : "hover:bg-zinc-900/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`truncate text-sm ${unread ? "font-semibold text-zinc-50" : "text-zinc-300"}`}>
                        {displayName(item.from)}
                      </span>
                      <span className="shrink-0 text-[11px] text-zinc-500">{relativeTime(item.receivedAt)}</span>
                    </div>
                    <div className={`truncate text-sm ${unread ? "font-medium text-zinc-100" : "text-zinc-400"}`}>
                      {item.subject}
                    </div>
                    <div className="truncate text-xs text-zinc-500">{item.snippet}</div>
                    {unread && <Badge className="mt-2 h-5 border-emerald-500/20 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-300">New</Badge>}
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
