"use client";

import { Check, Copy, Dice5, Plus, Settings2 } from "lucide-react";
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
  onCopy,
  onRandomize,
  onAddInbox,
  onCompose,
}: {
  domains: string[];
  active: string;
  createdAt?: number;
  ttlSeconds: number;
  copied: boolean;
  onCopy: () => void;
  onRandomize: (domain: string) => string;
  onAddInbox: (local: string, domain: string) => void;
  onCompose: () => void;
}) {
  const [local, setLocal] = useState("");
  const [domain, setDomain] = useState(domains[0] ?? "");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const [user, host] = active.split("@");
    if (user) setLocal(user);
    if (host) setDomain(host);
  }, [active]);

  useEffect(() => {
    if (!domains.includes(domain) && domains[0]) setDomain(domains[0]);
  }, [domain, domains]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = createdAt ? createdAt + ttlSeconds * 1000 - now : ttlSeconds * 1000;

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-zinc-800 bg-zinc-950/90 px-4 py-3 backdrop-blur">
      <div className="mr-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-400">MyTempMail</p>
        <p className="text-xs text-zinc-500">Disposable workspace</p>
      </div>

      <div className="flex min-w-[280px] flex-1 items-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        <Input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder="username"
          className="h-10 border-0 bg-transparent font-mono text-sm focus:ring-0"
        />
        <span className="px-1 text-zinc-500">@</span>
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="h-10 max-w-[180px] bg-transparent px-2 text-sm text-zinc-200 outline-none"
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
          <Tooltip content="Randomize / New">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => {
                const next = onRandomize(domain);
                const [user, host] = next.split("@");
                setLocal(user);
                if (host) setDomain(host);
              }}
            >
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

      <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />
        Auto-expires in {formatCountdown(remaining)}
      </Badge>

      <Button type="button" onClick={onCompose} className="ml-auto">
        <Plus className="h-4 w-4" /> Compose
      </Button>
      <Link href="/settings">
        <Button type="button" variant="ghost" size="icon" aria-label="Settings">
          <Settings2 className="h-4 w-4" />
        </Button>
      </Link>
    </header>
  );
}
