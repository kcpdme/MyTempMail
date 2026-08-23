export function replySubject(subject: string): string {
  const trimmed = subject.trim() || "(no subject)";
  return /^re:\s/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}

export function quotePrevious(from: string, date: string, text: string): string {
  const body = (text || "").replace(/\s+$/, "") || "(empty message)";
  return `\n\n--- Original Message ---\nFrom: ${from}\nDate: ${date}\n\n${body}`;
}

export function buildReplyDraft(input: {
  from: string;
  receivedAt: string;
  subject: string;
  text: string;
}): { to: string; subject: string; quoted: string } {
  return {
    to: input.from,
    subject: replySubject(input.subject),
    quoted: quotePrevious(input.from, input.receivedAt, input.text),
  };
}

export function forwardSubject(subject: string): string {
  const trimmed = subject.trim() || "(no subject)";
  return /^fwd:\s/i.test(trimmed) ? trimmed : `Fwd: ${trimmed}`;
}

export function buildForwardDraft(input: {
  from: string;
  receivedAt: string;
  subject: string;
  text: string;
}): { to: string; subject: string; quoted: string } {
  return {
    to: "",
    subject: forwardSubject(input.subject),
    quoted: `\n\n--- Original Message ---\nFrom: ${input.from}\nDate: ${input.receivedAt}\nSubject: ${input.subject}\n\n${input.text || "(empty message)"}`,
  };
}

export function replyHeaders(messageId: string, references?: string): Record<string, string> {
  const id = messageId.trim();
  if (!id) return {};
  const refs = [references?.trim(), id].filter(Boolean).join(" ");
  return {
    "In-Reply-To": id,
    References: refs,
  };
}
