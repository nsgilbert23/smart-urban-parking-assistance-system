import { useEffect, useMemo, useRef, useState } from "react";

import {
  getParkingZones,
  getParkingSlots,
  getPricingRules,
  getParkingSessions,
  createParkingSession,
  cancelParkingReservation,
  findNearbyParking,
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
  const [estimatedDurationHours, setEstimatedDurationHours] = useState("2");

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [now, setNow] = useState(Date.now());
  const [availabilityUpdatedAt, setAvailabilityUpdatedAt] = useState(null);
  const [expiredNotice, setExpiredNotice] = useState(false);
  const [nearbyResults, setNearbyResults] = useState(null);
  const [findingNearby, setFindingNearby] = useState(false);
  const [nearbyError, setNearbyError] = useState("");
  const refreshedExpiryIds = useRef(new Set());
  const reservationFormRef = useRef(null);

  async function handleFindNearby() {
    setNearbyError("");
    setNearbyResults(null);
    if (!window.isSecureContext || !navigator.geolocation) {
      setNearbyError("Nearby search needs a secure connection and a browser that supports location. You can still choose a zone below.");
      return;
    }

    setFindingNearby(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000,
        });
      });
      const result = await findNearbyParking({
        latitude: Number(position.coords.latitude.toFixed(6)),
        longitude: Number(position.coords.longitude.toFixed(6)),
      });
      setNearbyResults(result.results);
    } catch (requestError) {
      if (typeof requestError.code === "number") {
        const locationErrors = {
          1: "Location permission was denied. You can still choose a parking zone below.",
          2: "Your location is unavailable right now. Try again or choose a zone below.",
          3: "Location lookup timed out. Try again or choose a zone below.",
        };
        setNearbyError(locationErrors[requestError.code] || "Your location could not be determined.");
      } else if (requestError.response?.status === 401) {
        setNearbyError("Your session has expired. Please sign in again.");
      } else {
        setNearbyError("Nearby parking could not be loaded. Please try again.");
      }
    } finally {
      setFindingNearby(false);
    }
  }

  function formatDistance(meters) {
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
  }

  function handleChooseNearbyZone(zone) {
    const firstAvailableSlot = slots.find((slot) =>
      String(slot.zone) === String(zone.id) &&
      slot.is_active &&
      slot.status === "AVAILABLE" &&
      !activeSlotIds.has(String(slot.id))
    );

    setSelectedZone(String(zone.id));
    setSelectedSlot(firstAvailableSlot ? String(firstAvailableSlot.id) : "");
    setError("");
    setSuccess(firstAvailableSlot
      ? `${zone.name} selected and space ${firstAvailableSlot.slot_number} chosen. Select your vehicle and confirm below to reserve it.`
      : `Availability at ${zone.name} has changed. Choose another available space below.`);
    reservationFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ==========================================
  // LOAD DATA
  // ==========================================

  useEffect(() => {
    loadParkingData();
  }, []);

  useEffect(() => {
    const refreshAvailability = async () => {
      try {
        const [latestSlots, latestSessions] = await Promise.all([
          getParkingSlots(),
          getParkingSessions(),
        ]);
        setSlots(latestSlots);
        setSessions(latestSessions);
        setAvailabilityUpdatedAt(Date.now());
      } catch (refreshError) {
        // Keep the last successful operator report visible if a refresh fails.
        console.error("Failed to refresh parking availability:", refreshError);
      }
    };
    const timer = window.setInterval(refreshAvailability, 20000);
    return () => window.clearInterval(timer);
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
      setAvailabilityUpdatedAt(Date.now());

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
        estimated_duration_minutes: Number(estimatedDurationHours) * 60,
      });

      setSuccess("Parking is reserved. Show the reservation to the operator when you arrive so they can start your session.");

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
            Availability is reported by parking operators. Reserve a space, show your confirmation on arrival, then follow your session and final charge here.
          </p>
          <p className="mt-1 text-xs text-gray-500" aria-live="polite">Availability refreshes every 20 seconds{availabilityUpdatedAt ? ` · Last checked ${new Date(availabilityUpdatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}` : ""}. Reservation expiry is shown after confirmation.</p>
        </div>

        <section className="mb-6 rounded-2xl border border-teal-100 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="nearby-parking-heading">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="nearby-parking-heading" className="text-lg font-bold text-gray-900">Find parking near me</h2>
              <p className="mt-1 text-sm text-gray-600">Share your location once to see nearby zones with available spaces. Your location is not saved.</p>
            </div>
            <button type="button" onClick={handleFindNearby} disabled={findingNearby} className="shrink-0 rounded-lg bg-teal-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">
              {findingNearby ? "Finding nearby parking..." : "Use my location"}
            </button>
          </div>
          {nearbyError && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">{nearbyError}</p>}
          {nearbyResults && nearbyResults.length === 0 && <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700" role="status">No zones with saved entrance coordinates currently have available spaces. You can still browse all zones below.</p>}
          {nearbyResults?.length > 0 && (
            <ul className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Nearby parking zones">
              {nearbyResults.map((zone) => {
                const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${zone.latitude},${zone.longitude}`)}`;
                const hasAvailableSlot = slots.some((slot) =>
                  String(slot.zone) === String(zone.id) &&
                  slot.is_active &&
                  slot.status === "AVAILABLE" &&
                  !activeSlotIds.has(String(slot.id))
                );
                return (
                  <li key={zone.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><h3 className="font-semibold text-slate-900">{zone.name}</h3><p className="mt-1 text-sm text-slate-600">{zone.location}</p></div>
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">{zone.available_spaces} available</span>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-700">{formatDistance(zone.distance_meters)} away <span className="text-slate-500">(straight-line)</span></p>
                      <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-lg border border-teal-700 px-3 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600" aria-label={`Get directions to ${zone.name} in Google Maps`}>Directions</a>
                    </div>
                    <button type="button" onClick={() => handleChooseNearbyZone(zone)} disabled={!hasAvailableSlot} className="mt-4 w-full rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300">
                      {hasAvailableSlot ? "Choose location & select a space" : "No spaces currently available"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>


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
                  <p className="text-sm text-gray-600">Vehicle {slot.reserved_vehicle_plate_number || "—"} · Planned stay {Math.floor((slot.reserved_estimated_duration_minutes || 0) / 60)}h {(slot.reserved_estimated_duration_minutes || 0) % 60}m</p>
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

                  <div className="text-sm text-blue-800">
                    <p>Your operator confirms arrival and departure. Your profile phone number is saved for the selected mobile money prompt, which you approve on your phone.</p>
                    {session.estimated_duration_minutes != null && (() => {
                      const elapsed = Math.max(0, Math.ceil((now - new Date(session.start_time).getTime()) / 60000));
                      const remaining = session.estimated_duration_minutes - elapsed;
                      const format = (minutes) => `${Math.floor(Math.abs(minutes) / 60)}h ${Math.abs(minutes) % 60}m`;
                      return <p className={`mt-2 font-semibold ${remaining < 0 ? "text-amber-800" : "text-teal-800"}`}>Time used: {format(elapsed)} · {remaining < 0 ? `Past estimate by ${format(remaining)}` : `${format(remaining)} remaining`}</p>;
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


        {/* Parking Workflow */}
        <div ref={reservationFormRef} className="grid scroll-mt-6 gap-8 lg:grid-cols-3">

          {/* LEFT SIDE */}
          <div className="lg:col-span-2">

            <div className="rounded-2xl bg-white p-8 shadow">

              <h2 className="text-2xl font-bold text-gray-900">
                Reserve a space
              </h2>

              <p className="mt-2 text-gray-500">
                  Choose a location, space, vehicle, and planned stay. Your reservation expiry is shown after confirmation; your parking session starts when the operator confirms your arrival.
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

                <div>
                  <label htmlFor="estimated-parking-hours" className="mb-2 block font-semibold text-gray-700">
                    5. How long do you expect to park?
                  </label>
                  <select id="estimated-parking-hours" value={estimatedDurationHours} onChange={(event) => setEstimatedDurationHours(event.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500">
                    {[1, 2, 3, 4, 6, 8, 12, 24].map((hours) => <option key={hours} value={hours}>{hours} {hours === 1 ? "hour" : "hours"}</option>)}
                  </select>
                  <p className="mt-2 text-sm text-gray-500">This is an estimate to help you track your time. Parking continues until the operator confirms your departure.</p>
                </div>


                {/* START BUTTON */}
                <button
                  type="submit"
                  disabled={starting}
                  className="w-full rounded-lg bg-blue-600 px-6 py-4 text-lg font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {starting
                    ? "Starting Parking..."
                    : "Confirm reservation"}
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

                  <p className="text-xl font-bold text-green-700">
                    {selectedPricingRule
                      ? `${Number(pricingRules.find((rule) => String(rule.id) === String(selectedPricingRule))?.cost_per_hour || 0).toLocaleString()} RWF / hour`
                      : "Select a rate"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Estimated parking time</p>
                  <p className="font-semibold text-gray-900">{estimatedDurationHours} {Number(estimatedDurationHours) === 1 ? "hour" : "hours"}</p>
                  <p className="mt-1 text-sm font-semibold text-gray-700">Estimated total: {selectedPricingRule ? Math.max(0, (Number(estimatedDurationHours) * 60 - Number(pricingRules.find((rule) => String(rule.id) === String(selectedPricingRule))?.grace_period_minutes || 0)) / 60 * Number(pricingRules.find((rule) => String(rule.id) === String(selectedPricingRule))?.cost_per_hour || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"} RWF</p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">Estimate for your planned stay after the grace period. The final amount is based on your actual session duration and is confirmed at departure.</p>
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
