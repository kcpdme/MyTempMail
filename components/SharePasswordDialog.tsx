"use client";

import { Check, Copy, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GUEST_DURATIONS, type GuestDuration } from "@/lib/guest-policy";
import { formatCountdown } from "@/lib/utils";
import type { ShareStatus } from "@/hooks/useShareStatus";

export function SharePasswordDialog({
  open,
  email,
  status,
  defaultDuration,
  domainEnabled,
  onClose,
  onUpdated,
}: {
  open: boolean;
  email: string;
  status: ShareStatus;
  defaultDuration: GuestDuration;
  domainEnabled: boolean;
  onClose: () => void;
  onUpdated: (next: ShareStatus & { password?: string }) => void;
}) {
  const [duration, setDuration] = useState(defaultDuration);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [copied, setCopied] = useState<"password" | "both" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!open) return;
    setDuration(defaultDuration);
    setCustom("");
    setUseCustom(false);
    setRevealed(null);
    setError(null);
    setCopied(null);
  }, [open, email, defaultDuration]);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  const remaining = status.enabled && status.expiresAt ? status.expiresAt - now : 0;
  const live = remaining > 0;

  async function run(action: "create" | "rotate" | "revoke") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          action,
          duration: action !== "revoke" ? duration : undefined,
          password: useCustom && custom.trim() && action !== "revoke" ? custom.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      if (action === "revoke") {
        setRevealed(null);
        onUpdated({ enabled: false });
        toast.success("Guest access revoked");
        return;
      }
      const password = typeof data.password === "string" ? data.password : "";
      setRevealed(password || null);
      onUpdated({
        enabled: Boolean(data.enabled),
        createdAt: data.createdAt,
        expiresAt: data.expiresAt,
        password,
      });
      toast.success(action === "rotate" ? "Password rotated" : "Guest password created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function copy(kind: "password" | "both") {
    if (!revealed) return;
    const value = kind === "both" ? `${email}\n${revealed}` : revealed;
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    toast.success(kind === "both" ? "Address and password copied" : "Password copied");
    window.setTimeout(() => setCopied(null), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="overflow-y-auto md:max-h-[calc(100dvh-2rem)] md:w-[min(440px,calc(100vw-1.5rem))]">
        <div className="flex min-h-full flex-col p-5 md:p-6">
          <DialogTitle className="text-lg font-semibold text-zinc-50">Guest inbox access</DialogTitle>
          <p className="mt-1 font-mono text-sm text-zinc-400">{email || "Select an inbox"}</p>
          <p className="mt-3 text-sm leading-6 text-zinc-500">
            Guests can receive and read this inbox only. The password and guest session expire after the selected duration.
            Revoking or rotating the password ends existing guest sessions.
          </p>

          {live ? (
            <p className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              Guest receive is on. Expires in {formatCountdown(remaining)} ({new Date(status.expiresAt!).toLocaleString()}).
            </p>
          ) : (
            <p className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-400">
              No guest password. Create one to share this inbox.
            </p>
          )}

          {revealed && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-amber-300">
                Copy now — shown once
              </p>
              <div className="break-all rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100">
                {revealed}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => void copy("password")}>
                  {copied === "password" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  Copy password
                </Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => void copy("both")}>
                  {copied === "both" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  Copy both
                </Button>
              </div>
            </div>
          )}

          {!domainEnabled && <p className="mt-4 text-sm text-amber-300">Enable this domain in Settings → Guest email domains before creating or rotating access.</p>}
          <label className="mt-4 block text-sm text-zinc-400">
            Access duration
            <select
              value={duration}
              disabled={busy || !domainEnabled}
              onChange={(event) => setDuration(event.target.value as GuestDuration)}
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-200"
            >
              {GUEST_DURATIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <p className="mt-1 text-xs text-zinc-500">Starts when you create or rotate the password. Six months means six calendar months.</p>

          <label className="mt-4 flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={useCustom}
              onChange={(e) => setUseCustom(e.target.checked)}
              className="rounded border-zinc-600"
            />
            Set my own password
          </label>
          {useCustom && (
            <Input
              className="mt-2"
              type="text"
              autoComplete="off"
              placeholder="At least 8 characters"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          )}

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

          <div className="mt-6 flex flex-col gap-2">
            {live ? (
              <>
                <Button type="button" disabled={busy || !email || !domainEnabled} onClick={() => void run("rotate")}>
                  <KeyRound className="h-4 w-4" />
                  Rotate password
                </Button>
                <Button type="button" variant="danger" disabled={busy || !email} onClick={() => void run("revoke")}>
                  Revoke guest access
                </Button>
              </>
            ) : (
              <Button type="button" disabled={busy || !email || !domainEnabled} onClick={() => void run("create")}>
                <KeyRound className="h-4 w-4" />
                Create guest password
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
