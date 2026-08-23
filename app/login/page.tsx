"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) return "/";
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const res = await fetch("/api/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Login failed");
      return;
    }
    router.replace(safeNext(params.get("next")));
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-400">MyTempMail</p>
      <h1 className="mb-2 text-2xl font-semibold text-zinc-50">Private inbox</h1>
      <p className="mb-6 text-sm text-zinc-500">
        This workspace is locked. Enter the access password to open the inbox. Incoming mail still lands even when nobody
        is signed in.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Access password"
          autoFocus
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button className="w-full">Unlock</Button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
