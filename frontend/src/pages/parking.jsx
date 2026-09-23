import { useEffect, useState } from "react";

import {
  getParkingZones,
  getParkingSlotsByZone,
  getParkingSessions,
  startParkingSession,
  endParkingSession,
} from "../../services/parkingService";

import { getVehicles } from "../../services/vehicleService";

export default function Parking() {
  const [zones, setZones] = useState([]);
  const [slots, setSlots] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState("");

  const [activeSession, setActiveSession] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);

  const [error, setError] = useState("");

  // --------------------------------------------------
  // Load initial data
  // --------------------------------------------------

  useEffect(() => {
    loadParkingData();
  }, []);

  async function loadParkingData() {
    try {
      setLoading(true);
      setError("");

      const [zonesData, vehiclesData, sessionsData] =
        await Promise.all([
          getParkingZones(),
          getVehicles(),
          getParkingSessions(),
        ]);

      setZones(zonesData);
      setVehicles(vehiclesData);

      // Find active parking session
      const active = sessionsData.find(
        (session) =>
          session.status === "ACTIVE" ||
          session.is_active === true
      );

      setActiveSession(active || null);
    } catch (error) {
      console.error(error);

      setError(
        "Unable to load parking information."
      );
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // Select parking zone
  // --------------------------------------------------

  async function handleZoneSelect(zone) {
    try {
      setSelectedZone(zone);
      setSelectedSlot(null);
      setLoadingSlots(true);
      setError("");

      const data = await getParkingSlotsByZone(
        zone.id
      );

      setSlots(data);
    } catch (error) {
      console.error(error);

      setError(
        "Unable to load parking slots."
      );

      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  // --------------------------------------------------
  // Select parking slot
  // --------------------------------------------------

  function handleSlotSelect(slot) {
    setSelectedSlot(slot);
  }

  // --------------------------------------------------
  // Start parking
  // --------------------------------------------------

  async function handleStartParking() {
    if (!selectedSlot) {
      setError("Please select a parking slot.");
      return;
    }

    if (!selectedVehicle) {
      setError("Please select a vehicle.");
      return;
    }

    try {
      setStarting(true);
      setError("");

      const session = await startParkingSession({
        vehicle: selectedVehicle,
        slot: selectedSlot.id,
      });

      setActiveSession(session);

      alert("Parking started successfully!");

    } catch (error) {
      console.error(error);

      console.log(
        "Backend error:",
        error.response?.data
      );

      setError(
        error.response?.data?.detail ||
          "Unable to start parking."
      );
    } finally {
      setStarting(false);
    }
  }

  // --------------------------------------------------
  // End parking
  // --------------------------------------------------

  async function handleEndParking() {
    if (!activeSession) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to end this parking session?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setEnding(true);
      setError("");

      await endParkingSession(
        activeSession.id,
        {
          status: "COMPLETED",
        }
      );

      setActiveSession(null);

      alert("Parking session completed.");

      await loadParkingData();

    } catch (error) {
      console.error(error);

      console.log(
        "Backend error:",
        error.response?.data
      );

      setError(
        error.response?.data?.detail ||
          "Unable to end parking session."
      );
    } finally {
      setEnding(false);
    }
  }

  // --------------------------------------------------
  // Loading
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold">
            Loading parking information...
          </h2>

          <p className="mt-2 text-gray-500">
            Please wait.
          </p>
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="mx-auto max-w-7xl p-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold">
            Smart Parking
          </h1>

          <p className="mt-2 text-gray-600">
            Find an available parking space and
            start your parking session.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-100 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* --------------------------------------- */}
        {/* ACTIVE PARKING SESSION */}
        {/* --------------------------------------- */}

        {activeSession && (
          <div className="mb-8 rounded-xl bg-green-50 p-6 shadow">

            <div className="flex items-center justify-between">

              <div>
                <h2 className="text-2xl font-bold text-green-800">
                  Parking Active
                </h2>

                <p className="mt-2 text-green-700">
                  Your parking session is currently active.
                </p>
              </div>

              <span className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white">
                ACTIVE
              </span>

            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">

              <div className="rounded-lg bg-white p-4">
                <p className="text-sm text-gray-500">
                  Parking Slot
                </p>

                <p className="mt-1 text-lg font-bold">
                  {activeSession.slot_name ||
                    activeSession.slot ||
                    "Selected slot"}
                </p>
              </div>

              <div className="rounded-lg bg-white p-4">
                <p className="text-sm text-gray-500">
                  Vehicle
                </p>

                <p className="mt-1 text-lg font-bold">
                  {activeSession.vehicle_name ||
                    activeSession.vehicle ||
                    "Vehicle"}
                </p>
              </div>

              <div className="rounded-lg bg-white p-4">
                <p className="text-sm text-gray-500">
                  Status
                </p>

                <p className="mt-1 text-lg font-bold text-green-600">
                  Parking
                </p>
              </div>

            </div>

            <button
              onClick={handleEndParking}
              disabled={ending}
              className="mt-6 rounded-lg bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {ending
                ? "Ending Parking..."
                : "End Parking"}
            </button>

          </div>
        )}

        {/* --------------------------------------- */}
        {/* PARKING ZONES */}
        {/* --------------------------------------- */}

        {!activeSession && (
          <>
            <section className="mb-10">

              <div className="mb-4">
                <h2 className="text-2xl font-bold">
                  1. Choose Parking Zone
                </h2>

                <p className="mt-1 text-gray-500">
                  Select the parking area where you
                  want to park.
                </p>
              </div>

              {zones.length === 0 ? (
                <div className="rounded-xl bg-white p-8 text-center shadow">
                  <p className="text-gray-500">
                    No parking zones available.
                  </p>
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">

                  {zones.map((zone) => (
                    <button
                      key={zone.id}
                      onClick={() =>
                        handleZoneSelect(zone)
                      }
                      className={`rounded-xl bg-white p-6 text-left shadow transition hover:-translate-y-1 hover:shadow-lg ${
                        selectedZone?.id === zone.id
                          ? "ring-2 ring-blue-600"
                          : ""
                      }`}
                    >

                      <h3 className="text-xl font-bold">
                        {zone.name}
                      </h3>

                      <p className="mt-2 text-gray-500">
                        {zone.location ||
                          zone.address ||
                          "Parking location"}
                      </p>

                      <div className="mt-4">
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                          View Slots
                        </span>
                      </div>

                    </button>
                  ))}

                </div>
              )}

            </section>

            {/* --------------------------------------- */}
            {/* PARKING SLOTS */}
            {/* --------------------------------------- */}

            {selectedZone && (
              <section className="mb-10">

                <div className="mb-4">
                  <h2 className="text-2xl font-bold">
                    2. Choose Available Slot
                  </h2>

                  <p className="mt-1 text-gray-500">
                    Parking Zone:{" "}
                    <strong>
                      {selectedZone.name}
                    </strong>
                  </p>
                </div>

                {loadingSlots ? (
                  <div className="rounded-xl bg-white p-8 text-center shadow">
                    <p className="text-gray-500">
                      Loading parking slots...
                    </p>
                  </div>
                ) : slots.length === 0 ? (
                  <div className="rounded-xl bg-white p-8 text-center shadow">
                    <p className="text-gray-500">
                      No parking slots found in this zone.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">

                    {slots.map((slot) => {

                      const available =
                        slot.is_available === true ||
                        slot.status === "AVAILABLE" ||
                        slot.status === "available";

                      return (
                        <button
                          key={slot.id}
                          disabled={!available}
                          onClick={() =>
                            handleSlotSelect(slot)
                          }
                          className={`rounded-xl p-5 text-left shadow transition ${
                            !available
                              ? "cursor-not-allowed bg-gray-200 text-gray-500"
                              : selectedSlot?.id === slot.id
                              ? "bg-blue-600 text-white"
                              : "bg-white hover:shadow-lg"
                          }`}
                        >

                          <p className="text-sm font-medium">
                            Parking Slot
                          </p>

                          <h3 className="mt-1 text-xl font-bold">
                            {slot.slot_number ||
                              slot.name ||
                              `Slot ${slot.id}`}
                          </h3>

                          <p className="mt-2 text-sm">
                            {!available
                              ? "Occupied"
                              : selectedSlot?.id === slot.id
                              ? "Selected"
                              : "Available"}
                          </p>

                        </button>
                      );
                    })}

                  </div>
                )}

              </section>
            )}

            {/* --------------------------------------- */}
            {/* VEHICLE */}
            {/* --------------------------------------- */}

            {selectedSlot && (
              <section className="mb-10">

                <div className="mb-4">
                  <h2 className="text-2xl font-bold">
                    3. Choose Vehicle
                  </h2>

                  <p className="mt-1 text-gray-500">
                    Select the vehicle you are parking.
                  </p>
                </div>

                {vehicles.length === 0 ? (
                  <div className="rounded-xl bg-white p-8 shadow">
                    <p className="text-gray-600">
                      You don't have any registered
                      vehicles.
                    </p>
                  </div>
                ) : (
                  <div className="max-w-xl">

                    <select
                      value={selectedVehicle}
                      onChange={(e) =>
                        setSelectedVehicle(e.target.value)
                      }
                      className="w-full rounded-lg border bg-white p-4"
                    >

                      <option value="">
                        -- Select your vehicle --
                      </option>

                      {vehicles.map((vehicle) => (
                        <option
                          key={vehicle.id}
                          value={vehicle.id}
                        >
                          {vehicle.plate_number} -{" "}
                          {vehicle.brand}{" "}
                          {vehicle.model}
                        </option>
                      ))}

                    </select>

                  </div>
                )}

              </section>
            )}

            {/* --------------------------------------- */}
            {/* START PARKING */}
            {/* --------------------------------------- */}

            {selectedSlot && selectedVehicle && (
              <section className="mb-10">

                <div className="rounded-xl bg-white p-8 shadow">

                  <h2 className="text-2xl font-bold">
                    4. Start Parking
                  </h2>

                  <div className="mt-6 grid gap-4 md:grid-cols-3">

                    <div>
                      <p className="text-sm text-gray-500">
                        Zone
                      </p>

                      <p className="font-semibold">
                        {selectedZone?.name}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500">
                        Slot
                      </p>

                      <p className="font-semibold">
                        {selectedSlot.slot_number ||
                          selectedSlot.name ||
                          selectedSlot.id}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500">
                        Vehicle
                      </p>

                      <p className="font-semibold">
                        {
                          vehicles.find(
                            (vehicle) =>
                              String(vehicle.id) ===
                              String(selectedVehicle)
                          )?.plate_number
                        }
                      </p>
                    </div>

                  </div>

                  <button
                    onClick={handleStartParking}
                    disabled={starting}
                    className="mt-8 rounded-lg bg-green-600 px-8 py-3 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {starting
                      ? "Starting Parking..."
                      : "Start Parking"}
                  </button>

                </div>

              </section>
            )}
          </>
        )}

      </div>
    </div>
  );
}
