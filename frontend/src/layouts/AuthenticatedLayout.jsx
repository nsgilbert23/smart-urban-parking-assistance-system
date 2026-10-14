import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import {
  getUnreadNotificationCount,
  NOTIFICATION_COUNT_EVENT,
} from "../services/notificationService";

function Brand({ isAdmin }) {
  return (
    <Link to={isAdmin ? "/admin-dashboard" : "/dashboard"} className="flex shrink-0 items-center gap-3" aria-label="SUPAS home">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-lg font-bold text-white shadow-sm">S</span>
      <span className="leading-tight">
        <span className="block text-sm font-extrabold tracking-wide text-slate-900">SUPAS</span>
        <span className="hidden text-xs text-slate-500 sm:block">Smart Urban Parking</span>
      </span>
    </Link>
  );
}

export default function AuthenticatedLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const isAdmin = user?.role === "ADMIN";
  const isOperator = ["OPERATOR", "ADMIN"].includes(user?.role);
  const navItems = isAdmin
    ? [
        { to: "/admin-dashboard", label: "Admin dashboard" },
        { to: "/reports-analytics", label: "Reports & Analytics" },
        { to: "/operator-dashboard", label: "Operations" },
        { to: "/notifications", label: "Notifications", badge: true },
      ]
    : isOperator
    ? [
        { to: "/operator-dashboard", label: "Operations" },
        { to: "/notifications", label: "Notifications", badge: true },
      ]
    : [
        { to: "/dashboard", label: "Overview" },
        { to: "/parking", label: "Find parking" },
        { to: "/vehicles", label: "Vehicles" },
        { to: "/parking-history", label: "History" },
        { to: "/notifications", label: "Notifications", badge: true },
      ];

  useEffect(() => {
    let active = true;
    let eventReceived = false;
    function handleNotificationCount(event) {
      const count = event.detail?.count;
      if (Number.isInteger(count) && count >= 0) {
        eventReceived = true;
        setUnreadCount(count);
      }
    }

    window.addEventListener(NOTIFICATION_COUNT_EVENT, handleNotificationCount);
    getUnreadNotificationCount()
      .then((count) => { if (active && !eventReceived) setUnreadCount(count); })
      .catch(() => { if (active && !eventReceived) setUnreadCount(0); });
    return () => {
      active = false;
      window.removeEventListener(NOTIFICATION_COUNT_EVENT, handleNotificationCount);
    };
  }, []);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 shadow-[0_2px_12px_rgba(20,44,58,0.04)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:flex-nowrap sm:px-6 lg:px-8">
          <Brand isAdmin={user?.role === "ADMIN"} />
          <nav aria-label="Main navigation" className="order-3 -mx-4 flex w-[calc(100%+2rem)] items-center gap-1 overflow-x-auto px-4 pb-1 sm:order-none sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0 sm:pb-0">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `relative flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
              >
                {item.label}
                {item.badge && unreadCount > 0 && (
                  <span aria-label={`${unreadCount} unread`} className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link to="/profile" className="hidden max-w-40 truncate text-sm font-medium text-slate-600 hover:text-teal-800 md:block" title={user?.email}>
              {user?.first_name || "Account"}
            </Link>
            <button type="button" onClick={handleLogout} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-teal-600">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
