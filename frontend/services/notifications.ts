import api from "./api";
import type { NotificationItem } from "@/types";

export async function getNotifications(
  limit = 20,
): Promise<NotificationItem[]> {
  const { data } = await api.get<NotificationItem[]>("/notifications", {
    params: { limit },
  });
  return data;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.post(`/notifications/mark-read/${id}`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post("/notifications/mark-all-read");
}
