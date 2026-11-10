import type { ReactNode } from "react";
import Link from "next/link";
import type { SessionUser } from "@/lib/auth/session";
import { ROLE_LABEL, isStageRole } from "@/lib/workflow";
import { initials } from "@/lib/format";
import { NavLink } from "./NavLink";
import { logoutAction } from "@/actions/auth";

type Item = { href: string; label: string; exact?: boolean };

export function navFor(user: SessionUser): Item[] {
  if (user.role === "ADMIN") {
    return [
      { href: "/admin", label: "Overview", exact: true },
      { href: "/entries", label: "All entries" },
      { href: "/admin/users", label: "Users" },
      { href: "/admin/harvesters", label: "Harvesters" },
      { href: "/admin/banks", label: "Banks" },
      { href: "/admin/cbcs", label: "CBCs & zones" },
    ];
  }
  if (user.role === "SCOUT") {
    return [
      { href: "/entries/new", label: "New entry" },
      { href: "/entries", label: "My entries", exact: true },
    ];
  }
  if (isStageRole(user.role)) {
    return [
      { href: "/queue", label: "My queue" },
      { href: "/completed", label: "Completed" },
    ];
  }
  return [];
}

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-white">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden className="shrink-0">
        <rect x="11" y="2" width="6" height="24" rx="3" fill="#8DB890" />
        <rect x="9.5" y="9" width="9" height="2.2" rx="1.1" fill="#163A21" />
        <rect x="9.5" y="17" width="9" height="2.2" rx="1.1" fill="#163A21" />
        <path d="M14 2 C 10 6, 6 7, 3 6 C 6 10, 10 9, 14 6 Z" fill="#DDEADD" />
      </svg>
      <span className="font-bold tracking-tight leading-none">
        Cane Permit Tracker
        <span className="block text-[11px] font-normal text-cane-200 mt-1">Angata Sugar Mills</span>
      </span>
    </Link>
  );
}

export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const items = navFor(user);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      {/* Desktop rail */}
      <aside className="hidden lg:flex lg:flex-col bg-cane-800 text-white px-4 py-5 sticky top-0 h-dvh">
        <Wordmark />
        <nav className="mt-8 flex flex-col gap-1" aria-label="Main">
          {items.map((i) => (
            <NavLink key={i.href} href={i.href} exact={i.exact}>
              {i.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto pt-6 border-t border-white/10">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-cane-600 text-sm font-bold">{initials(user.name)}</span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium leading-5">{user.name}</p>
              <p className="truncate text-[13px] text-cane-200">{ROLE_LABEL[user.role]}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-1 text-[13px]">
            <Link href="/account" className="rounded px-2 py-1.5 text-cane-100 hover:bg-white/10">Password</Link>
            <form action={logoutAction}>
              <button className="rounded px-2 py-1.5 text-cane-100 hover:bg-white/10">Sign out</button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-20 bg-cane-800 text-white" style={{ paddingTop: "var(--safe-top)" }}>
          <div className="flex items-center justify-between px-4 h-14">
            <Wordmark />
            <div className="flex items-center gap-2">
              <Link href="/account" className="grid h-9 w-9 place-items-center rounded-full bg-cane-600 text-sm font-bold" aria-label="Account">
                {initials(user.name)}
              </Link>
              <form action={logoutAction}>
                <button className="text-[13px] text-cane-100 px-2 py-1.5">Sign out</button>
              </form>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8 pb-24 lg:pb-8">
          <div className="mx-auto w-full max-w-[1120px]">{children}</div>
        </main>

        {/* Mobile bottom tabs */}
        {items.length > 0 && (
          <nav
            className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-stone-200 flex"
            style={{ paddingBottom: "var(--safe-bottom)" }}
            aria-label="Main"
          >
            {items.slice(0, 5).map((i) => (
              <NavLink key={i.href} href={i.href} exact={i.exact} mobile>
                {i.label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
