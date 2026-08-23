"use client";

import { Check, ChevronDown, ChevronRight, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { domainCardStartsCollapsed, isDomainVerified } from "@/lib/domains";
import type { DnsRecord, ManagedDomain } from "@/lib/types";

export function DomainCard({
  domain,
  busy,
  onRefresh,
  onVerify,
  onRemove,
}: {
  domain: ManagedDomain;
  busy: boolean;
  onRefresh: (id: string) => void;
  onVerify: (id: string) => void;
  onRemove: (name: string) => void;
}) {
  const [open, setOpen] = useState(() => !domainCardStartsCollapsed(domain));
  const verified = isDomainVerified(domain.status);

  useEffect(() => {
    if (verified) setOpen(false);
  }, [verified]);

  return (
    <div className="space-y-3 border-t border-zinc-800 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="flex items-center gap-1 text-left text-zinc-100"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          {open ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronRight className="h-4 w-4 text-zinc-500" />}
          <strong>{domain.name}</strong>
        </button>
        <span className="text-xs text-zinc-500">
          {domain.status || "added"} · send {domain.sending || "?"} · receive {domain.receiving || "?"}
        </span>
        <div className="ml-auto flex gap-2">
          {domain.resendId && (
            <>
              <button
                type="button"
                className="text-sm underline disabled:opacity-40"
                disabled={busy}
                onClick={() => onRefresh(domain.resendId!)}
              >
                Refresh
              </button>
              {!verified && (
                <button
                  type="button"
                  className="text-sm underline disabled:opacity-40"
                  disabled={busy}
                  onClick={() => onVerify(domain.resendId!)}
                >
                  I added DNS records
                </button>
              )}
            </>
          )}
          <button type="button" className="text-sm text-red-400" onClick={() => onRemove(domain.name)}>
            Remove
          </button>
        </div>
      </div>
      {open && <DomainRecords records={domain.records ?? []} />}
    </div>
  );
}

export function DomainRecords({ records }: { records: DnsRecord[] }) {
  if (!records.length) {
    return <p className="text-sm text-zinc-500">No DNS records yet. Add the domain in Resend first.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full text-left text-xs">
        <thead className="bg-zinc-900 text-zinc-500">
          <tr>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Value</th>
            <th className="px-3 py-2">Priority</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {records.map((record, i) => (
            <RecordRow key={`${record.name}-${record.type}-${i}`} record={record} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecordRow({ record }: { record: DnsRecord }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(record.value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }
  return (
    <tr className="border-t border-zinc-800 align-top">
      <td className="px-3 py-2 font-medium text-zinc-200">{record.type}</td>
      <td className="px-3 py-2 font-mono text-zinc-400">{record.name}</td>
      <td className="max-w-[280px] px-3 py-2 break-all font-mono text-zinc-300">{record.value}</td>
      <td className="px-3 py-2 text-zinc-500">{record.priority ?? "—"}</td>
      <td className="px-3 py-2 text-zinc-500">{record.status ?? "—"}</td>
      <td className="px-3 py-2">
        <button type="button" onClick={copy} className="text-zinc-500 hover:text-zinc-200">
          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
        </button>
      </td>
    </tr>
  );
}
