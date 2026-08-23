"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SettingsLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Login failed");
      return;
    }
    router.replace("/settings");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-400">MyTempMail</p>
      <h1 className="mb-4 text-2xl font-semibold text-zinc-50">Settings login</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Use <code>SETTINGS_SECRET</code>. In mock mode with no secret, settings are open.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Settings password"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button className="w-full">Continue</Button>
      </form>
    </div>
  );
}
