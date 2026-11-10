"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "@/lib/format";

export function NavLink({ href, exact, children, mobile }: { href: string; exact?: boolean; children: ReactNode; mobile?: boolean }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  if (mobile) {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cx(
          "flex flex-col items-center justify-center gap-0.5 py-2 text-[12px] leading-4 font-medium min-w-0 flex-1",
          active ? "text-cane-700" : "text-stone-500",
        )}
      >
        <span className={cx("h-1 w-8 rounded-full mb-1", active ? "bg-cane-700" : "bg-transparent")} aria-hidden />
        <span className="truncate max-w-full">{children}</span>
      </Link>
    );
  }
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex items-center rounded-md px-3 py-2.5 text-[15px] leading-5",
        active ? "bg-white/10 text-white font-medium" : "text-cane-100 hover:bg-white/5 hover:text-white",
      )}
    >
      {children}
    </Link>
  );
}
