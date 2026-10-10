import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getParkingSessions } from "../../services/parkingService";

const statusStyles = {
  ACTIVE: "bg-green-100 text-green-800",
  COMPLETED: "bg-blue-100 text-blue-800",
  EXPIRED: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-red-100 text-red-800",
};

function formatDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString();
}

function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return "Not recorded";
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours} hr`;
  return `${hours} hr ${remainingMinutes} min`;
}

function formatCost(value) {
  if (value === null || value === undefined) return "Not recorded";
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toFixed(2)} RWF` : "Not recorded";
}

export default function ParkingHistory() {
  const [filters, setFilters] = useState({ status: "", start_date: "", end_date: "" });
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    async function loadHistory() {
      setLoading(true);
      setError("");
      try {
        const query = Object.fromEntries(
          Object.entries(filters).filter(([, value]) => value)
        );
        const data = await getParkingSessions(query);
        if (current) setSessions(data);
      } catch (requestError) {
        if (current) {
          setError(
            requestError.response?.status === 401
              ? "Your session has expired. Please log in again."
              : "Parking history could not be loaded. Please try again."
          );
        }
      } finally {
        if (current) setLoading(false);
      }
    }
    loadHistory();
    return () => { current = false; };
  }, [filters]);

  const completedSessions = sessions.filter((session) => session.status === "COMPLETED");
  const recordedCompletedCost = completedSessions.every((session) => session.total_cost !== null && session.total_cost !== undefined)
    ? completedSessions.reduce((total, session) => total + Number(session.total_cost), 0)
    : null;

  function updateFilter(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7">
          <Link to="/dashboard" className="text-sm font-semibold text-blue-700 hover:underline">← Dashboard</Link>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">Parking History</h1>
          <p className="mt-2 text-gray-600">Review your parking sessions, including sessions that are still active.</p>
        </div>

        <section className="mb-6 rounded-xl bg-white p-5 shadow-sm" aria-label="Filter parking history">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="history-status" className="mb-2 block text-sm font-medium text-gray-700">Status</label>
              <select id="history-status" name="status" value={filters.status} onChange={updateFilter} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200">
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
                <option value="EXPIRED">Expired</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div>
              <label htmlFor="history-start-date" className="mb-2 block text-sm font-medium text-gray-700">From date</label>
              <input id="history-start-date" name="start_date" type="date" value={filters.start_date} onChange={updateFilter} className="w-full rounded-lg border border-gray-300 px-3 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label htmlFor="history-end-date" className="mb-2 block text-sm font-medium text-gray-700">To date</label>
              <input id="history-end-date" name="end_date" type="date" value={filters.end_date} onChange={updateFilter} className="w-full rounded-lg border border-gray-300 px-3 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div className="flex items-end">
              <button type="button" onClick={() => setFilters({ status: "", start_date: "", end_date: "" })} disabled={!hasFilters} className="w-full rounded-lg border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">Clear filters</button>
            </div>
          </div>
        </section>

        {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800" role="alert">{error}</div>}

        {loading ? (
          <div className="rounded-xl bg-white p-10 text-center shadow-sm" role="status" aria-live="polite">Loading parking history…</div>
        ) : !error && sessions.length === 0 ? (
          <section className="rounded-xl bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">{hasFilters ? "No sessions match these filters" : "No parking history yet"}</h2>
            <p className="mt-2 text-gray-600">{hasFilters ? "Try changing or clearing your filters." : "Your parking sessions will appear here when you start parking."}</p>
          </section>
        ) : !error && (
          <>
            <section className="mb-6 grid gap-4 sm:grid-cols-2" aria-label="Parking history summary">
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-gray-500">Sessions shown</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{sessions.length}</p>
              </div>
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-gray-500">Completed sessions · recorded cost</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{completedSessions.length === 0 ? "No completed sessions" : recordedCompletedCost === null ? "Incomplete cost records" : `${recordedCompletedCost.toFixed(2)} RWF`}</p>
                <p className="mt-1 text-xs text-gray-500">{completedSessions.length} completed {completedSessions.length === 1 ? "session" : "sessions"} in the current results</p>
              </div>
            </section>

            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Parking sessions">
              {sessions.map((session) => (
                <article key={session.id} className="rounded-xl bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{session.vehicle_plate_number || "Vehicle not available"}</h2>
                      <p className="mt-1 text-sm text-gray-600">{session.zone_name || "Zone not available"} · Slot {session.slot_number || "not available"}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[session.status] || "bg-gray-100 text-gray-800"}`}>{session.status}</span>
                  </div>
                  <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
                    <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Started</dt><dd className="mt-1 break-words text-sm text-gray-900">{formatDate(session.start_time)}</dd></div>
                    <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Ended</dt><dd className="mt-1 break-words text-sm text-gray-900">{formatDate(session.end_time)}</dd></div>
                    <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Recorded duration</dt><dd className="mt-1 text-sm text-gray-900">{session.status === "ACTIVE" && session.duration_minutes == null ? "In progress" : formatDuration(session.duration_minutes)}</dd></div>
                    <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Recorded cost</dt><dd className="mt-1 text-sm font-semibold text-gray-900">{session.status === "ACTIVE" && session.total_cost == null ? "Not finalized" : formatCost(session.total_cost)}</dd></div>
                  </dl>
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
