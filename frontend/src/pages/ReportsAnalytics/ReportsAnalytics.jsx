import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getReportsAnalytics } from "../../services/reportsService";

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMoney(value) {
  const amount = Number(value);
  return `RWF ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}`;
}

function Metric({ label, value, detail, color = "text-slate-900" }) {
  return (
    <article className="surface-card p-5 sm:p-6">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold tracking-tight ${color}`}>{value}</p>
      {detail && <p className="mt-1 text-sm text-slate-500">{detail}</p>}
    </article>
  );
}

export default function ReportsAnalytics() {
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 29);
  const [range, setRange] = useState({ start_date: toInputDate(monthAgo), end_date: toInputDate(today) });
  const [appliedRange, setAppliedRange] = useState(range);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReport = useCallback(async (filters) => {
    setLoading(true);
    setError("");
    try {
      setData(await getReportsAnalytics(filters));
    } catch {
      setError("Reports could not be loaded. Check the selected date range and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport(appliedRange);
  }, [loadReport, appliedRange]);

  function handleFilterSubmit(event) {
    event.preventDefault();
    setAppliedRange({ ...range });
  }

  const daily = data?.daily ?? [];
  const maxRevenue = Math.max(...daily.map((item) => Number(item.revenue) || 0), 0);
  const labelInterval = Math.max(1, Math.ceil(daily.length / 12));

  return (
    <main className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link to="/admin-dashboard" className="text-sm font-semibold text-teal-800 hover:underline">&larr; Admin dashboard</Link>
            <p className="eyebrow mt-5">Performance overview</p>
            <h1 className="page-title mt-2">Reports &amp; Analytics</h1>
            <p className="page-description">Review parking activity, completed session value, and zone capacity.</p>
          </div>
        </div>

        <form onSubmit={handleFilterSubmit} className="surface-card mb-6 grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end" aria-label="Filter report date range">
          <div><label htmlFor="report-start-date" className="mb-1 block text-sm font-medium text-slate-700">From</label><input id="report-start-date" type="date" value={range.start_date} max={range.end_date} onChange={(event) => setRange((current) => ({ ...current, start_date: event.target.value }))} required className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></div>
          <div><label htmlFor="report-end-date" className="mb-1 block text-sm font-medium text-slate-700">To</label><input id="report-end-date" type="date" value={range.end_date} min={range.start_date} max={toInputDate(today)} onChange={(event) => setRange((current) => ({ ...current, end_date: event.target.value }))} required className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></div>
          <button type="submit" disabled={loading} className="rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-900 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:opacity-50">{loading ? "Loading..." : "Apply filters"}</button>
        </form>

        {error && <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert"><p>{error}</p><button type="button" onClick={() => loadReport(appliedRange)} className="font-semibold underline">Try again</button></div>}
        {loading && !data ? <div className="surface-card p-10 text-center text-slate-600" role="status" aria-live="polite">Loading reports...</div> : data && (
          <>
            <p className="mb-4 text-sm text-slate-500" aria-live="polite">Showing {data.filters.start_date} through {data.filters.end_date}</p>
            <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Report summary">
              <Metric label="Parking sessions" value={data.summary.total_sessions} detail={`${data.summary.completed_sessions} completed`} />
              <Metric label="Completed session value" value={formatMoney(data.summary.completed_revenue)} color="text-teal-800" />
              <Metric label="Average completed value" value={formatMoney(data.summary.average_completed_session_value)} />
              <Metric label="Active sessions started in period" value={data.summary.active_sessions} detail={`${data.summary.cancelled_sessions} cancelled · ${data.summary.expired_sessions} expired in range`} color="text-blue-800" />
            </section>

            <section className="surface-card mb-8 p-5 sm:p-6" aria-labelledby="revenue-trend-heading">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div><h2 id="revenue-trend-heading" className="text-lg font-bold text-slate-900">Daily completed session value</h2><p className="mt-1 text-sm text-slate-500">Recorded parking charges by session start date, in RWF.</p></div>
                {maxRevenue > 0 && <p className="text-sm font-semibold text-teal-800">Peak day: {formatMoney(maxRevenue)}</p>}
              </div>
              {maxRevenue === 0 ? <p className="rounded-lg bg-slate-50 p-6 text-center text-slate-600">No completed session value was recorded in this date range.</p> : (
                <div className="overflow-x-auto pb-2">
                  <div className="flex h-56 min-w-full items-end gap-2 border-b border-l border-slate-200 px-2 sm:gap-3" style={{ minWidth: `${Math.max(daily.length * 24, 600)}px` }} role="img" aria-label="Bar chart showing daily completed parking session value">
                    {daily.map((item, index) => {
                      const amount = Number(item.revenue) || 0;
                      const height = amount > 0 ? Math.max(3, (amount / maxRevenue) * 100) : 0;
                      return <div key={item.date} className="flex h-full min-w-4 flex-1 flex-col items-center justify-end gap-2" title={`${item.date}: ${formatMoney(amount)}`}><div className="w-full rounded-t bg-teal-600 transition hover:bg-teal-800" style={{ height: `${height}%` }} /><span className="h-5 whitespace-nowrap text-[10px] text-slate-500">{index % labelInterval === 0 ? item.date.slice(5) : ""}</span></div>;
                    })}
                  </div>
                </div>
              )}
            </section>

            <section className="surface-card p-5 sm:p-6" aria-labelledby="zone-report-heading">
              <div className="mb-4"><h2 id="zone-report-heading" className="text-lg font-bold text-slate-900">Zone performance</h2><p className="mt-1 text-sm text-slate-500">Current space status with sessions in the selected period.</p></div>
              {!data.zones.length ? <p className="rounded-lg bg-slate-50 p-6 text-center text-slate-600">No parking zones are configured.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th scope="col" className="px-3 py-3">Zone</th><th scope="col" className="px-3 py-3">Spaces</th><th scope="col" className="px-3 py-3">Occupied / available</th><th scope="col" className="px-3 py-3">Sessions</th><th scope="col" className="px-3 py-3 text-right">Completed value</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.zones.map((zone) => <tr key={zone.id} className="text-slate-700"><th scope="row" className="px-3 py-3 font-semibold text-slate-900">{zone.name}<span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${zone.is_active ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{zone.is_active ? "Active" : "Inactive"}</span></th><td className="px-3 py-3">{zone.slot_count} <span className="text-slate-500">({zone.reserved_slots} reserved, {zone.maintenance_slots} maintenance)</span></td><td className="px-3 py-3">{zone.occupied_slots} / {zone.available_slots}</td><td className="px-3 py-3">{zone.sessions}</td><td className="px-3 py-3 text-right">{formatMoney(zone.completed_revenue)}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
