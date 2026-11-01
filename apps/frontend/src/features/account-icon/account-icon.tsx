import { cn } from "@/lib/utils";

import { readAccountIcon } from "./account-icon-meta";

interface AccountIconProps {
  meta?: string | null;
  className?: string;
}

/** Decorative: the account name is always shown next to it. */
export function AccountIcon({ meta, className }: AccountIconProps) {
  const src = readAccountIcon(meta);
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn("size-6 shrink-0 rounded-full object-cover", className)}
    />
  );
}
