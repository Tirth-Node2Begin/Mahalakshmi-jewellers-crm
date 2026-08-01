"use client";

import { scrollPageTo } from "@/shared/providers/lenis-provider";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

/** Ignore a few stray pixels so the buttons don't flicker at the very ends. */
const EDGE = 80;
/** Below this much overflow the page is short enough to scroll by hand. */
const MIN_OVERFLOW = 320;

/**
 * Floating "jump to top / jump to bottom" buttons for long pages — a ledger
 * statement runs to hundreds of rows and the closing balance sits at the end.
 *
 * Fixed to the bottom-right, above the mobile bottom bar, hidden when printing.
 * The whole control hides when the page barely scrolls; each button dims and goes
 * inert on reaching its end but stays visible, so the pair never shifts position.
 *
 * The pair sits in a bordered, blurred pill: it floats over table rows, so it has
 * to read as a control rather than as two stray discs on top of the numbers.
 */
export function ScrollToEnds() {
  const [state, setState] = useState({ show: false, atTop: true, atBottom: false });

  useEffect(() => {
    const read = () => {
      const y = window.scrollY;
      const viewport = window.innerHeight;
      const full = document.documentElement.scrollHeight;
      setState({
        show: full - viewport > MIN_OVERFLOW,
        atTop: y <= EDGE,
        atBottom: y + viewport >= full - EDGE,
      });
    };

    read();
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    // Rows arrive after the fetch resolves, so the page height changes without a
    // scroll or resize event — watch the document box itself.
    const observer = new ResizeObserver(read);
    observer.observe(document.body);

    return () => {
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
      observer.disconnect();
    };
  }, []);

  if (!state.show) {
    return null;
  }

  return (
    <div className="fixed bottom-24 right-2 z-30 flex flex-col gap-1 rounded-full border border-border bg-card/90 p-1 shadow-raised backdrop-blur print:hidden md:bottom-8 md:right-3">
      <Button
        variant="ghost"
        size="iconSm"
        aria-label="Scroll to top of page"
        disabled={state.atTop}
        onClick={() => scrollPageTo("top")}
        className={cn("transition-opacity", state.atTop && "pointer-events-none opacity-35")}
      >
        <ArrowUp className="h-4 w-4" aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="iconSm"
        aria-label="Scroll to bottom of page"
        disabled={state.atBottom}
        onClick={() => scrollPageTo("bottom")}
        className={cn("transition-opacity", state.atBottom && "pointer-events-none opacity-35")}
      >
        <ArrowDown className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}
