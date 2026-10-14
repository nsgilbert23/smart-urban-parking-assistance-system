import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  createAdminSlot,
  createAdminZone,
  getAdminDashboard,
  searchOpenStreetMapPlaces,
  updateAdminZone,
} from "../../services/adminService";

function MetricCard({ label, value, detail, accent = "text-slate-900" }) {
  return (
    <article className="surface-card p-5 sm:p-6">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold tracking-tight ${accent}`}>{value}</p>
      {detail && <p className="mt-1 text-sm text-slate-500">{detail}</p>}
    </article>
  );
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

function formatAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0.00";
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [zoneForm, setZoneForm] = useState({
    name: "", location: "", description: "", latitude: "", longitude: "",
  });
  const [placeResults, setPlaceResults] = useState([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState("");
  const [slotForm, setSlotForm] = useState({ zone: "", slot_number: "" });
  const [editZoneForm, setEditZoneForm] = useState({
    zone: "", name: "", location: "", description: "", latitude: "", longitude: "",
  });
  const [editPlaceResults, setEditPlaceResults] = useState([]);
  const [editPlacesLoading, setEditPlacesLoading] = useState(false);
  const [editPlacesError, setEditPlacesError] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getAdminDashboard());
      setUpdatedAt(new Date());
    } catch (requestError) {
      setError(requestError.response?.status === 403
        ? "Administrator access is required to view this dashboard."
        : "The admin dashboard could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const summary = data?.summary;
  const occupiedPercent = summary?.total_slots
    ? Math.round((summary.occupied_slots / summary.total_slots) * 100)
    : 0;

  async function handleCreateZone(event) {
    event.preventDefault();
    setSaving(true);
    setActionError("");
    setActionSuccess("");
    try {
      const zone = await createAdminZone({
        ...zoneForm,
        latitude: zoneForm.latitude || null,
        longitude: zoneForm.longitude || null,
      });
      setZoneForm({ name: "", location: "", description: "", latitude: "", longitude: "" });
      setPlaceResults([]);
      if (!slotForm.zone) setSlotForm((current) => ({ ...current, zone: zone.id }));
      await loadDashboard();
      setActionSuccess(`Zone “${zone.name}” was created.`);
    } catch (requestError) {
      const detail = requestError.response?.data;
      setActionError(typeof detail === "string" ? detail : "The zone could not be created. Check the details and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePlaceSearch(event) {
    event.preventDefault();
    const query = zoneForm.location.trim() || zoneForm.name.trim();
    if (!query) {
      setPlacesError("Enter a zone name or location to search the map.");
      return;
    }

    setPlacesLoading(true);
    setPlacesError("");
    setPlaceResults([]);
    try {
      const results = await searchOpenStreetMapPlaces(query);
      setPlaceResults(results);
      if (!results.length) setPlacesError("No matching places found. Try adding a street, district, or city.");
    } catch {
      setPlacesError("Map search is temporarily unavailable. You can still enter coordinates manually.");
    } finally {
      setPlacesLoading(false);
    }
  }

  function selectPlace(feature) {
    const [longitude, latitude] = feature.geometry.coordinates;
    const properties = feature.properties;
    const address = [
      properties.name,
      properties.housenumber && properties.street
        ? `${properties.housenumber} ${properties.street}`
        : properties.street,
      properties.locality || properties.district || properties.city,
      properties.state,
      properties.country,
    ].filter((part, index, parts) => part && parts.indexOf(part) === index);
    setZoneForm((current) => ({
      ...current,
      location: address.join(", ") || current.location,
      latitude: Number(latitude).toFixed(6),
      longitude: Number(longitude).toFixed(6),
    }));
    setPlaceResults([]);
    setPlacesError("");
  }

  const selectedZoneCoordinates = Number.isFinite(Number(zoneForm.latitude))
    && Number.isFinite(Number(zoneForm.longitude))
    && zoneForm.latitude !== ""
    && zoneForm.longitude !== "";
  const mapMarker = selectedZoneCoordinates
    ? `${zoneForm.latitude},${zoneForm.longitude}`
    : "";
  const mapBounds = selectedZoneCoordinates
    ? `${Number(zoneForm.longitude) - 0.015},${Number(zoneForm.latitude) - 0.01},${Number(zoneForm.longitude) + 0.015},${Number(zoneForm.latitude) + 0.01}`
    : "";
  const mapPreviewUrl = selectedZoneCoordinates
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(mapBounds)}&layer=mapnik&marker=${encodeURIComponent(mapMarker)}`
    : "";

  async function handleCreateSlot(event) {
    event.preventDefault();
    setSaving(true);
    setActionError("");
    setActionSuccess("");
    try {
      const slot = await createAdminSlot(slotForm);
      setSlotForm((current) => ({ ...current, slot_number: "" }));
      await loadDashboard();
      setActionSuccess(`Space ${slot.slot_number} was added to ${slot.zone_name}.`);
    } catch (requestError) {
      const detail = requestError.response?.data;
      setActionError(typeof detail === "string" ? detail : "The space could not be created. Check the zone and space number.");
    } finally {
      setSaving(false);
    }
  }

  function handleEditZoneChange(zoneId) {
    const zone = data.zones.find((item) => item.id === zoneId);
    setEditZoneForm({
      zone: zoneId,
      name: zone?.name ?? "",
      location: zone?.location ?? "",
      description: zone?.description ?? "",
      latitude: zone?.latitude ?? "",
      longitude: zone?.longitude ?? "",
    });
    setEditPlaceResults([]);
    setEditPlacesError("");
  }

  async function handleEditPlaceSearch(event) {
    event.preventDefault();
    const query = editZoneForm.location.trim() || editZoneForm.name.trim();
    if (!query) {
      setEditPlacesError("Enter a zone name or location to search the map.");
      return;
    }
    setEditPlacesLoading(true);
    setEditPlacesError("");
    setEditPlaceResults([]);
    try {
      const results = await searchOpenStreetMapPlaces(query);
      setEditPlaceResults(results);
      if (!results.length) setEditPlacesError("No matching places found. Try adding a street, district, or city.");
    } catch {
      setEditPlacesError("Map search is temporarily unavailable. You can still update the zone manually.");
    } finally {
      setEditPlacesLoading(false);
    }
  }

  function selectEditPlace(feature) {
    const [longitude, latitude] = feature.geometry.coordinates;
    const p = feature.properties;
    const address = [
      p.name,
      p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street,
      p.locality || p.district || p.city,
      p.state,
      p.country,
    ].filter((part, index, parts) => part && parts.indexOf(part) === index);
    setEditZoneForm((current) => ({
      ...current,
      location: address.join(", ") || current.location,
      latitude: Number(latitude).toFixed(6),
      longitude: Number(longitude).toFixed(6),
    }));
    setEditPlaceResults([]);
    setEditPlacesError("");
  }

  async function handleUpdateZone(event) {
    event.preventDefault();
    setSaving(true);
    setActionError("");
    setActionSuccess("");
    try {
      await updateAdminZone(editZoneForm.zone, {
        name: editZoneForm.name,
        location: editZoneForm.location,
        description: editZoneForm.description,
        latitude: editZoneForm.latitude,
        longitude: editZoneForm.longitude,
      });
      await loadDashboard();
      setActionSuccess(`Zone details for ${editZoneForm.name} were updated.`);
    } catch (requestError) {
      const detail = requestError.response?.data;
      setActionError(typeof detail === "string" ? detail : "The zone could not be updated. Check its details and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Administration</p>
            <h1 className="page-title mt-2">Admin dashboard</h1>
            <p className="page-description">A platform-wide view of accounts, parking capacity, and session activity.</p>
          </div>
          <div className="flex items-center gap-3">
            {updatedAt && <p className="text-xs text-slate-500">Updated {updatedAt.toLocaleTimeString()}</p>}
            <button type="button" onClick={loadDashboard} disabled={loading} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-50">
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {error && <div className="mb-6 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 sm:flex-row sm:items-center sm:justify-between" role="alert"><p>{error}</p><button type="button" onClick={loadDashboard} className="font-semibold underline">Try again</button></div>}
        {loading && !data ? (
          <div className="surface-card p-10 text-center text-slate-600" role="status" aria-live="polite">Loading admin dashboard...</div>
        ) : summary && (
          <>
            <section aria-label="Account summary" className="mb-8">
              <h2 className="mb-4 text-lg font-bold text-slate-900">Accounts</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Total accounts" value={summary.total_users} detail={`${summary.active_users} active`} />
                <MetricCard label="Drivers" value={summary.drivers} accent="text-teal-800" />
                <MetricCard label="Operators" value={summary.operators} accent="text-blue-800" />
                <MetricCard label="Administrators" value={summary.admins} accent="text-violet-800" />
              </div>
            </section>

            <section aria-label="Parking network summary" className="mb-8">
              <h2 className="mb-4 text-lg font-bold text-slate-900">Parking network</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Parking zones" value={summary.total_zones} detail={`${summary.active_zones} active`} />
                <MetricCard label="Total spaces" value={summary.total_slots} />
                <MetricCard label="Occupied spaces" value={summary.occupied_slots} detail={`${occupiedPercent}% of total capacity`} accent="text-rose-700" />
                <MetricCard label="Available spaces" value={summary.available_slots} accent="text-emerald-700" />
              </div>
              <div className="surface-card mt-4 p-5 sm:p-6">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">Space status</h3>
                  <p className="text-sm text-slate-500">{summary.total_slots} total spaces</p>
                </div>
                <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${summary.occupied_slots} occupied, ${summary.reserved_slots} reserved, ${summary.available_slots} available, ${summary.maintenance_slots} in maintenance`}>
                  {summary.total_slots > 0 && <>
                    <span className="bg-rose-500" style={{ width: `${(summary.occupied_slots / summary.total_slots) * 100}%` }} />
                    <span className="bg-amber-400" style={{ width: `${(summary.reserved_slots / summary.total_slots) * 100}%` }} />
                    <span className="bg-emerald-500" style={{ width: `${(summary.available_slots / summary.total_slots) * 100}%` }} />
                    <span className="bg-slate-400" style={{ width: `${(summary.maintenance_slots / summary.total_slots) * 100}%` }} />
                  </>}
                </div>
                <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                  <li><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-rose-500" />Occupied: {summary.occupied_slots}</li>
                  <li><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />Reserved: {summary.reserved_slots}</li>
                  <li><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />Available: {summary.available_slots}</li>
                  <li><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-slate-400" />Maintenance: {summary.maintenance_slots}</li>
                </ul>
              </div>
            </section>

            <section className="surface-card mb-8 p-5 sm:p-6" aria-labelledby="manage-network-heading">
              <div className="mb-5">
                <p className="eyebrow">Admin actions</p>
                <h2 id="manage-network-heading" className="mt-1 text-xl font-bold text-slate-900">Manage parking network</h2>
                <p className="mt-1 text-sm text-slate-600">Add a zone, then add its parking spaces. New spaces start as available.</p>
              </div>
              {actionError && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{actionError}</p>}
              {actionSuccess && <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{actionSuccess}</p>}
              <div className="grid gap-8 lg:grid-cols-2">
                <form onSubmit={handleCreateZone} className="space-y-4" aria-labelledby="add-zone-heading">
                  <h3 id="add-zone-heading" className="font-semibold text-slate-900">Add a parking zone</h3>
                  <div><label htmlFor="admin-zone-name" className="mb-1 block text-sm font-medium text-slate-700">Zone name</label><input id="admin-zone-name" value={zoneForm.name} onChange={(event) => setZoneForm((current) => ({ ...current, name: event.target.value }))} maxLength={100} required className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></div>
                  <div><label htmlFor="admin-zone-location" className="mb-1 block text-sm font-medium text-slate-700">Location</label><input id="admin-zone-location" value={zoneForm.location} onChange={(event) => setZoneForm((current) => ({ ...current, location: event.target.value }))} maxLength={255} required className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div><p className="text-sm font-semibold text-slate-900">Find this place on the map</p><p className="mt-1 text-xs leading-5 text-slate-600">Search by the location above, or by zone name if the location is blank.</p></div>
                      <button type="button" onClick={handlePlaceSearch} disabled={placesLoading} className="shrink-0 rounded-lg border border-teal-800 bg-white px-3 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-50 focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-50">{placesLoading ? "Searching..." : "Search map"}</button>
                    </div>
                    {placesError && <p className="mt-3 text-sm text-amber-800" role="status">{placesError}</p>}
                    {placeResults.length > 0 && <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white" aria-label="Map search results">{placeResults.map((feature) => {
                      const p = feature.properties;
                      const label = [p.name, p.street, p.city || p.locality, p.state, p.country].filter((part, index, parts) => part && parts.indexOf(part) === index).join(", ") || "Unnamed place";
                      return <li key={`${feature.geometry.coordinates.join(",")}-${label}`}><button type="button" onClick={() => selectPlace(feature)} className="w-full px-3 py-3 text-left text-sm text-slate-700 hover:bg-teal-50 focus-visible:bg-teal-50 focus-visible:outline-none">{label}</button></li>;
                    })}</ul>}
                    {mapPreviewUrl && <div className="mt-4 overflow-hidden rounded-lg border border-slate-300 bg-white"><iframe title="OpenStreetMap preview of selected zone entrance" src={mapPreviewUrl} className="h-56 w-full border-0" loading="lazy" /><p className="border-t border-slate-200 px-3 py-2 text-xs text-slate-600"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">© OpenStreetMap contributors</a> · Confirm the pin is at the parking entrance; adjust coordinates below if needed.</p></div>}
                  </div>
                  <fieldset className="space-y-2 rounded-lg border border-slate-200 p-3">
                    <legend className="px-1 text-sm font-medium text-slate-700">Zone entrance coordinates <span className="font-normal text-slate-500">(optional)</span></legend>
                    <p className="text-xs leading-5 text-slate-500">Choose a search result above to fill these automatically, or enter the coordinates manually.</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><label htmlFor="admin-zone-latitude" className="mb-1 block text-sm font-medium text-slate-700">Latitude</label><input id="admin-zone-latitude" type="number" min="-90" max="90" step="0.000001" value={zoneForm.latitude} onChange={(event) => setZoneForm((current) => ({ ...current, latitude: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></div>
                      <div><label htmlFor="admin-zone-longitude" className="mb-1 block text-sm font-medium text-slate-700">Longitude</label><input id="admin-zone-longitude" type="number" min="-180" max="180" step="0.000001" value={zoneForm.longitude} onChange={(event) => setZoneForm((current) => ({ ...current, longitude: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></div>
                    </div>
                  </fieldset>
                  <div><label htmlFor="admin-zone-description" className="mb-1 block text-sm font-medium text-slate-700">Description <span className="font-normal text-slate-500">(optional)</span></label><textarea id="admin-zone-description" value={zoneForm.description} onChange={(event) => setZoneForm((current) => ({ ...current, description: event.target.value }))} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></div>
                  <button type="submit" disabled={saving} className="rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-900 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:opacity-50">{saving ? "Saving..." : "Create zone"}</button>
                </form>

                <form onSubmit={handleCreateSlot} className="space-y-4" aria-labelledby="add-slot-heading">
                  <h3 id="add-slot-heading" className="font-semibold text-slate-900">Add a parking space</h3>
                  <div><label htmlFor="admin-slot-zone" className="mb-1 block text-sm font-medium text-slate-700">Parking zone</label><select id="admin-slot-zone" value={slotForm.zone} onChange={(event) => setSlotForm((current) => ({ ...current, zone: event.target.value }))} required disabled={!data.zones.length} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"><option value="">{data.zones.length ? "Select a zone" : "Create a zone first"}</option>{data.zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></div>
                  <div><label htmlFor="admin-slot-number" className="mb-1 block text-sm font-medium text-slate-700">Space number</label><input id="admin-slot-number" value={slotForm.slot_number} onChange={(event) => setSlotForm((current) => ({ ...current, slot_number: event.target.value }))} maxLength={20} required disabled={!data.zones.length} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100" /></div>
                  <button type="submit" disabled={saving || !data.zones.length} className="rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-900 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:opacity-50">{saving ? "Saving..." : "Create space"}</button>
                </form>
              </div>
              <form onSubmit={handleUpdateZone} className="mt-8 max-w-3xl space-y-4 border-t border-slate-200 pt-6" aria-labelledby="zone-coordinates-heading">
                <div>
                  <h3 id="zone-coordinates-heading" className="font-semibold text-slate-900">Edit an existing parking zone</h3>
                  <p className="mt-1 text-sm text-slate-600">Update its name or address and correct the entrance pin used in nearby parking results.</p>
                </div>
                <div><label htmlFor="edit-zone-select" className="mb-1 block text-sm font-medium text-slate-700">Parking zone</label><select id="edit-zone-select" value={editZoneForm.zone} onChange={(event) => handleEditZoneChange(event.target.value)} required disabled={!data.zones.length} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"><option value="">{data.zones.length ? "Select a zone to edit" : "Create a zone first"}</option>{data.zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label htmlFor="edit-zone-name" className="mb-1 block text-sm font-medium text-slate-700">Zone name</label><input id="edit-zone-name" value={editZoneForm.name} onChange={(event) => setEditZoneForm((current) => ({ ...current, name: event.target.value }))} maxLength={100} required disabled={!editZoneForm.zone} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100" /></div>
                  <div><label htmlFor="edit-zone-location" className="mb-1 block text-sm font-medium text-slate-700">Location / address</label><input id="edit-zone-location" value={editZoneForm.location} onChange={(event) => setEditZoneForm((current) => ({ ...current, location: event.target.value }))} maxLength={255} required disabled={!editZoneForm.zone} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100" /></div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-slate-900">Correct the location on the map</p><p className="mt-1 text-xs text-slate-600">Search the address, choose the parking entrance result, then save.</p></div><button type="button" onClick={handleEditPlaceSearch} disabled={!editZoneForm.zone || editPlacesLoading} className="shrink-0 rounded-lg border border-teal-800 bg-white px-3 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-50 disabled:opacity-50">{editPlacesLoading ? "Searching..." : "Search map"}</button></div>
                  {editPlacesError && <p className="mt-3 text-sm text-amber-800" role="status">{editPlacesError}</p>}
                  {editPlaceResults.length > 0 && <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white" aria-label="Map search results for existing zone">{editPlaceResults.map((feature) => { const p = feature.properties; const label = [p.name, p.street, p.city || p.locality, p.state, p.country].filter((part, index, parts) => part && parts.indexOf(part) === index).join(", ") || "Unnamed place"; return <li key={`${feature.geometry.coordinates.join(",")}-${label}`}><button type="button" onClick={() => selectEditPlace(feature)} className="w-full px-3 py-3 text-left text-sm text-slate-700 hover:bg-teal-50 focus-visible:bg-teal-50 focus-visible:outline-none">{label}</button></li>; })}</ul>}
                  {editZoneForm.latitude !== "" && editZoneForm.longitude !== "" && <div className="mt-4 overflow-hidden rounded-lg border border-slate-300 bg-white"><iframe title="OpenStreetMap preview of existing zone entrance" src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(`${Number(editZoneForm.longitude) - 0.015},${Number(editZoneForm.latitude) - 0.01},${Number(editZoneForm.longitude) + 0.015},${Number(editZoneForm.latitude) + 0.01}`)}&layer=mapnik&marker=${encodeURIComponent(`${editZoneForm.latitude},${editZoneForm.longitude}`)}`} className="h-56 w-full border-0" loading="lazy" /><p className="border-t border-slate-200 px-3 py-2 text-xs text-slate-600"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">© OpenStreetMap contributors</a></p></div>}
                </div>
                <div><label htmlFor="edit-zone-description" className="mb-1 block text-sm font-medium text-slate-700">Description <span className="font-normal text-slate-500">(optional)</span></label><textarea id="edit-zone-description" value={editZoneForm.description} onChange={(event) => setEditZoneForm((current) => ({ ...current, description: event.target.value }))} rows={2} disabled={!editZoneForm.zone} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100" /></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label htmlFor="existing-zone-latitude" className="mb-1 block text-sm font-medium text-slate-700">Entrance latitude</label><input id="existing-zone-latitude" type="number" min="-90" max="90" step="0.000001" value={editZoneForm.latitude} onChange={(event) => setEditZoneForm((current) => ({ ...current, latitude: event.target.value }))} required disabled={!editZoneForm.zone} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100" /></div>
                  <div><label htmlFor="existing-zone-longitude" className="mb-1 block text-sm font-medium text-slate-700">Entrance longitude</label><input id="existing-zone-longitude" type="number" min="-180" max="180" step="0.000001" value={editZoneForm.longitude} onChange={(event) => setEditZoneForm((current) => ({ ...current, longitude: event.target.value }))} required disabled={!editZoneForm.zone} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100" /></div>
                </div>
                <button type="submit" disabled={saving || !editZoneForm.zone} className="rounded-lg border border-teal-800 px-4 py-2.5 text-sm font-semibold text-teal-900 hover:bg-teal-50 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:opacity-50">{saving ? "Saving..." : "Save zone changes"}</button>
              </form>
            </section>

            <section className="grid gap-4 lg:grid-cols-4" aria-label="Session overview and actions">
              <div className="surface-card p-5 sm:p-6">
                <p className="text-sm font-medium text-slate-500">Active sessions</p>
                <p className="mt-2 text-3xl font-bold text-blue-800">{summary.active_sessions}</p>
                <p className="mt-1 text-sm text-slate-500">Currently open parking sessions</p>
              </div>
              <div className="surface-card p-5 sm:p-6">
                <p className="text-sm font-medium text-slate-500">Completed sessions</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{summary.completed_sessions}</p>
                <p className="mt-1 text-sm text-slate-500">Recorded value: {formatAmount(summary.completed_revenue)}</p>
              </div>
              <div className="surface-card flex flex-col justify-between gap-4 p-5 sm:p-6">
                <div><h2 className="font-bold text-slate-900">Parking operations</h2><p className="mt-1 text-sm text-slate-600">Review live zones, slots, reservations, and active sessions.</p></div>
                <Link to="/operator-dashboard" className="inline-flex w-fit items-center rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-900 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2">Open operations</Link>
              </div>
              <div className="surface-card flex flex-col justify-between gap-4 p-5 sm:p-6">
                <div><h2 className="font-bold text-slate-900">Reports &amp; Analytics</h2><p className="mt-1 text-sm text-slate-600">Explore date-filtered session value and zone performance.</p></div>
                <Link to="/reports-analytics" className="inline-flex w-fit items-center rounded-lg border border-teal-800 px-4 py-2.5 text-sm font-semibold text-teal-900 hover:bg-teal-50 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2">Open reports</Link>
              </div>
            </section>

            <section className="surface-card mt-8 p-5 sm:p-6" aria-labelledby="recent-sessions-heading">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div><h2 id="recent-sessions-heading" className="text-lg font-bold text-slate-900">Recent parking sessions</h2><p className="mt-1 text-sm text-slate-500">Latest eight sessions across the system.</p></div>
                <Link to="/operator-dashboard" className="text-sm font-semibold text-teal-800 hover:underline">View live operations</Link>
              </div>
              {!data.recent_sessions.length ? <p className="rounded-lg bg-slate-50 p-5 text-slate-600">No parking sessions have been recorded.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th scope="col" className="px-3 py-3">Vehicle</th><th scope="col" className="px-3 py-3">Zone / space</th><th scope="col" className="px-3 py-3">Started</th><th scope="col" className="px-3 py-3">Status</th><th scope="col" className="px-3 py-3 text-right">Total</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.recent_sessions.map((session) => <tr key={session.id} className="text-slate-700"><td className="px-3 py-3 font-semibold text-slate-900">{session.vehicle_plate_number}</td><td className="px-3 py-3">{session.zone_name} · {session.slot_number}</td><td className="px-3 py-3">{formatDate(session.start_time)}</td><td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{session.status}</span></td><td className="px-3 py-3 text-right">{session.total_cost == null ? "—" : formatAmount(session.total_cost)}</td></tr>)}
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
