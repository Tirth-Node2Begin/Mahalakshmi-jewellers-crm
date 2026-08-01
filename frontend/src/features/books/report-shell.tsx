"use client";

import { usePageHeader } from "@/components/shell/page-header";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input, Label } from "@/shared/ui/input";
import { SkeletonCard } from "@/shared/ui/skeleton";
import { cn } from "@/shared/utils/cn";
import { formatDate } from "@/shared/utils/format";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Download, Printer } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { RANGE_PRESETS, activePreset } from "./report-utils";

/**
 * The chrome every financial report shares: a way back, date controls, Print and
 * Download CSV. Everything here is `print:hidden` — only the sheet below it (see
 * PrintSheet) reaches the paper.
 *
 * The title/subtitle are pushed to the shell header rather than printed here, so
 * a report shows one heading like every other screen.
 */
export function ReportToolbar({
  title,
  subtitle,
  backHref = "/reports",
  backLabel = "Reports",
  children,
}: {
  title: string;
  subtitle: string;
  /** Where the back arrow goes. Defaults to the reports hub. */
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
}) {
  usePageHeader(title, subtitle);

  return (
    <div className="space-y-3 print:hidden">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary-strong"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to {backLabel}
      </Link>
      <div className="flex flex-wrap items-end gap-3">
        <div className="ml-auto flex flex-wrap items-end gap-2">{children}</div>
      </div>
    </div>
  );
}

/** Preset buttons + From/To inputs. `idPrefix` keeps the labels unique per page. */
export function DateRangeControls({
  idPrefix,
  from,
  to,
  onChange,
}: {
  idPrefix: string;
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
}) {
  const active = activePreset(from, to);
  return (
    <>
      {RANGE_PRESETS.map((p) => (
        <Button
          key={p.key}
          variant={active === p.key ? "primary" : "secondary"}
          size="sm"
          onClick={() => onChange(p.range())}
        >
          {p.label}
        </Button>
      ))}
      <div>
        <Label htmlFor={`${idPrefix}-from`}>From</Label>
        <Input
          id={`${idPrefix}-from`}
          type="date"
          value={from}
          onChange={(e) => onChange({ from: e.target.value, to })}
          className="h-10 w-40"
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-to`}>To</Label>
        <Input
          id={`${idPrefix}-to`}
          type="date"
          value={to}
          onChange={(e) => onChange({ from, to: e.target.value })}
          className="h-10 w-40"
        />
      </div>
    </>
  );
}

/** A single date field — for as-at and day-wise reports. */
export function SingleDateControl({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-44" />
    </div>
  );
}

export function PrintButton({ disabled }: { disabled?: boolean }) {
  return (
    <Button variant="secondary" size="sm" onClick={() => window.print()} disabled={disabled}>
      <Printer className="h-4 w-4" aria-hidden /> Print
    </Button>
  );
}

export function CsvButton({ disabled, onDownload }: { disabled?: boolean; onDownload: () => void }) {
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={disabled}
      onClick={() => {
        try {
          onDownload();
        } catch {
          toast.error("Could not build the file. Please try again.");
        }
      }}
    >
      <Download className="h-4 w-4" aria-hidden /> Download CSV
    </Button>
  );
}

/**
 * Loading / failed / empty, in that order, so no page repeats the three-way
 * branch. Messages are written for a jeweller, not a developer.
 */
export function ReportState({
  isLoading,
  isError,
  isEmpty,
  icon,
  errorTitle = "We could not load this report",
  errorHint = "Check your internet connection and try again in a moment.",
  emptyTitle,
  emptyHint,
  skeletonLines = 10,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  icon: LucideIcon;
  errorTitle?: string;
  errorHint?: string;
  emptyTitle: string;
  emptyHint: string;
  skeletonLines?: number;
  children: ReactNode;
}) {
  if (isLoading) return <SkeletonCard lines={skeletonLines} />;
  if (isError) {
    return (
      <Card>
        <EmptyState icon={icon} title={errorTitle} hint={errorHint} />
      </Card>
    );
  }
  if (isEmpty) {
    return (
      <Card>
        <EmptyState icon={icon} title={emptyTitle} hint={emptyHint} />
      </Card>
    );
  }
  return <>{children}</>;
}

/**
 * The printable sheet. `.print-invoice` is the app's existing print isolation
 * hook (globals.css) — on Print only this element reaches the paper.
 */
export function PrintSheet({
  title,
  from,
  to,
  asOf,
  className,
  children,
}: {
  title: string;
  from?: string;
  to?: string;
  /** Use instead of from/to for a single-date report. */
  asOf?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("print-invoice p-0", className)}>
      <div className="border-b border-border px-6 py-5 text-center">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">
          {asOf ? formatDate(asOf) : `${formatDate(from)} – ${formatDate(to)}`}
        </p>
      </div>
      {children}
    </Card>
  );
}
