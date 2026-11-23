"use client";

import { getCompanyLogo, getCompanyName, useCompanySettings } from "@/features/settings/company-settings";
import { useNav } from "@/lib/nav";
import { useAuth } from "@/lib/auth";
import { cn } from "@/shared/utils/cn";
import { initials } from "@/shared/utils/format";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FALLBACK_ICON, NAV_ICONS } from "./icon-map";

function splitBrandName(name: string): string[] {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 2) return words.length ? words : [name];
  const midpoint = Math.ceil(words.length / 2);
  return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")];
}

/**
 * Floating purple icon rail (style.md §7): 88px wide, 32px radius, circular
 * active state, tooltip labels, isolated logout. Bottom pill dock on mobile.
 */
export function Sidebar() {
  const { navigation } = useNav();
  const { logout } = useAuth();
  const pathname = usePathname();
  const { data: companyData } = useCompanySettings();

  const items = navigation.flatMap((section) => section.items);
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  // prefer the most specific match so /inventory/items doesn't also light /inventory
  const activeHref = items
    .filter((item) => isActive(item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const companyName = getCompanyName(companyData?.settings);
  const companyLogo = getCompanyLogo(companyData?.settings);
  const brandLines = splitBrandName(companyName);

  return (
    <>
      {/* Desktop rail — collapsed 84px, expands to 252px on hover (overlay, no reflow).
          `group` drives the label/section fade; each row keeps its icon centered in a 60px
          box so icons never shift as the rail widens. */}
      <aside
        className="group fixed left-6 top-6 bottom-6 z-40 hidden w-[84px] flex-col overflow-hidden rounded-rail bg-[linear-gradient(180deg,var(--grad-brand-from)_0%,var(--grad-brand-to)_100%)] px-3 py-5 shadow-card transition-[width,box-shadow] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:w-[252px] hover:shadow-raised md:flex"
        aria-label="Primary navigation"
      >
        <Link href="/" className="relative mb-3 flex h-12 w-full shrink-0 items-center" aria-label={`${companyName} home`}>
          <span className="flex w-[60px] shrink-0 items-center justify-center">
            <span
              className={cn(
                "flex h-11 w-11 items-center justify-center overflow-hidden rounded-full text-lg font-extrabold shadow-card",
                companyLogo ? "bg-white" : "bg-white/15 text-white",
              )}
            >
              {companyLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={companyLogo} alt="" className="h-full w-full object-contain p-1.5" />
              ) : (
                initials(companyName)
              )}
            </span>
          </span>
          <span className="pointer-events-none absolute left-[60px] flex w-[168px] flex-col text-[15px] font-extrabold leading-[18px] text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-hover:delay-100">
            {brandLines.map((line, index) => (
              <span key={`${line}-${index}`} className="truncate">
                {line}
              </span>
            ))}
          </span>
        </Link>

        <nav className="no-scrollbar -mr-1 flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden pr-1" data-lenis-prevent>
          {navigation.map((section) => (
            <div key={section.title} className="flex flex-col gap-0.5">
              <span className="max-h-0 overflow-hidden whitespace-nowrap pl-[18px] pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45 opacity-0 transition-all duration-200 group-hover:max-h-8 group-hover:opacity-100">
                {section.title}
              </span>
              {section.items.map((item) => {
                const Icon = NAV_ICONS[item.icon] ?? FALLBACK_ICON;
                const active = item.href === activeHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-label={item.label}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group/item relative flex h-11 w-full shrink-0 items-center rounded-[16px] transition-colors duration-150",
                      active ? "bg-white shadow-[0_2px_10px_rgba(28,17,90,0.18)]" : "hover:bg-white/12",
                    )}
                  >
                    <span className="flex w-[60px] shrink-0 items-center justify-center">
                      <Icon
                        className={cn(
                          "h-[22px] w-[22px] transition-opacity",
                          // active sits on a white pill in BOTH themes → fixed dark blue (theme primary-strong flips light in dark mode)
                          active ? "text-[#2f5590] opacity-100" : "text-white opacity-[0.62] group-hover/item:opacity-100",
                        )}
                        strokeWidth={active ? 2 : 1.75}
                        aria-hidden
                      />
                    </span>
                    <span
                      className={cn(
                        "pointer-events-none absolute left-[60px] whitespace-nowrap text-sm opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-hover:delay-75",
                        active ? "font-semibold text-[#2f5590]" : "font-medium text-white/85",
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <button
          onClick={() => void logout()}
          aria-label="Log out"
          className="group/item relative mt-3 flex h-11 w-full shrink-0 items-center rounded-[16px] transition-colors hover:bg-white/10"
        >
          <span className="flex w-[60px] shrink-0 items-center justify-center">
            <LogOut className="h-[22px] w-[22px] text-white opacity-[0.62] transition-opacity group-hover/item:opacity-100" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="pointer-events-none absolute left-[60px] whitespace-nowrap text-sm font-medium text-white/85 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-hover:delay-75">
            Log out
          </span>
        </button>
      </aside>

      {/* Mobile bottom dock: first 5 items */}
      <nav
        className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-pill bg-[linear-gradient(135deg,var(--grad-brand-from)_0%,var(--grad-brand-to)_100%)] px-3 py-2 shadow-raised md:hidden"
        aria-label="Primary navigation"
      >
        {items.slice(0, 5).map((item) => {
          const Icon = NAV_ICONS[item.icon] ?? FALLBACK_ICON;
          const active = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full",
                active ? "bg-primary-deep" : "hover:bg-white/10",
              )}
            >
              <Icon className={cn("h-5 w-5 text-white", active ? "opacity-100" : "opacity-65")} strokeWidth={1.75} aria-hidden />
            </Link>
          );
        })}
      </nav>
    </>
  );
}
