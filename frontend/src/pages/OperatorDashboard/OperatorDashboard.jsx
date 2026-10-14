import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getOperatorDashboard,
  updateOperatorSlotStatus,
} from "../../services/operatorService";

const statusStyles = {
  AVAILABLE: "bg-green-100 text-green-800",
  OCCUPIED: "bg-red-100 text-red-800",
  RESERVED: "bg-amber-100 text-amber-800",
  MAINTENANCE: "bg-gray-200 text-gray-800",
};

function formatTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
}

function errorMessage(error) {
  const detail = error.response?.data?.detail;
  return typeof detail === "string" ? detail : "The request could not be completed. Please try again.";
}

export default function OperatorDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updatingSlot, setUpdatingSlot] = useState(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [zoneFilter, setZoneFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const dashboard = await getOperatorDashboard();
      setData(dashboard);
      setLastUpdated(new Date());
      setError("");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const refresh = window.setInterval(() => loadDashboard(true), 20000);
    return () => window.clearInterval(refresh);
  }, [loadDashboard]);

  const visibleSlots = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.slots ?? []).filter((slot) => {
      const matchesStatus = statusFilter === "ALL" || slot.status === statusFilter;
      const matchesZone = zoneFilter === "ALL" || slot.zone_id === zoneFilter;
      const matchesSearch = !query || `${slot.slot_number} ${slot.zone_name} ${slot.reserved_vehicle_plate_number ?? ""}`.toLowerCase().includes(query);
      return matchesStatus && matchesZone && matchesSearch;
    });
  }, [data, search, statusFilter, zoneFilter]);

  async function handleSlotStatusChange(slot, status) {
    setUpdatingSlot(slot.id);
    setError("");
    setSuccess("");
    try {
      await updateOperatorSlotStatus(slot.id, status);
      setSuccess(`${slot.zone_name}, slot ${slot.slot_number} is now ${status.toLowerCase()}.`);
      await loadDashboard(true);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setUpdatingSlot(null);
    }
  }

  return (
    <main className="mx-auto min-h-[60vh] max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Operator workspace</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Parking operations</h1>
            <p className="mt-1 text-slate-600">Monitor live occupancy, slot availability, and active sessions.</p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && <p className="text-xs text-slate-500">Updated {lastUpdated.toLocaleTimeString()}</p>}
            <button type="button" onClick={() => loadDashboard()} disabled={loading} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{loading ? "Refreshing…" : "Refresh"}</button>
          </div>
        </div>

        {error && <div className="mb-5 flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 sm:flex-row sm:items-center sm:justify-between" role="alert"><p>{error}</p><button type="button" onClick={() => loadDashboard()} className="font-semibold underline">Retry</button></div>}
        {success && <p className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800" role="status">{success}</p>}

        {loading && !data ? (
          <div className="rounded-xl bg-white p-10 text-center text-slate-600 shadow-sm" role="status" aria-live="polite">Loading parking operations…</div>
        ) : data && (
          <>
            <section aria-label="Parking occupancy summary" className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ["All slots", data.summary.total_slots, "text-slate-900"],
                ["Available", data.summary.available_slots, "text-green-700"],
                ["Occupied", data.summary.occupied_slots, "text-red-700"],
                ["Reserved", data.summary.reserved_slots, "text-amber-700"],
                ["Maintenance", data.summary.maintenance_slots, "text-gray-700"],
              ].map(([label, value, color]) => (
                <article key={label} className="rounded-xl bg-white p-5 shadow-sm">
                  <p className="text-sm font-medium text-slate-500">{label}</p>
                  <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
                </article>
              ))}
            </section>

            <section className="mb-8 rounded-xl bg-white p-5 shadow-sm sm:p-6" aria-labelledby="zones-heading">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 id="zones-heading" className="text-xl font-bold text-slate-900">Zones</h2>
                  <p className="mt-1 text-sm text-slate-500">{data.zones.length} parking {data.zones.length === 1 ? "zone" : "zones"}</p>
                </div>
                <p className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-800">{data.summary.active_sessions} active {data.summary.active_sessions === 1 ? "session" : "sessions"}</p>
              </div>
              {data.zones.length === 0 ? (
                <p className="rounded-lg bg-slate-50 p-5 text-slate-600">No parking zones are configured.</p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.zones.map((zone) => <li key={zone.id} className="rounded-lg border border-slate-200 p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-slate-900">{zone.name}</h3><span className={`rounded-full px-2 py-1 text-xs font-semibold ${zone.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>{zone.is_active ? "Active" : "Inactive"}</span></div><p className="mt-1 text-sm text-slate-600">{zone.location}</p><p className="mt-3 text-sm font-medium text-slate-700">{zone.slot_count} slots</p></li>)}
                </ul>
              )}
            </section>

            <section className="mb-8 rounded-xl bg-white p-5 shadow-sm sm:p-6" aria-labelledby="slots-heading">
              <div className="mb-5">
                <h2 id="slots-heading" className="text-xl font-bold text-slate-900">Manage parking slots</h2>
                <p className="mt-1 text-sm text-slate-500">Set an available slot to maintenance, or return a maintenance slot to service. Sensors and reservations control occupied and reserved slots.</p>
              </div>
              <div className="mb-5 grid gap-3 sm:grid-cols-3">
                <div><label htmlFor="slot-search" className="mb-1 block text-sm font-medium text-slate-700">Search slots</label><input id="slot-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Zone, slot, or plate" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" /></div>
                <div><label htmlFor="slot-status-filter" className="mb-1 block text-sm font-medium text-slate-700">Status</label><select id="slot-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"><option value="ALL">All statuses</option><option value="AVAILABLE">Available</option><option value="OCCUPIED">Occupied</option><option value="RESERVED">Reserved</option><option value="MAINTENANCE">Maintenance</option></select></div>
                <div><label htmlFor="slot-zone-filter" className="mb-1 block text-sm font-medium text-slate-700">Zone</label><select id="slot-zone-filter" value={zoneFilter} onChange={(event) => setZoneFilter(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"><option value="ALL">All zones</option>{data.zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></div>
              </div>
              {visibleSlots.length === 0 ? <p className="rounded-lg bg-slate-50 p-5 text-slate-600">No slots match these filters.</p> : (
                <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleSlots.map((slot) => (
                    <li key={slot.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{slot.zone_name} · {slot.slot_number}</h3><p className="mt-1 text-sm text-slate-500">{slot.is_active ? "In service" : "Inactive slot"}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[slot.status] || "bg-gray-100 text-gray-800"}`}>{slot.status}</span></div>
                      {slot.status === "RESERVED" && <p className="mt-3 text-sm text-slate-600">Reserved for {slot.reserved_vehicle_plate_number || "a driver"}{slot.reservation_expires_at ? ` · expires ${formatTime(slot.reservation_expires_at)}` : ""}</p>}
                      {(slot.status === "AVAILABLE" || slot.status === "MAINTENANCE") && <button type="button" onClick={() => handleSlotStatusChange(slot, slot.status === "AVAILABLE" ? "MAINTENANCE" : "AVAILABLE")} disabled={updatingSlot === slot.id} className="mt-4 w-full rounded-lg border border-blue-700 px-3 py-2 font-semibold text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50">{updatingSlot === slot.id ? "Updating…" : slot.status === "AVAILABLE" ? "Place in maintenance" : "Return to service"}</button>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl bg-white p-5 shadow-sm sm:p-6" aria-labelledby="active-sessions-heading">
              <div className="mb-5"><h2 id="active-sessions-heading" className="text-xl font-bold text-slate-900">Active parking sessions</h2><p className="mt-1 text-sm text-slate-500">Session completion continues to be handled by the parking sensors.</p></div>
              {data.active_sessions.length === 0 ? <p className="rounded-lg bg-slate-50 p-5 text-slate-600">There are no active parking sessions.</p> : (
                <ul className="grid gap-4 md:grid-cols-2">
                  {data.active_sessions.map((session) => <li key={session.id} className="rounded-lg border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-900">{session.vehicle_plate_number || "Vehicle unavailable"}</h3><span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">ACTIVE</span></div><p className="mt-2 text-sm text-slate-700">{session.zone_name || "Zone unavailable"} · Slot {session.slot_number || "unavailable"}</p><p className="mt-1 text-sm text-slate-500">Started {formatTime(session.start_time)}</p></li>)}
                </ul>
              )}
            </section>
          </>
        )}
    </main>
  );
}
