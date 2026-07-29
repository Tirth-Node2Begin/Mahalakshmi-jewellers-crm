"use client";

import { ExecutiveDashboard } from "@/features/dashboard/variants/executive";
import { InventoryDashboard } from "@/features/dashboard/variants/inventory";
import { SalesDashboard } from "@/features/dashboard/variants/sales";
import { dashboardApi } from "@/features/reports/api";
import { SkeletonCard } from "@/shared/ui/skeleton";
import { useQuery } from "@tanstack/react-query";

export default function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => dashboardApi.get(12) });

  return (
    <div className="space-y-6">
      {isLoading || !data ? (
        <SkeletonCard />
      ) : data.variant === "inventory" ? (
        <InventoryDashboard data={data} />
      ) : data.variant === "sales" ? (
        <SalesDashboard data={data} />
      ) : (
        <ExecutiveDashboard data={data} />
      )}
    </div>
  );
}
