"use client";

import { api } from "@/shared/api/http-client";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { SkeletonRows } from "@/shared/ui/skeleton";
import { cn } from "@/shared/utils/cn";
import { relativeTime } from "@/shared/utils/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellOff, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link_url: string | null;
  is_read: 0 | 1;
  created_at: string;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: () => api.get<{ notifications: Notification[]; unread_count: number }>("notifications.php"),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const markRead = useMutation({
    mutationFn: (id: number) => api.post("notifications.php", { action: "mark_read", id }),
    onSuccess: invalidate,
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post("notifications.php", { action: "mark_all_read" }),
    onSuccess: invalidate,
  });

  const notifications = data?.notifications ?? [];

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h3 className="text-base font-semibold text-foreground">
          Latest notifications
          {data && data.unread_count > 0 ? (
            <span className="ml-2 rounded-pill bg-attention-soft px-2.5 py-0.5 text-xs font-medium text-attention-strong">
              {data.unread_count} unread
            </span>
          ) : null}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => markAllRead.mutate()}
          loading={markAllRead.isPending}
          disabled={!data || data.unread_count === 0}
        >
          <CheckCheck className="h-4 w-4" aria-hidden /> Mark all read
        </Button>
      </div>

      {isLoading ? (
        <SkeletonRows rows={6} />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="You're all caught up"
          hint="Assignments, approvals and alerts will show up here."
        />
      ) : (
        <ul>
          {notifications.map((n) => (
            <li key={n.id}>
              <button
                className={cn(
                  "flex w-full items-start gap-4 px-6 py-4 text-left transition-colors hover:bg-background",
                  n.is_read === 0 && "bg-primary-soft/40",
                )}
                onClick={() => {
                  if (n.is_read === 0) markRead.mutate(n.id);
                  if (n.link_url) router.push(n.link_url);
                }}
              >
                <span
                  className={cn(
                    "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                    n.is_read === 0 ? "bg-primary" : "bg-border",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{n.title}</span>
                  {n.body ? (
                    <span className="mt-0.5 block truncate text-sm text-muted-foreground">{n.body}</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(n.created_at)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
