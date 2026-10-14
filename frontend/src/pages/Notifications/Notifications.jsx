import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  publishUnreadNotificationCount,
} from "../../services/notificationService";

function formatTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString();
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const [items, count] = await Promise.all([
        getNotifications(),
        getUnreadNotificationCount(),
      ]);
      setNotifications(Array.isArray(items) ? items : []);
      const safeCount = Number.isInteger(count) && count >= 0 ? count : 0;
      setUnreadCount(safeCount);
      publishUnreadNotificationCount(safeCount);
    } catch (requestError) {
      setError(
        requestError.response?.status === 401
          ? "Your session has expired. Please log in again."
          : "Notifications could not be loaded. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  async function handleMarkRead(notification) {
    setUpdatingId(notification.id);
    setError("");
    setSuccess("");
    try {
      const updated = await markNotificationRead(notification.id);
      setNotifications((current) => current.map((item) => item.id === updated.id ? updated : item));
      const nextCount = Math.max(0, unreadCount - 1);
      setUnreadCount(nextCount);
      publishUnreadNotificationCount(nextCount);
      setSuccess("Notification marked as read.");
    } catch {
      setError("That notification could not be updated. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    setError("");
    setSuccess("");
    try {
      await markAllNotificationsRead();
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
      publishUnreadNotificationCount(0);
      setSuccess("All notifications marked as read.");
    } catch {
      setError("Notifications could not be updated. Please try again.");
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link to="/dashboard" className="text-sm font-semibold text-teal-800 hover:underline">&larr; Dashboard</Link>
            <p className="eyebrow mt-6">Your account</p>
            <h1 className="page-title mt-2">Notifications</h1>
            <p className="page-description" aria-live="polite">You have {unreadCount} unread {unreadCount === 1 ? "notification" : "notifications"}.</p>
          </div>
          <button type="button" onClick={handleMarkAllRead} disabled={loading || markingAll || updatingId !== null || unreadCount === 0} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
            {markingAll ? "Updating..." : "Mark all as read"}
          </button>
        </div>

        {error && (
          <div className="mb-5 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <p>{error}</p>
            <button type="button" onClick={loadNotifications} className="shrink-0 font-semibold underline focus-visible:ring-2 focus-visible:ring-red-700">Try again</button>
          </div>
        )}
        {success && <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900" role="status">{success}</p>}

        {loading ? (
          <div className="surface-card p-10 text-center text-slate-600" role="status" aria-live="polite">Loading notifications...</div>
        ) : error ? null : notifications.length === 0 ? (
          <section className="surface-card px-6 py-12 text-center sm:px-10" aria-labelledby="empty-notifications-heading">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-800" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" stroke="currentColor" strokeWidth="1.7"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <h2 id="empty-notifications-heading" className="mt-5 text-xl font-bold text-slate-900">You're all caught up</h2>
            <p className="mt-2 text-slate-600">New in-app notifications will appear here.</p>
          </section>
        ) : (
          <ul className="space-y-4" aria-label="Your notifications">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <article className={`rounded-2xl border bg-white p-5 shadow-sm sm:p-6 ${notification.is_read ? "border-slate-200" : "border-teal-300 ring-1 ring-teal-100"}`}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-900">{notification.title}</h2>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${notification.is_read ? "bg-slate-100 text-slate-700" : "bg-teal-50 text-teal-900"}`}>
                          {notification.is_read ? "Read" : "Unread"}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words leading-6 text-slate-700">{notification.message}</p>
                      <time className="mt-3 block text-sm text-slate-500" dateTime={notification.created_at}>{formatTimestamp(notification.created_at)}</time>
                    </div>
                    {!notification.is_read && (
                      <button type="button" onClick={() => handleMarkRead(notification)} disabled={updatingId !== null || markingAll} className="shrink-0 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-teal-600 hover:bg-teal-50 hover:text-teal-900 focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-50">
                        {updatingId === notification.id ? "Updating..." : "Mark as read"}
                      </button>
                    )}
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
