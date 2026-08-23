"use client";

import { Check, Copy, Dice5, LogOut, Plus, Settings2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { formatCountdown } from "@/lib/utils";

export function IdentityBar({
  domains,
  active,
  createdAt,
  ttlSeconds,
  copied,
  compact,
  onCopy,
  onRandomize,
  onAddInbox,
  onCompose,
  onLogout,
}: {
  domains: string[];
  active: string;
  createdAt?: number;
  ttlSeconds: number;
  copied: boolean;
  compact?: boolean;
  onCopy: () => void;
  onRandomize: (domain: string) => string;
  onAddInbox: (local: string, domain: string) => void;
  onCompose: () => void;
  onLogout?: () => void;
}) {
  const [local, setLocal] = useState("");
  const [domain, setDomain] = useState(domains[0] ?? "");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const at = active.lastIndexOf("@");
    if (at > 0) {
      setLocal(active.slice(0, at));
      setDomain(active.slice(at + 1));
    }
  }, [active]);

  useEffect(() => {
    if (!domains.includes(domain) && domains[0]) setDomain(domains[0]);
  }, [domain, domains]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = createdAt ? createdAt + ttlSeconds * 1000 - now : ttlSeconds * 1000;

  function applyRandom() {
    const next = onRandomize(domain);
    const at = next.lastIndexOf("@");
    if (at > 0) {
      setLocal(next.slice(0, at));
      setDomain(next.slice(at + 1));
    }
  }

  const actions = (
    <>
      <Button type="button" onClick={onCompose} className="h-9 px-3" aria-label="Compose">
        <Plus className="h-4 w-4" />
        Compose
      </Button>
      <Link href="/settings">
        <Button type="button" variant="ghost" size="icon" aria-label="Settings">
          <Settings2 className="h-4 w-4" />
        </Button>
      </Link>
      {onLogout && (
        <Tooltip content="Sign out">
          <Button type="button" variant="ghost" size="icon" aria-label="Sign out" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </Tooltip>
      )}
    </>
  );

  return (
    <header className="shrink-0 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
      <div className="flex items-center gap-2 px-3 py-2.5 md:gap-3 md:px-4 md:py-3">
        <div className="min-w-0 flex-1 md:mr-1 md:flex-none">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-400 md:text-[11px]">
            MyTempMail
          </p>
          <p className="hidden text-xs text-zinc-500 md:block">Disposable workspace</p>
          <p className="truncate text-[11px] tabular-nums text-zinc-400 md:hidden">
            {compact ? active : `Expires ${formatCountdown(remaining)}`}
          </p>
        </div>

        <div className="hidden min-w-0 flex-1 items-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 md:flex">
          <Input
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="h-10 min-w-[8rem] flex-1 border-0 bg-transparent font-mono text-sm focus:ring-0 md:h-10"
          />
          <span className="px-1 text-zinc-500">@</span>
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="h-10 max-w-[200px] bg-transparent px-2 text-sm text-zinc-200 outline-none"
          >
            {domains.map((item) => (
              <option key={item} value={item} className="bg-zinc-900">
                {item}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1 border-l border-zinc-800 px-1">
            <Tooltip content={copied ? "Copied" : "Copy address"}>
              <Button type="button" size="icon" variant="ghost" onClick={onCopy} disabled={!active}>
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </Button>
            </Tooltip>
            <Tooltip content="New word address">
              <Button type="button" size="icon" variant="ghost" onClick={applyRandom}>
                <Dice5 className="h-4 w-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Add inbox tab">
              <Button type="button" size="icon" variant="ghost" onClick={() => local && onAddInbox(local, domain)}>
                <Plus className="h-4 w-4" />
              </Button>
            </Tooltip>
          </div>
        </div>

        <Badge className="hidden border-emerald-500/20 bg-emerald-500/10 text-emerald-300 md:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />
          Auto-expires in {formatCountdown(remaining)}
        </Badge>

        <div className="ml-auto flex shrink-0 items-center gap-1">{actions}</div>
      </div>

      {!compact && (
        <div className="space-y-2.5 border-t border-zinc-800/80 px-3 py-3 md:hidden">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                Username
              </span>
              <Input
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                placeholder="choose a username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="h-12 border-zinc-700 bg-zinc-950 font-mono text-base tracking-wide md:h-12"
              />
            </label>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                Domain
              </span>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="h-12 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-base text-zinc-100 outline-none focus:border-emerald-500/60"
              >
                {domains.map((item) => (
                  <option key={item} value={item} className="bg-zinc-900">
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 truncate font-mono text-xs text-zinc-500">
              {local || "username"}@{domain}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button type="button" variant="secondary" className="h-11" onClick={onCopy} disabled={!active}>
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              Copy
            </Button>
            <Button type="button" variant="secondary" className="h-11" onClick={applyRandom}>
              <Dice5 className="h-4 w-4" />
              New
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={() => local && onAddInbox(local, domain)}>
              <Plus className="h-4 w-4" />
              Use
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
