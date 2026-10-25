import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";

function formatUpdatedAt(value) {
  if (!value) return "Availability refreshes as operators update their spaces.";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Availability refreshes as operators update their spaces."
    : `Checked ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

export default function ParkingPreview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const hasLoaded = useRef(false);

  useEffect(() => {
    let active = true;
    const loadLocations = () => api.get("/parking/locations/")
      .then(({ data: result }) => {
        if (active) {
          setData(result);
          hasLoaded.current = true;
          setError(false);
        }
      })
      .catch(() => { if (active && !hasLoaded.current) setError(true); });
    loadLocations();
    const refresh = window.setInterval(loadLocations, 20000);
    return () => {
      active = false;
      window.clearInterval(refresh);
    };
  }, []);

  return (
    <section id="locations" className="bg-slate-50 py-20 sm:py-24" aria-labelledby="locations-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">Plan your arrival</p>
            <h2 id="locations-heading" className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Parking locations and availability</h2>
            <p className="mt-4 leading-7 text-slate-600">Browse active locations and current space counts before you create an account. Operators update availability at each location.</p>
          </div>
          {data?.hourly_rate && <p className="rounded-xl border border-teal-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800">Published rate: {Number(data.hourly_rate).toLocaleString()} {data.currency} per hour</p>}
        </div>

        {error ? (
          <p className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900" role="status">Location availability is temporarily unavailable. You can still create an account and browse spaces in the app.</p>
        ) : !data ? (
          <p className="mt-8 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500" role="status">Loading parking locations…</p>
        ) : data.locations.length === 0 ? (
          <p className="mt-8 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">No active parking locations are listed yet. Please check back soon.</p>
        ) : (
          <>
            <p className="mt-6 text-xs text-slate-500" aria-live="polite">Availability is operator-reported. {formatUpdatedAt(data.updated_at)}</p>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.locations.map((location) => {
                const directions = location.latitude && location.longitude
                  ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${location.latitude},${location.longitude}`)}`
                  : null;
                return (
                  <li key={location.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div><h3 className="text-lg font-bold text-slate-900">{location.name}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{location.location}</p></div>
                      <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${location.available_spaces > 0 ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{location.available_spaces} available</span>
                    </div>
                    {location.description && <p className="mt-4 text-sm leading-6 text-slate-600">{location.description}</p>}
                    <p className="mt-4 text-sm text-slate-500">{location.total_spaces} spaces total</p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link to="/register" className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Reserve a space</Link>
                      {directions && <a href={directions} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Directions</a>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
