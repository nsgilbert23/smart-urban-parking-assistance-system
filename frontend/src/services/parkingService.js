import api from "./api";

// ===============================
// PARKING ZONES
// ===============================

export async function getParkingZones() {
  const response = await api.get("/parking-zones/");
  return response.data;
}


// ===============================
// PARKING SLOTS
// ===============================

export async function getParkingSlots() {
  const response = await api.get("/parking-slots/");
  return response.data;
}

export async function getParkingSlotsByZone(zoneId) {
  const slots = await getParkingSlots();

  return slots.filter(
    (slot) => String(slot.zone) === String(zoneId)
  );
}


// ===============================
// PRICING RULES
// ===============================

export async function getPricingRules() {
  const response = await api.get("/pricing-rules/");
  return response.data;
}


// ===============================
// PARKING SESSIONS
// ===============================

export async function getParkingSessions() {
  const response = await api.get("/parking-sessions/");
  return response.data;
}


export async function createParkingSession(session) {
  const response = await api.post(
    "/parking-sessions/",
    session
  );

  return response.data;
}


export async function updateParkingSession(id, session) {
  const response = await api.patch(
    `/parking-sessions/${id}/`,
    session
  );

  return response.data;
}

export async function startParkingSession(session) {
  return createParkingSession(session);
}

export async function reportSensorEvent(event) {
  const response = await api.post("/sensor-events/", event);
  return response.data;
}
