"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/notifications";

const queryKey = ["notifications", "list"] as const;

export function useNotifications(limit = 20) {
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: [...queryKey, limit],
    queryFn: () => getNotifications(limit),
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((item) => !item.read).length;

  return {
    notifications,
    unreadCount,
    isLoading: notificationsQuery.isLoading,
    markAsRead: (id: string) => markReadMutation.mutate(id),
    markAllAsRead: () => markAllReadMutation.mutate(),
  };
}
