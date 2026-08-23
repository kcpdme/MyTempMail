"use client";

import { useCallback, useEffect, useState } from "react";
import { randomLocalPart } from "@/lib/random";

const STORAGE_KEY = "tm.addresses";
const ACTIVE_KEY = "tm.active";
const CREATED_KEY = "tm.createdAt";

export function useAddresses(domains: string[]) {
  const [addresses, setAddresses] = useState<string[]>([]);
  const [active, setActive] = useState<string>("");
  const [createdAt, setCreatedAt] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as string[];
      const current = localStorage.getItem(ACTIVE_KEY) || saved[0] || "";
      const times = JSON.parse(localStorage.getItem(CREATED_KEY) || "{}") as Record<string, number>;
      setAddresses(Array.isArray(saved) ? saved : []);
      setActive(current);
      setCreatedAt(times && typeof times === "object" ? times : {});
    } catch {
      setAddresses([]);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses));
    localStorage.setItem(ACTIVE_KEY, active);
    localStorage.setItem(CREATED_KEY, JSON.stringify(createdAt));
  }, [addresses, active, createdAt, ready]);

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
    if (!ready || addresses.length > 0 || domains.length === 0) return;
    generate(domains[0]);
  }, [ready, addresses.length, domains, generate]);

  return { addresses, active, setActive, addAddress, generate, removeAddress, createdAt, ready };
}
