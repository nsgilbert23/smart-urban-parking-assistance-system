import api from "./api";

export async function getAdminDashboard() {
  const response = await api.get("/admin/dashboard/");
  return response.data;
}

export async function createAdminZone(zone) {
  const response = await api.post("/admin/zones/", zone);
  return response.data;
}

export async function updateAdminZoneCoordinates(zoneId, coordinates) {
  const response = await api.patch(`/admin/zones/${zoneId}/coordinates/`, coordinates);
  return response.data;
}

export async function updateAdminZone(zoneId, details) {
  const response = await api.patch(`/admin/zones/${zoneId}/`, details);
  return response.data;
}

export async function searchOpenStreetMapPlaces(query, signal) {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "5");
  url.searchParams.set("lang", "en");
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("The place search service is unavailable.");
  const data = await response.json();
  return data.features || [];
}

export async function createAdminSlot(slot) {
  const response = await api.post("/admin/slots/", slot);
  return response.data;
}
