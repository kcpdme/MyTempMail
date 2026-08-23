"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstallEvent = Event & { prompt: () => Promise<void> };

export function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    if (standalone || sessionStorage.getItem("tm-install-dismissed") === "1") return;

    const onPrompt = (raw: Event) => {
      raw.preventDefault();
      setEvent(raw as InstallEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (hidden || !event) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 rounded-2xl border border-zinc-800 bg-zinc-900/95 p-3 shadow-2xl backdrop-blur md:inset-x-auto md:right-4 md:w-80">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
          <Download className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-100">Install MyTempMail</p>
          <p className="text-xs leading-5 text-zinc-500">Add to your home screen for a full-screen workspace.</p>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={async () => {
                await event.prompt();
                setHidden(true);
              }}
            >
              Install
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                sessionStorage.setItem("tm-install-dismissed", "1");
                setHidden(true);
              }}
            >
              Not now
            </Button>
          </div>
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-zinc-500 hover:text-zinc-200"
          aria-label="Dismiss install prompt"
          onClick={() => {
            sessionStorage.setItem("tm-install-dismissed", "1");
            setHidden(true);
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
