import api from "./api";

export const NOTIFICATION_COUNT_EVENT = "supas:notification-count";

export function publishUnreadNotificationCount(count) {
  window.dispatchEvent(
    new CustomEvent(NOTIFICATION_COUNT_EVENT, { detail: { count } })
  );
}

export async function getNotifications() {
  const response = await api.get("/notifications/");
  return response.data;
}

export async function getUnreadNotificationCount() {
  const response = await api.get("/notifications/unread-count/");
  return response.data.count;
}

export async function markNotificationRead(id) {
  const response = await api.post(`/notifications/${id}/read/`);
  return response.data;
}

export async function markAllNotificationsRead() {
  const response = await api.post("/notifications/read-all/");
  return response.data;
}
