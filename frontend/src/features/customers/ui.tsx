import { Badge } from "@/shared/ui/badge";
import type { CustomerStage } from "./types";

const STAGE_TONE: Record<CustomerStage, "purple" | "green" | "amber" | "coral" | "gray"> = {
  onboarding: "purple",
  active: "green",
  inactive: "gray",
  churned: "coral",
};

export function StageBadge({ stage }: { stage: CustomerStage }) {
  return <Badge tone={STAGE_TONE[stage]}>{stage}</Badge>;
}
