import { useEffect, useState } from "react";
import api from "../../services/api";

export default function ParkingSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/parking-sessions/");

      const data = Array.isArray(response.data)
        ? response.data
        : response.data.results || [];

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

  function formatDate(date) {
    if (!date) return "-";

    return new Date(date).toLocaleString();
  }

  function formatCost(cost) {
    if (cost === null || cost === undefined) {
      return "0.00";
    }

    return Number(cost).toFixed(2);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-xl bg-white p-10 text-center shadow">
            <p className="text-gray-500">
              Loading parking sessions...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Parking Sessions
          </h1>

          <p className="mt-2 text-gray-600">
            View and manage your parking sessions.
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
          <div className="rounded-xl bg-white p-10 text-center shadow">
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
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="rounded-xl bg-white p-6 shadow transition hover:shadow-lg"
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
                      {session.duration_minutes ?? 0} minutes
                    </p>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-500">
                      Total Cost
                    </p>

                    <p className="text-2xl font-bold text-green-600">
                      {formatCost(session.total_cost)} RWF
                    </p>
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}