"use client";

import { LedgerStatementView } from "@/features/accounting/ledger-statement";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { ScrollToEnds } from "@/shared/ui/scroll-to-ends";
import { SkeletonCard } from "@/shared/ui/skeleton";
import { localDateString } from "@/shared/utils/format";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

/** Indian fiscal year: 1 Apr → 31 Mar. */
function fiscalYear(d = new Date()) {
  const startYear = d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1;
  return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` };
}

function LedgerInner() {
  const params = useSearchParams();
  const id = Number(params.get("id"));
  const fy = fiscalYear();

  // the accounts page passes its own dates through, so the statement opens on
  // the range the user was already looking at
  const [range, setRange] = useState({
    from: params.get("from") || fy.from,
    to: params.get("to") || localDateString(),
  });

  const validId = Number.isFinite(id) && id > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link
          href="/accounting"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary-strong"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Accounts
        </Link>
        <Button variant="secondary" size="sm" className="ml-auto" onClick={() => window.print()} disabled={!validId}>
          <Printer className="h-4 w-4" aria-hidden /> Print
        </Button>
      </div>

      <Card className="print-invoice">
        {validId ? (
          <LedgerStatementView ledgerId={id} from={range.from} to={range.to} onRangeChange={setRange} />
        ) : (
          <p className="text-sm text-muted-foreground">Pick a ledger from the Accounts page to see its statement.</p>
        )}
      </Card>

      {/* A statement can run to hundreds of rows — jump to either end. */}
      <ScrollToEnds />
    </div>
  );
}

export default function LedgerStatementPage() {
  return (
    <Suspense fallback={<SkeletonCard lines={10} />}>
      <LedgerInner />
    </Suspense>
  );
}
