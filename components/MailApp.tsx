"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ComposeModal } from "@/components/ComposeModal";
import { IdentityBar } from "@/components/IdentityBar";
import { InboxSidebar } from "@/components/InboxSidebar";
import { MessageView } from "@/components/MessageView";
import { SharePasswordDialog } from "@/components/SharePasswordDialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAddresses } from "@/hooks/useAddresses";
import { useConfig } from "@/hooks/useConfig";
import { useInbox } from "@/hooks/useInbox";
import { useSession } from "@/hooks/useSession";
import { useShareStatus } from "@/hooks/useShareStatus";
import { useUnread } from "@/hooks/useUnread";
import { buildForwardDraft, buildReplyDraft, replyHeaders } from "@/lib/reply";
import { displayName } from "@/lib/utils";

function playChime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    /* ignore */
  }
}

export function MailApp() {
  const { config, error: configError } = useConfig();
  const { session, error: sessionError } = useSession();
  const isGuest = session?.role === "guest";
  const domains = config?.domains ?? [];
  const { addresses, active: memberActive, setActive, addAddress, generate, removeAddress, createdAt } = useAddresses(
    domains,
    { enabled: Boolean(session) && !isGuest },
  );
  const active = isGuest ? (session?.email ?? "") : memberActive;
  const visibleAddresses = isGuest && active ? [active] : addresses;
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [notify, setNotify] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const inbox = useInbox(active, autoRefresh);
  const share = useShareStatus(active, Boolean(session) && !isGuest && Boolean(active));
  const unread = useUnread(
    active,
    inbox.messages.map((m) => m.id),
  );
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMode, setComposeMode] = useState<"compose" | "reply" | "forward">("compose");
  const [draft, setDraft] = useState({ to: "", subject: "", body: "" });
  const primed = useRef(false);
  const seenIds = useRef<Set<string>>(new Set());
  const prevEmail = useRef(active);
  const unreadCache = useRef<Record<string, number>>({});

  useEffect(() => {
    if (session?.role === "none") {
      window.location.assign("/login");
    }
  }, [session?.role]);

  useEffect(() => {
    if (!isGuest || !session?.sessionExpiresAt) return;
    const ms = session.sessionExpiresAt - Date.now();
    if (ms <= 0) {
      window.location.assign("/login?reason=session");
      return;
    }
    const id = window.setTimeout(() => {
      window.location.assign("/login?reason=session");
    }, ms);
    return () => window.clearTimeout(id);
  }, [isGuest, session?.sessionExpiresAt]);

  useEffect(() => {
    if (!isGuest) return;
    if (inbox.error === "Unauthorized" || inbox.error === "Forbidden") {
      window.location.assign("/login?reason=session");
    }
  }, [isGuest, inbox.error]);

  useEffect(() => {
    if (prevEmail.current !== active) {
      primed.current = false;
      seenIds.current = new Set();
      prevEmail.current = active;
      setMobileDetail(false);
    }
  }, [active]);

  useEffect(() => {
    const ids = inbox.messages.map((m) => m.id);
    if (!primed.current) {
      primed.current = true;
      seenIds.current = new Set(ids);
      return;
    }
    const newcomers = inbox.messages.filter((m) => !seenIds.current.has(m.id));
    seenIds.current = new Set(ids);
    if (!newcomers.length) return;
    const first = newcomers[0];
    toast("New email", { description: `${displayName(first.from)} · ${first.subject}` });
    playChime();
    if (notify && typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(first.subject, { body: displayName(first.from) });
    }
  }, [inbox.messages, notify]);

  useEffect(() => {
    unreadCache.current[active] = unread.unreadCount;
  }, [active, unread.unreadCount]);

  async function send(input: { from: string; to: string[]; subject: string; text: string }) {
    const headers =
      composeMode === "reply" && inbox.message
        ? replyHeaders(inbox.message.messageId, inbox.message.references)
        : undefined;
    const res = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: input.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        headers,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to send");
      throw new Error(data.error || "Failed to send");
    }
    toast.success("Email sent");
  }

  async function seed() {
    await fetch("/api/dev/seed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: active }),
    });
    await inbox.fetchList({ silent: true });
  }

  function openComposer(mode: "compose" | "reply" | "forward") {
    if (isGuest) return;
    if (mode === "reply" && inbox.message) {
      const next = buildReplyDraft({
        from: inbox.message.from,
        receivedAt: inbox.message.receivedAt,
        subject: inbox.message.subject,
        text: inbox.message.text || inbox.message.snippet,
      });
      setDraft({ to: next.to, subject: next.subject, body: next.quoted });
    } else if (mode === "forward" && inbox.message) {
      const next = buildForwardDraft({
        from: inbox.message.from,
        receivedAt: inbox.message.receivedAt,
        subject: inbox.message.subject,
        text: inbox.message.text || inbox.message.snippet,
      });
      setDraft({ to: next.to, subject: next.subject, body: next.quoted });
    } else {
      setDraft({ to: "", subject: "", body: "" });
    }
    setComposeMode(mode);
    setComposeOpen(true);
  }

  async function copyAddress() {
    if (!active) return;
    await navigator.clipboard.writeText(active);
    setCopied(true);
    toast.success("Address copied");
    window.setTimeout(() => setCopied(false), 1500);
  }

  function logout() {
    const url = isGuest ? "/api/guest" : "/api/access";
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    }).then(() => {
      window.location.assign("/login");
    });
  }

  if (configError || sessionError) {
    return <div className="px-4 py-8 text-red-400">{configError || sessionError}</div>;
  }
  if (!config || !session || session.role === "none") {
    return <div className="px-4 py-8 text-sm text-zinc-500">Loading workspace…</div>;
  }
  if (domains.length === 0 && !isGuest) {
    return (
      <div className="mx-auto max-w-lg p-8 text-sm leading-6 text-zinc-300">
        <h1 className="mb-2 text-xl font-semibold text-zinc-50">No domains yet</h1>
        <p>
          Open{" "}
          <a className="text-emerald-400 underline" href="/settings">
            Settings
          </a>{" "}
          and add a receiving domain.
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex h-dvh overflow-hidden bg-zinc-950 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <IdentityBar
            domains={domains}
            active={active}
            createdAt={createdAt[active]}
            ttlSeconds={config.inboxTtlSeconds}
            copied={copied}
            compact={mobileDetail}
            guest={isGuest}
            sessionExpiresAt={session.sessionExpiresAt}
            shareEnabled={share.status.enabled}
            shareExpiresAt={share.status.expiresAt}
            onCopy={() => void copyAddress()}
            onRandomize={generate}
            onAddInbox={addAddress}
            onCompose={isGuest ? undefined : () => openComposer("compose")}
            onOpenShare={isGuest ? undefined : () => setShareOpen(true)}
            onLogout={config.accessEnabled || isGuest ? logout : undefined}
          />
          {inbox.error && <div className="bg-red-500/10 px-4 py-2 text-sm text-red-300">{inbox.error}</div>}
          <div className="relative grid min-h-0 flex-1 md:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
            <section className={mobileDetail ? "hidden min-h-0 md:block" : "block min-h-0"}>
              <InboxSidebar
                addresses={visibleAddresses}
                active={active}
                messages={inbox.messages}
                selectedId={inbox.selectedId}
                unreadFor={(email) => (email === active ? unread.unreadCount : unreadCache.current[email] ?? 0)}
                isUnread={unread.isUnread}
                loading={inbox.loading}
                autoRefresh={autoRefresh}
                notify={notify}
                mockMode={config.mockMode}
                readOnly={isGuest}
                onSeed={() => void seed()}
                onSelectAddress={isGuest ? () => undefined : setActive}
                onRemoveAddress={removeAddress}
                onSelectMessage={(id) => {
                  unread.markSeen(id);
                  setMobileDetail(true);
                  void inbox.fetchMessage(id);
                }}
                onRefresh={() => void inbox.fetchList({ sync: true })}
                onToggleAuto={() => setAutoRefresh((v) => !v)}
                onToggleNotify={async () => {
                  if (!notify && typeof Notification !== "undefined") {
                    const permission = await Notification.requestPermission();
                    if (permission !== "granted") {
                      toast.error("Notifications were blocked");
                      return;
                    }
                  }
                  setNotify((v) => !v);
                }}
              />
            </section>
            <section className={mobileDetail ? "block min-h-0" : "hidden min-h-0 md:block"}>
              <MessageView
                message={inbox.message}
                readOnly={isGuest}
                onBack={() => {
                  setMobileDetail(false);
                  inbox.clearSelection();
                }}
                onReply={isGuest ? undefined : () => openComposer("reply")}
                onForward={isGuest ? undefined : () => openComposer("forward")}
                onDelete={
                  isGuest
                    ? undefined
                    : () => {
                        if (!inbox.message) return;
                        void inbox.remove(inbox.message.id);
                        setMobileDetail(false);
                        toast("Message deleted");
                      }
                }
                onCopy={(kind) => {
                  if (!inbox.message) return;
                  const value = kind === "html" ? inbox.message.html : inbox.message.text;
                  void navigator.clipboard.writeText(value || "");
                  toast.success(kind === "html" ? "HTML copied" : "Raw text copied");
                }}
              />
            </section>
          </div>
        </div>
        {!isGuest && (
          <ComposeModal
            open={composeOpen}
            mode={composeMode}
            fromOptions={addresses}
            defaultFrom={active}
            initialTo={draft.to}
            initialSubject={draft.subject}
            initialBody={draft.body}
            onClose={() => setComposeOpen(false)}
            onSend={send}
          />
        )}
        {!isGuest && (
          <SharePasswordDialog
            open={shareOpen}
            email={active}
            status={share.status}
            onClose={() => setShareOpen(false)}
            onUpdated={(next) => {
              share.setStatus({ enabled: next.enabled, createdAt: next.createdAt, expiresAt: next.expiresAt });
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
