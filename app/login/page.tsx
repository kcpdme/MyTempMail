"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PublicConfig } from "@/lib/types";

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) return "/";
  return raw;
}

function reasonCopy(reason: string | null): string | null {
  if (reason === "session") {
    return "Session ended. Sign in again as guest if the inbox password is still valid.";
  }
  return null;
}

function LoginForms() {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<"member" | "guest">(params.get("reason") === "session" ? "guest" : "member");
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [memberPassword, setMemberPassword] = useState("");
  const [local, setLocal] = useState("");
  const [domain, setDomain] = useState("");
  const [guestPassword, setGuestPassword] = useState("");
  const [memberError, setMemberError] = useState<string | null>(null);
  const [guestError, setGuestError] = useState<string | null>(null);
  const notice = reasonCopy(params.get("reason"));

  useEffect(() => {
    void fetch("/api/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.role === "member" || data.role === "guest") {
          router.replace(safeNext(params.get("next")));
        }
      })
      .catch(() => undefined);
    void fetch("/api/config")
      .then((res) => res.json())
      .then((data: PublicConfig) => {
        setConfig(data);
        setDomain((current) => current || data.domains[0] || "");
      })
      .catch(() => undefined);
  }, [params, router]);

  function guestEmail(): string {
    const raw = local.trim();
    if (raw.includes("@")) return raw.toLowerCase();
    if (!domain) return raw;
    return `${raw.toLowerCase()}@${domain.toLowerCase()}`;
  }

  async function submitMember(event: FormEvent) {
    event.preventDefault();
    setMemberError(null);
    const res = await fetch("/api/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: memberPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMemberError(data.error || "Login failed");
      return;
    }
    router.replace(safeNext(params.get("next")));
  }

  async function submitGuest(event: FormEvent) {
    event.preventDefault();
    setGuestError(null);
    const res = await fetch("/api/guest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: guestEmail(), password: guestPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      setGuestError(data.error || "Login failed");
      return;
    }
    router.replace("/");
  }

  const domains = config?.domains ?? [];

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col justify-center px-4 py-[max(1.5rem,env(safe-area-inset-top))]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-400">MyTempMail</p>
      <h1 className="mb-2 text-2xl font-semibold text-zinc-50">Sign in</h1>
      <p className="mb-6 max-w-2xl text-sm text-zinc-500">
        Members unlock the full workspace. Guests enter an inbox address and password to receive mail for that inbox
        only.
      </p>
      {notice && (
        <p className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {notice}
        </p>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2 md:hidden">
        <Button type="button" variant={tab === "member" ? "default" : "secondary"} onClick={() => setTab("member")}>
          Member
        </Button>
        <Button type="button" variant={tab === "guest" ? "default" : "secondary"} onClick={() => setTab("guest")}>
          Guest
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 md:grid md:grid-cols-2">
        <section className={`space-y-4 p-5 md:block md:border-r md:border-zinc-800 md:p-8 ${tab === "member" ? "block" : "hidden"}`}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Member login</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-50">Workspace</h2>
            <p className="mt-1 text-sm text-zinc-500">Full inbox, compose, and guest-password controls.</p>
          </div>
          <form onSubmit={submitMember} className="space-y-3">
            <Input
              type="password"
              value={memberPassword}
              onChange={(e) => setMemberPassword(e.target.value)}
              placeholder="Access password"
              autoComplete="current-password"
            />
            {memberError && <p className="text-sm text-red-400">{memberError}</p>}
            <Button className="w-full">Unlock workspace</Button>
          </form>
        </section>

        <section className={`space-y-4 bg-zinc-900/40 p-5 md:block md:p-8 ${tab === "guest" ? "block" : "hidden"}`}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400/80">Guest login</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-50">Read inbox</h2>
            <p className="mt-1 text-sm text-zinc-500">Receive-only. Session closes after 30 minutes.</p>
          </div>
          <form onSubmit={submitGuest} className="space-y-3">
            <div className="flex overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
              <Input
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                placeholder="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                className="border-0 focus:ring-0"
              />
              {domains.length > 0 && !local.includes("@") && (
                <>
                  <span className="flex items-center text-zinc-500">@</span>
                  <select
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="max-w-[42%] bg-transparent px-2 text-sm text-zinc-200 outline-none"
                  >
                    {domains.map((item) => (
                      <option key={item} value={item} className="bg-zinc-900">
                        {item}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
            <Input
              type="password"
              value={guestPassword}
              onChange={(e) => setGuestPassword(e.target.value)}
              placeholder="Inbox password"
              autoComplete="current-password"
            />
            {guestError && <p className="text-sm text-red-400">{guestError}</p>}
            <Button className="w-full" variant="secondary">
              Open inbox
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForms />
    </Suspense>
  );
}
