"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { randomLocalPart } from "@/lib/random";

const STORAGE_KEY = "tm.addresses";
const ACTIVE_KEY = "tm.active";
const CREATED_KEY = "tm.createdAt";
const DEFAULT_TTL_SECONDS = 86400;

export function isAddressFresh(createdAt: number | undefined, ttlSeconds: number, now: number): boolean {
  if (!createdAt) return true;
  return createdAt + ttlSeconds * 1000 > now;
}

export function pruneExpiredAddressTabs(
  list: string[],
  times: Record<string, number>,
  ttlSeconds: number,
  now = Date.now(),
): { addresses: string[]; createdAt: Record<string, number> } {
  const addresses = list.filter((email) => isAddressFresh(times[email], ttlSeconds, now));
  const createdAt: Record<string, number> = {};
  for (const email of addresses) {
    if (times[email]) createdAt[email] = times[email];
  }
  return { addresses, createdAt };
}

export function useAddresses(domains: string[], opts?: { enabled?: boolean; ttlSeconds?: number }) {
  const enabled = opts?.enabled !== false;
  const ttlSeconds = opts?.ttlSeconds && opts.ttlSeconds > 0 ? opts.ttlSeconds : DEFAULT_TTL_SECONDS;
  const [addresses, setAddresses] = useState<string[]>([]);
  const [active, setActive] = useState<string>("");
  const [createdAt, setCreatedAt] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const tabsRef = useRef({ addresses, createdAt, active });
  const ttlRef = useRef(ttlSeconds);
  tabsRef.current = { addresses, createdAt, active };
  ttlRef.current = ttlSeconds;

  useEffect(() => {
    if (!enabled) {
      setAddresses([]);
      setActive("");
      setCreatedAt({});
      setReady(true);
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as string[];
      const current = localStorage.getItem(ACTIVE_KEY) || "";
      const times = JSON.parse(localStorage.getItem(CREATED_KEY) || "{}") as Record<string, number>;
      const pruned = pruneExpiredAddressTabs(
        Array.isArray(saved) ? saved : [],
        times && typeof times === "object" ? times : {},
        ttlRef.current,
      );
      setAddresses(pruned.addresses);
      setCreatedAt(pruned.createdAt);
      setActive(pruned.addresses.includes(current) ? current : pruned.addresses[0] || "");
    } catch {
      setAddresses([]);
    } finally {
      setReady(true);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !ready) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      const { addresses: list, createdAt: times, active: current } = tabsRef.current;
      const pruned = pruneExpiredAddressTabs(list, times, ttlRef.current, now);
      const sameList =
        pruned.addresses.length === list.length && pruned.addresses.every((email, i) => email === list[i]);
      const sameTimes =
        Object.keys(pruned.createdAt).length === Object.keys(times).length &&
        Object.keys(pruned.createdAt).every((email) => pruned.createdAt[email] === times[email]);
      if (!sameList) setAddresses(pruned.addresses);
      if (!sameTimes) setCreatedAt(pruned.createdAt);
      if (current && !pruned.addresses.includes(current)) {
        setActive(pruned.addresses[0] || "");
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [enabled, ready]);

  useEffect(() => {
    if (!enabled || !ready) return;
    if (active && !addresses.includes(active)) {
      setActive(addresses[0] || "");
    }
  }, [addresses, active, enabled, ready]);

  useEffect(() => {
    if (!ready || !enabled) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses));
    localStorage.setItem(ACTIVE_KEY, active);
    localStorage.setItem(CREATED_KEY, JSON.stringify(createdAt));
  }, [addresses, active, createdAt, ready, enabled]);

  const addAddress = useCallback((local: string, domain: string) => {
    const email = `${local.toLowerCase()}@${domain.toLowerCase()}`;
    setAddresses((prev) => (prev.includes(email) ? prev : [email, ...prev]));
    setCreatedAt((prev) => (prev[email] ? prev : { ...prev, [email]: Date.now() }));
    setActive(email);
    return email;
  }, []);

  const generate = useCallback(
    (domain: string) => addAddress(randomLocalPart(addresses), domain),
    [addAddress, addresses],
  );

  const removeAddress = useCallback((email: string) => {
    setAddresses((prev) => {
      const next = prev.filter((item) => item !== email);
      setActive((current) => (current === email ? next[0] || "" : current));
      return next;
    });
    setCreatedAt((prev) => {
      const next = { ...prev };
      delete next[email];
      return next;
    });
  }, []);

  useEffect(() => {
    if (!enabled || !ready || addresses.length > 0 || domains.length === 0) return;
    generate(domains[0]);
  }, [ready, addresses.length, domains, generate, enabled]);

  return { addresses, active, setActive, addAddress, generate, removeAddress, createdAt, ready };
}
