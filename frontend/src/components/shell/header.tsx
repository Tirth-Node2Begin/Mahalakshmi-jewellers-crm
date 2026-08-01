"use client";

import { useAuth } from "@/lib/auth";
import { api } from "@/shared/api/http-client";
import { Avatar } from "@/shared/ui/avatar";
import { cn } from "@/shared/utils/cn";
import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronDown, LogOut, Moon, Sun, UserRound } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePageHeaderOverride } from "./page-header";

/**
 * The heading for every static route: [path, title, subtitle?]. First match wins,
 * so deeper paths come before their parents.
 *
 * This is the only place a page title is written. Pages do NOT render their own
 * <h1> — one heading per screen (see page-header.tsx). Data-driven headings
 * (a ledger name, a report name) override this via usePageHeader().
 */
const PAGE_TITLES: Array<[RegExp, string, string?]> = [
  [/^\/$/, "Dashboard"],
  [/^\/rates/, "Today's Rates", "Rate per gram used for new bills."],
  [/^\/customers\/detail/, "Customer"],
  [/^\/customers/, "Customers"],
  [/^\/estimates\/create/, "New Estimate", "Nothing is sold and no stock moves until this becomes a bill."],
  [/^\/estimates\/detail/, "Estimate"],
  [/^\/estimates/, "Estimates", "A price slip for the customer — nothing is sold until it becomes a bill."],
  [/^\/invoices\/create/, "New Bill"],
  [/^\/invoices\/detail/, "Bill"],
  [/^\/invoices/, "Bills"],
  [/^\/payments/, "Payments"],
  [/^\/purchases\/create/, "New Purchase", "Record what you bought — it goes straight into your stock."],
  [/^\/purchases\/detail/, "Purchase"],
  [/^\/purchases/, "Purchases"],
  [/^\/accounting\/ledger/, "Ledger"],
  [/^\/accounting/, "Accounts", "Chart of accounts and ledger statements."],
  [/^\/vendors\/payments/, "Vendor Payments"],
  [/^\/vendors\/detail/, "Supplier"],
  [/^\/vendors/, "Suppliers & Makers"],
  [/^\/expenses\/insights/, "Expense Insights"],
  [/^\/expenses\/monthly/, "Fixed Costs"],
  [/^\/expenses\/categories/, "Expense Categories"],
  [/^\/expenses/, "Expenses"],
  [/^\/inventory\/items/, "Items"],
  [/^\/inventory\/detail/, "Item"],
  [/^\/inventory\/movements/, "Stock Movements"],
  [
    /^\/inventory\/adjust/,
    "Correct Stock",
    "Use this only when the shelf and the computer disagree — every correction is signed with your name and reason.",
  ],
  [/^\/inventory/, "Stock in Hand", "Everything on the shelf right now, metal by metal."],
  [/^\/reports\/pnl/, "Profit & Loss"],
  [/^\/reports/, "Reports"],
  [/^\/notifications/, "Notifications"],
  [/^\/profile/, "My Profile"],
  [/^\/settings\/users/, "Users"],
  [/^\/settings\/roles/, "Roles & Permissions"],
  [/^\/settings\/audit/, "Audit Log", "Everything staff changed, and when."],
  [/^\/settings\/company/, "Company Profile"],
  [/^\/settings\/bank-accounts/, "Bank Accounts"],
  [/^\/settings/, "Settings"],
];

export function Header() {
  const { user, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  // trailingSlash:true → normalise "/invoices/" to "/invoices" so the anchored
  // PAGE_TITLES regexes and the "/" dashboard check still match.
  const pathname = (usePathname() ?? "/").replace(/\/+$/, "") || "/";
  const override = usePageHeaderOverride();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  const { data: notif } = useQuery({
    queryKey: ["notifications", "badge"],
    queryFn: () => api.get<{ unread_count: number }>("notifications.php"),
    refetchInterval: 60_000,
  });

  const route = PAGE_TITLES.find(([re]) => re.test(pathname));
  const title = override?.title ?? route?.[1] ?? "Mahalakshmi Jewellers";
  const subtitle = override?.title ? override.subtitle : route?.[2];
  const unread = notif?.unread_count ?? 0;
  const isDashboard = pathname === "/";
  const firstName = user?.full_name?.split(" ")[0] ?? "";

  return (
    <header className="flex items-start justify-between gap-4 py-8">
      <div className="min-w-0">
        {isDashboard && firstName ? (
          <p className="text-xs font-medium tracking-[0.4px] text-muted-foreground">
            Welcome back, <span className="font-semibold text-foreground">{firstName}</span>
          </p>
        ) : (
          <p className="text-xs font-medium uppercase tracking-[0.4px] text-muted-foreground">
            Mahalakshmi Jewellers CRM
          </p>
        )}
        <h1 className="truncate text-[28px] font-bold leading-9 text-foreground">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {mounted ? (
          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground hover:shadow-card"
          >
            {resolvedTheme === "dark" ? (
              <Sun className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            ) : (
              <Moon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            )}
          </button>
        ) : null}

        <Link
          href="/notifications"
          aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground hover:shadow-card"
        >
          <Bell className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-pill bg-attention px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 rounded-pill p-1 pr-2 transition-colors hover:bg-card hover:shadow-card"
          >
            <Avatar name={user?.full_name ?? "?"} color={user?.avatar_color} size={40} />
            <ChevronDown
              className={cn("h-4 w-4 text-muted-foreground transition-transform", menuOpen && "rotate-180")}
              aria-hidden
            />
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-2 w-56 rounded-input border border-border bg-card p-2 shadow-raised"
            >
              <div className="border-b border-border px-3 pb-2 pt-1">
                <p className="truncate text-sm font-semibold text-foreground">{user?.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email ?? user?.username}</p>
              </div>
              <Link
                href="/profile"
                role="menuitem"
                className="mt-1 flex h-10 items-center gap-3 rounded-[12px] px-3 text-sm text-body hover:bg-primary-soft hover:text-primary-strong"
              >
                <UserRound className="h-4 w-4" strokeWidth={1.75} aria-hidden /> My profile
              </Link>
              <button
                role="menuitem"
                onClick={() => void logout()}
                className="flex h-10 w-full items-center gap-3 rounded-[12px] px-3 text-sm text-attention-strong hover:bg-attention-soft"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden /> Log out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
