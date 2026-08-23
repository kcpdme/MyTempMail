import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-base text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 md:h-9 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}
