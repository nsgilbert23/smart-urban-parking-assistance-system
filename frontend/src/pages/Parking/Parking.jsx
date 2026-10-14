import { useEffect, useMemo, useRef, useState } from "react";

import {
  getParkingZones,
  getParkingSlots,
  getPricingRules,
  getParkingSessions,
  createParkingSession,
  cancelParkingReservation,
} from "../../services/parkingService";

import { getVehicles } from "../../services/vehicleService";

export default function Parking() {
  const [zones, setZones] = useState([]);
  const [slots, setSlots] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [pricingRules, setPricingRules] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [selectedZone, setSelectedZone] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedPricingRule, setSelectedPricingRule] = useState("");

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [now, setNow] = useState(Date.now());
  const [expiredNotice, setExpiredNotice] = useState(false);
  const refreshedExpiryIds = useRef(new Set());

  // ==========================================
  // LOAD DATA
  // ==========================================

  useEffect(() => {
    loadParkingData();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const ownReservations = useMemo(() => slots.filter(
    (slot) => slot.status === "RESERVED" && slot.reservation_owned_by_current_user
  ), [slots]);

  useEffect(() => {
    const expired = ownReservations.filter((slot) =>
      slot.reservation_expires_at &&
      new Date(slot.reservation_expires_at).getTime() <= now &&
      !refreshedExpiryIds.current.has(slot.id)
    );
    if (!expired.length) return;
    expired.forEach((slot) => refreshedExpiryIds.current.add(slot.id));
    setExpiredNotice(true);
    getParkingSlots().then(setSlots).catch((err) => {
      console.error("Failed to refresh expired reservation:", err);
    });
  }, [ownReservations, now]);

  async function cancelReservation(slotId) {
    try {
      setError("");
      setSuccess("");
      await cancelParkingReservation(slotId);
      setSlots(await getParkingSlots());
      setSuccess("Reservation cancelled.");
    } catch (err) {
      const message = err.response?.data
        ? Object.values(err.response.data).flat().join(" ")
        : "Unable to cancel this reservation. Please refresh and try again.";
      setError(message);
    }
  }

  async function loadParkingData() {
    try {
      setLoading(true);
      setError("");

      const [
        zonesData,
        slotsData,
        vehiclesData,
        pricingData,
      ] = await Promise.all([
        getParkingZones(),
        getParkingSlots(),
        getVehicles(),
        getPricingRules(),
      ]);

      // Session history is supplementary to the reservation form. A failure
      // loading it should not prevent zones, slots, vehicles, and prices from
      // being displayed.
      const sessionsData = await getParkingSessions().catch((err) => {
        console.error("Failed to load parking sessions:", err);
        return [];
      });

      setZones(zonesData);
      setSlots(slotsData);
      setVehicles(vehiclesData);
      setPricingRules(pricingData);
      setSessions(sessionsData);

      // Select default pricing rule
      const defaultRule = pricingData.find(
        (rule) => rule.is_default && rule.is_active
      );

      if (defaultRule) {
        setSelectedPricingRule(defaultRule.id);
      }
    } catch (err) {
      console.error("Failed to load parking data:", err);

      setError(
        "Unable to load parking information. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // FILTER ACTIVE ZONES
  // ==========================================

  const activeZones = useMemo(() => {
    return zones.filter((zone) => zone.is_active);
  }, [zones]);

  const activeSessions = useMemo(() => {
    return sessions.filter(
      (session) => session.status === "ACTIVE"
    );
  }, [sessions]);

  const activeVehicleIds = useMemo(() => {
    return new Set(
      activeSessions.map((session) => String(session.vehicle))
    );
  }, [activeSessions]);

  const activeSlotIds = useMemo(() => {
    return new Set(
      activeSessions.map((session) => String(session.slot))
    );
  }, [activeSessions]);

  // ==========================================
  // FILTER AVAILABLE SLOTS
  // ==========================================

  const availableSlots = useMemo(() => {
    return slots.filter(
      (slot) =>
        slot.is_active &&
        slot.status === "AVAILABLE" &&
        !activeSlotIds.has(String(slot.id)) &&
        (!selectedZone ||
          String(slot.zone) === String(selectedZone))
    );
  }, [slots, selectedZone, activeSlotIds]);

  const availableVehicles = useMemo(() => {
    return vehicles.filter(
      (vehicle) =>
        vehicle.is_active &&
        !activeVehicleIds.has(String(vehicle.id))
    );
  }, [vehicles, activeVehicleIds]);

  // ==========================================
  // SELECT ZONE
  // ==========================================

  function handleZoneChange(event) {
    const zoneId = event.target.value;

    setSelectedZone(zoneId);

    // Reset selected slot when zone changes
    setSelectedSlot("");
  }

  // ==========================================
  // START PARKING
  // ==========================================

  async function handleStartParking(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!selectedZone) {
      setError("Please select a parking zone.");
      return;
    }

    if (!selectedSlot) {
      setError("Please select a parking slot.");
      return;
    }

    if (!selectedVehicle) {
      setError("Please select a vehicle.");
      return;
    }

    if (activeVehicleIds.has(String(selectedVehicle))) {
      setError(
        "This vehicle already has an active parking session. End that session before starting a new one."
      );
      return;
    }

    if (activeSlotIds.has(String(selectedSlot))) {
      setError(
        "This parking slot already has an active session. Please choose another available slot."
      );
      return;
    }

    if (!selectedPricingRule) {
      setError("Please select a pricing rule.");
      return;
    }

    try {
      setStarting(true);

      await createParkingSession({
        vehicle: selectedVehicle,
        slot: selectedSlot,
        pricing_rule: selectedPricingRule,
        status: "ACTIVE",
      });

      setSuccess("Parking is reserved. Your session starts when the parking sensor detects your vehicle.");

      // Reset selections
      setSelectedSlot("");
      setSelectedVehicle("");

      // Reload slots so the reservation is visible.
      await loadParkingData();

    } catch (err) {
      console.error("Failed to start parking:", err);

      if (err.response?.data) {
        console.error("Server response:", err.response.data);
      }

      const responseData = err.response?.data;
      const message = responseData
        ? Object.values(responseData).flat().join(" ")
        : "";

      setError(
        message ||
          "Unable to start parking. Please refresh the page and try again."
      );
    } finally {
      setStarting(false);
    }
  }

  // ==========================================
  // LOADING
  // ==========================================

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="rounded-xl bg-white p-10 text-center shadow">
          <p className="text-lg font-semibold text-gray-700">
            Loading parking information...
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // UI
  // ==========================================

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8 sm:px-6 lg:px-8">

      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-8">
          <p className="eyebrow">Driver workspace</p>
          <h1 className="page-title mt-2">
            Find Parking
          </h1>

          <p className="mt-2 text-gray-600">
            Find an available parking space and start your parking session.
          </p>
        </div>


        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
            {error}
          </div>
        )}

        {success && <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800" role="status">{success}</div>}

        {expiredNotice && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900" role="status">
            Your reservation has expired. Parking availability has been refreshed.
          </div>
        )}

        {ownReservations.length > 0 && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h2 className="font-semibold text-blue-900">Your reservation</h2>
            <div className="mt-3 space-y-3">
              {ownReservations.map((slot) => {
                const seconds = slot.reservation_expires_at
                  ? Math.max(0, Math.ceil((new Date(slot.reservation_expires_at).getTime() - now) / 1000))
                  : null;
                const countdown = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
                return (
                  <div key={slot.id} className="flex flex-col justify-between gap-3 rounded-lg bg-white p-4 md:flex-row md:items-center">
                    <div>
                      <p className="font-semibold text-gray-900">{slot.zone_name} · Slot {slot.slot_number}</p>
                      <p className="text-sm text-gray-600">Vehicle {slot.reserved_vehicle_plate_number || "—"} · Status: Reserved</p>
                      <p className="text-sm text-gray-600">{slot.reservation_expires_at ? <>Expires {new Date(slot.reservation_expires_at).toLocaleString()} · Reserved for {countdown}</> : "Reservation expiration is not available."}</p>
                    </div>
                    <button type="button" onClick={() => cancelReservation(slot.id)} className="rounded-lg border border-red-200 px-4 py-2 font-semibold text-red-700 hover:bg-red-50">
                      Cancel Reservation
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeSessions.length > 0 && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h2 className="font-semibold text-blue-900">
              Active parking session
            </h2>

            <div className="mt-3 space-y-3">
              {activeSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-col justify-between gap-3 rounded-lg bg-white p-4 md:flex-row md:items-center"
                >
                  <div>
                    <p className="font-semibold text-gray-900">
                      {session.vehicle_plate_number || "Vehicle"} is already parked
                    </p>

                    <p className="text-sm text-gray-600">
                      Slot {session.slot_number || session.slot}
                    </p>
                  </div>

                  <p className="text-sm text-blue-700">Ends automatically when the parking sensor detects that the vehicle has left.</p>
                </div>
              ))}
            </div>
          </div>
        )}


        {/* Parking Workflow */}
        <div className="grid gap-8 lg:grid-cols-3">

          {/* LEFT SIDE */}
          <div className="lg:col-span-2">

            <div className="rounded-2xl bg-white p-8 shadow">

              <h2 className="text-2xl font-bold text-gray-900">
                Start Parking
              </h2>

              <p className="mt-2 text-gray-500">
                Follow the steps below to find and reserve your parking space.
              </p>


              <form
                onSubmit={handleStartParking}
                className="mt-8 space-y-6"
              >

                {/* STEP 1 */}
                <div>
                  <label className="mb-2 block font-semibold text-gray-700">
                    1. Choose Parking Zone
                  </label>

                  <select
                    value={selectedZone}
                    onChange={handleZoneChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                  >
                    <option value="">
                      Select a parking zone
                    </option>

                    {activeZones.map((zone) => (
                      <option
                        key={zone.id}
                        value={zone.id}
                      >
                        {zone.name} — {zone.location}
                      </option>
                    ))}
                  </select>
                </div>


                {/* STEP 2 */}
                <div>
                  <label className="mb-2 block font-semibold text-gray-700">
                    2. Choose Available Slot
                  </label>

                  <select
                    value={selectedSlot}
                    onChange={(event) =>
                      setSelectedSlot(event.target.value)
                    }
                    disabled={!selectedZone}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none disabled:bg-gray-100 focus:border-blue-500"
                  >
                    <option value="">
                      {!selectedZone
                        ? "Choose a zone first"
                        : availableSlots.length === 0
                        ? "No available slots"
                        : "Select a parking slot"}
                    </option>

                    {availableSlots.map((slot) => (
                      <option
                        key={slot.id}
                        value={slot.id}
                      >
                        Slot {slot.slot_number}
                      </option>
                    ))}
                  </select>
                </div>


                {/* STEP 3 */}
                <div>
                  <label className="mb-2 block font-semibold text-gray-700">
                    3. Choose Your Vehicle
                  </label>

                  <select
                    value={selectedVehicle}
                    onChange={(event) =>
                      setSelectedVehicle(event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                  >
                    <option value="">
                      Select your vehicle
                    </option>

                    {availableVehicles.map((vehicle) => (
                        <option
                          key={vehicle.id}
                          value={vehicle.id}
                        >
                          {vehicle.plate_number} —{" "}
                          {vehicle.brand} {vehicle.model}
                        </option>
                      ))}
                  </select>
                </div>


                {/* STEP 4 */}
                <div>
                  <label className="mb-2 block font-semibold text-gray-700">
                    4. Parking Pricing
                  </label>

                  <select
                    value={selectedPricingRule}
                    onChange={(event) =>
                      setSelectedPricingRule(event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                  >
                    <option value="">
                      Select pricing
                    </option>

                    {pricingRules
                      .filter((rule) => rule.is_active)
                      .map((rule) => (
                        <option
                          key={rule.id}
                          value={rule.id}
                        >
                          {rule.name} —{" "}
                          {rule.cost_per_hour} per hour
                        </option>
                      ))}
                  </select>
                </div>


                {/* START BUTTON */}
                <button
                  type="submit"
                  disabled={starting}
                  className="w-full rounded-lg bg-blue-600 px-6 py-4 text-lg font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {starting
                    ? "Starting Parking..."
                    : "Start Parking"}
                </button>

              </form>

            </div>

          </div>


          {/* RIGHT SIDE */}
          <div>

            <div className="rounded-2xl bg-white p-6 shadow">

              <h2 className="text-xl font-bold text-gray-900">
                Parking Summary
              </h2>

              <div className="mt-6 space-y-5">

                <div>
                  <p className="text-sm text-gray-500">
                    Parking Zone
                  </p>

                  <p className="font-semibold text-gray-900">
                    {selectedZone
                      ? activeZones.find(
                          (zone) =>
                            String(zone.id) ===
                            String(selectedZone)
                        )?.name
                      : "Not selected"}
                  </p>
                </div>


                <div>
                  <p className="text-sm text-gray-500">
                    Parking Slot
                  </p>

                  <p className="font-semibold text-gray-900">
                    {selectedSlot
                      ? availableSlots.find(
                          (slot) =>
                            String(slot.id) ===
                            String(selectedSlot)
                        )?.slot_number
                      : "Not selected"}
                  </p>
                </div>


                <div>
                  <p className="text-sm text-gray-500">
                    Vehicle
                  </p>

                  <p className="font-semibold text-gray-900">
                    {selectedVehicle
                      ? vehicles.find(
                          (vehicle) =>
                            String(vehicle.id) ===
                            String(selectedVehicle)
                        )?.plate_number
                      : "Not selected"}
                  </p>
                </div>


                <div>
                  <p className="text-sm text-gray-500">
                    Price
                  </p>

                  <p className="text-xl font-bold text-green-600">
                    {selectedPricingRule
                      ? pricingRules.find(
                          (rule) =>
                            String(rule.id) ===
                            String(selectedPricingRule)
                        )?.cost_per_hour
                      : "--"}
                    {" / hour"}
                  </p>
                </div>

              </div>

            </div>


            {/* Available Slots */}
            <div className="mt-6 rounded-2xl bg-white p-6 shadow">

              <h2 className="text-xl font-bold text-gray-900">
                Available Slots
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                {availableSlots.length} slot
                {availableSlots.length !== 1 ? "s" : ""} available
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">

                {availableSlots.slice(0, 10).map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() =>
                      setSelectedSlot(slot.id)
                    }
                    className={`rounded-lg border p-3 text-sm font-semibold transition ${
                      String(selectedSlot) === String(slot.id)
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                    }`}
                  >
                    {slot.slot_number}
                  </button>
                ))}

                {availableSlots.length === 0 && (
                  <p className="col-span-2 py-4 text-center text-sm text-gray-500">
                    No available slots.
                  </p>
                )}

              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
