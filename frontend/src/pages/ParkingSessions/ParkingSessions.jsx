import { useEffect, useState } from "react";
import { getParkingSessions, getSessionPaymentStatus } from "../../services/parkingService";

export default function ParkingSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      getParkingSessions().then(setSessions).catch(() => {});
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  async function loadSessions() {
    try {
      setLoading(true);
      setError("");

      const data = await getParkingSessions();
      setSessions(data);
    } catch (error) {
      console.error("Failed to load parking sessions:", error);

      if (error.response?.status === 401) {
        setError("Your session has expired. Please log in again.");
      } else {
        setError("Failed to load parking sessions.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const pending = sessions.filter((session) => session.latest_mobile_money_status?.status === "PENDING");
    if (!pending.length) return undefined;
    const timer = window.setInterval(async () => {
      const results = await Promise.all(pending.map(async (session) => [session.id, await getSessionPaymentStatus(session.id).catch(() => null)]));
      const updates = new Map(results);
      setSessions((current) => current.map((session) => {
        const update = updates.get(session.id);
        if (!update || session.latest_mobile_money_status?.provider !== update.provider) return session;
        return { ...session, payment_status: update.payment_status, latest_mobile_money_status: { ...session.latest_mobile_money_status, status: update.status, message: update.message } };
      }));
    }, 8000);
    return () => window.clearInterval(timer);
  }, [sessions]);

  function formatDate(date) {
    if (!date) return "Not recorded";

    return new Date(date).toLocaleString();
  }

  function formatCost(cost) {
    if (cost === null || cost === undefined) {
      return "Not recorded";
    }

    return Number(cost).toFixed(2);
  }

  function formatDuration(minutes) {
    const safeMinutes = Math.max(0, minutes);
    const hours = Math.floor(safeMinutes / 60);
    const remainingMinutes = safeMinutes % 60;
    return hours ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="surface-card p-10 text-center">
            <p className="text-slate-500" role="status">
              Loading parking sessions...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-8">
          <p className="eyebrow">Driver workspace</p>
          <h1 className="page-title mt-2">
            Parking Sessions
          </h1>

          <p className="page-description mt-2">
            Monitor active parking and review your session details.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* No sessions */}
        {!error && sessions.length === 0 && (
          <div className="surface-card p-10 text-center">
            <div className="text-5xl">🅿️</div>

            <h2 className="mt-4 text-2xl font-semibold text-gray-900">
              No parking sessions yet
            </h2>

            <p className="mt-2 text-gray-500">
              Your parking sessions will appear here when you start parking.
            </p>
          </div>
        )}

        {/* Sessions */}
        {sessions.length > 0 && (
          <>
          <div className="surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] divide-y divide-slate-200 text-left">
                <caption className="sr-only">Your parking sessions, time estimates, charges, and payment status</caption>
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600"><tr>{["Status", "Vehicle", "Zone / space", "Planned stay", "Time used / remaining", "Parking fee", "Payment"].map((heading) => <th key={heading} scope="col" className="px-4 py-3">{heading}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                  {sessions.map((session) => {
                    const active = session.status === "ACTIVE";
                    const elapsed = active ? Math.max(0, Math.ceil((now - new Date(session.start_time).getTime()) / 60000)) : session.duration_minutes;
                    const remaining = active && session.estimated_duration_minutes != null ? session.estimated_duration_minutes - elapsed : null;
                    const fee = active ? Math.max(0, elapsed - (session.grace_period_minutes || 0)) * Number(session.cost_per_hour || 0) / 60 : session.total_cost;
                    const payment = session.payment_status === "PAID" ? `Paid by ${session.payment_method === "MTN_MOMO" ? "MTN MoMo" : session.payment_method === "AIRTEL_MONEY" ? "Airtel Money" : session.payment_method === "MOBILE_MONEY" ? "mobile money" : "cash"}` : session.latest_mobile_money_status?.status === "PENDING" ? "Prompt sent · approve on your phone" : session.latest_mobile_money_status?.status === "FAILED" || session.payment_status === "FAILED" ? "Payment failed · contact operator" : active ? "Paid when operator confirms exit" : "Pending operator follow-up";
                    return <tr key={session.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-green-100 text-green-800" : session.status === "COMPLETED" ? "bg-blue-100 text-blue-800" : session.status === "EXPIRED" ? "bg-amber-100 text-amber-900" : "bg-red-100 text-red-800"}`}>{session.status}</span></td>
                      <td className="px-4 py-4"><p className="font-semibold text-slate-900">{session.vehicle_plate_number || "Unknown vehicle"}</p><p className="mt-1 text-xs text-slate-500">Started {formatDate(session.start_time)}</p></td>
                      <td className="px-4 py-4">{session.zone_name || "Unknown zone"}<p className="mt-1 text-xs text-slate-500">Space {session.slot_number || "Unknown"}{active ? ` · ${session.slot_status || "OCCUPIED"}` : ""}</p></td>
                      <td className="px-4 py-4">{session.estimated_duration_minutes == null ? "Not set" : formatDuration(session.estimated_duration_minutes)}<p className="mt-1 text-xs text-slate-500">{session.pricing_rule_name || "Default pricing"}</p></td>
                      <td className="px-4 py-4">{active ? <><p className="font-semibold text-slate-900">{formatDuration(elapsed)} used</p>{remaining == null ? <p className="mt-1 text-xs text-slate-500">No estimate set</p> : <p className={`mt-1 text-xs font-semibold ${remaining < 0 ? "text-amber-800" : "text-teal-800"}`}>{remaining < 0 ? `${formatDuration(Math.abs(remaining))} past estimate` : `${formatDuration(remaining)} remaining`}</p>}</> : <><p>{elapsed == null ? "Not recorded" : `${elapsed} minutes used`}</p><p className="mt-1 text-xs text-slate-500">Ended {formatDate(session.end_time)}</p></>}</td>
                      <td className="px-4 py-4 font-bold text-slate-900">{fee == null ? "Not recorded" : `${formatCost(fee)} RWF${active ? " est." : ""}`}</td>
                      <td className="max-w-xs px-4 py-4"><p className="font-medium">{payment}</p>{session.latest_mobile_money_status?.message && <p className="mt-1 text-xs text-slate-500">{session.latest_mobile_money_status.message}</p>}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="hidden">
            {sessions.map((session) => (
              <article
                key={session.id}
                className="surface-card p-6"
              >
                {/* Status */}
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">
                    Parking Session
                  </h2>

                  <span
                    className={`rounded-full px-3 py-1 text-sm font-semibold ${
                      session.status === "ACTIVE"
                        ? "bg-green-100 text-green-700"
                        : session.status === "COMPLETED"
                        ? "bg-blue-100 text-blue-700"
                        : session.status === "EXPIRED"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {session.status}
                  </span>
                </div>

                {/* Details */}
                <div className="mt-6 space-y-3">

                  <div>
                    <p className="text-sm text-gray-500">
                      Vehicle
                    </p>

                    <p className="font-semibold">
                      {session.vehicle_plate_number || "Unknown vehicle"}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">
                      Parking Slot
                    </p>

                    <p className="font-semibold">
                      {session.slot_number || "Unknown slot"}
                    </p>
                  </div>

                  {session.estimated_duration_minutes != null && (
                    <div>
                      <p className="text-sm text-gray-500">Planned parking time</p>
                      <p className="font-semibold">{formatDuration(session.estimated_duration_minutes)}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-sm text-gray-500">Parking Zone</p>
                    <p className="font-semibold">{session.zone_name || "Unknown zone"}</p>
                  </div>

                  {session.status === "ACTIVE" && session.estimated_duration_minutes != null && (() => {
                    const elapsed = Math.max(0, Math.ceil((now - new Date(session.start_time).getTime()) / 60000));
                    const remaining = session.estimated_duration_minutes - elapsed;
                    return <div className={`rounded-lg p-3 ${remaining < 0 ? "bg-amber-50" : "bg-teal-50"}`}><p className="text-sm text-gray-600">Time used · {formatDuration(elapsed)}</p><p className={`text-lg font-bold ${remaining < 0 ? "text-amber-800" : "text-teal-800"}`}>{remaining < 0 ? `Past estimate by ${formatDuration(Math.abs(remaining))}` : `${formatDuration(remaining)} remaining`}</p></div>;
                  })()}

                  {session.status === "ACTIVE" && (
                    <div>
                      <p className="text-sm text-gray-500">Parking status</p>
                      <p className="font-semibold">{session.slot_status || "OCCUPIED"}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-sm text-gray-500">
                      Pricing Rule
                    </p>

                    <p className="font-semibold">
                      {session.pricing_rule_name || "Default pricing"}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">
                      Start Time
                    </p>

                    <p className="font-semibold">
                      {formatDate(session.start_time)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">
                      End Time
                    </p>

                    <p className="font-semibold">
                      {formatDate(session.end_time)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">
                      Duration
                    </p>

                    <p className="font-semibold">
                      {session.status === "ACTIVE"
                        ? `${Math.max(0, Math.ceil((now - new Date(session.start_time).getTime()) / 60000))} minutes (elapsed)`
                        : session.duration_minutes == null
                          ? "Not recorded"
                          : `${session.duration_minutes} minutes`}
                    </p>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-500">
                      Total Cost
                    </p>

                    <p className="text-2xl font-bold text-green-600">
                      {session.status === "ACTIVE"
                        ? `${formatCost(Math.max(0, Math.ceil((now - new Date(session.start_time).getTime()) / 60000) - (session.grace_period_minutes || 0)) * Number(session.cost_per_hour || 0) / 60)} RWF (estimated)`
                        : session.total_cost == null
                          ? "Not recorded"
                          : `${formatCost(session.total_cost)} RWF`}
                    </p>
                  </div>

                  {session.status === "ACTIVE" && (
                    <p className="border-t pt-4 text-sm text-blue-700">
                      The operator confirms your departure and records the final payment.
                    </p>
                  )}

                  {session.status === "COMPLETED" && (
                    <div className="border-t pt-4">
                      <p className="text-sm text-gray-500">Payment</p>
                      <p className="font-semibold">{session.payment_status === "PAID" ? `Paid by ${session.payment_method === "MTN_MOMO" ? "MTN MoMo" : session.payment_method === "AIRTEL_MONEY" ? "Airtel Money" : session.payment_method === "MOBILE_MONEY" ? "mobile money" : "cash"}` : session.latest_mobile_money_status?.status === "PENDING" ? "Payment prompt sent. Approve it on your phone." : session.latest_mobile_money_status?.status === "FAILED" || session.payment_status === "FAILED" ? "Payment failed. Please contact the parking operator." : "Pending operator follow-up"}</p>
                      {session.latest_mobile_money_status?.message && <p className="mt-1 text-sm text-gray-600">{session.latest_mobile_money_status.message}</p>}
                    </div>
                  )}

                </div>
              </article>
            ))}
          </div>
          </>
        )}
      </div>
    </div>
  );
}
