import { useEffect, useState } from "react";
import VehicleForm from "../../components/vehicles/VehicleForm";
import {
  getVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
} from "../../services/vehicleService";

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);

  const [search, setSearch] = useState("");

  useEffect(() => {
    loadVehicles();
  }, []);

  // =========================
  // LOAD VEHICLES
  // =========================

  async function loadVehicles() {
    try {
      setLoading(true);

      const data = await getVehicles();

      setVehicles(data);
    } catch (error) {
      console.error("Failed to load vehicles:", error);
      setError("Vehicles could not be loaded. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }

  // =========================
  // CREATE VEHICLE
  // =========================

  async function handleCreateVehicle(vehicle) {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await createVehicle(vehicle);

      await loadVehicles();

      setShowForm(false);
      setEditingVehicle(null);

      setSuccess("Vehicle registered successfully.");
    } catch (error) {
      console.error("Failed to create vehicle:", error);

      if (error.response?.data) {
        console.error("Server response:", error.response.data);
      }

      setError("Vehicle could not be registered. Check the details and try again.");
    } finally {
      setSaving(false);
    }
  }

  // =========================
  // EDIT VEHICLE
  // =========================

  function handleEditVehicle(vehicle) {
    setEditingVehicle(vehicle);
    setShowForm(true);

    // Scroll to the form
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // =========================
  // UPDATE VEHICLE
  // =========================

  async function handleUpdateVehicle(vehicle) {
    if (!editingVehicle) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await updateVehicle(
        editingVehicle.id,
        vehicle
      );

      await loadVehicles();

      setEditingVehicle(null);
      setShowForm(false);

      setSuccess("Vehicle updated successfully.");
    } catch (error) {
      console.error("Failed to update vehicle:", error);

      if (error.response?.data) {
        console.error(
          "Server response:",
          error.response.data
        );
      }

      setError("Vehicle could not be updated. Check the details and try again.");
    } finally {
      setSaving(false);
    }
  }

  // =========================
  // DELETE VEHICLE
  // =========================

  async function handleDelete(id) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this vehicle?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setSuccess("");
      await deleteVehicle(id);

      await loadVehicles();

      // If the deleted vehicle was being edited,
      // close the form.
      if (editingVehicle?.id === id) {
        setEditingVehicle(null);
        setShowForm(false);
      }

      setSuccess("Vehicle deleted successfully.");
    } catch (error) {
      console.error("Failed to delete vehicle:", error);

      if (error.response?.data) {
        console.error(
          "Server response:",
          error.response.data
        );
      }

      setError("Vehicle could not be deleted. Please try again.");
    }
  }

  // =========================
  // CANCEL FORM
  // =========================

  function handleCancelForm() {
    setShowForm(false);
    setEditingVehicle(null);
  }

  // =========================
  // SEARCH
  // =========================

  const filteredVehicles = vehicles.filter((vehicle) => {
    const searchTerm = search.toLowerCase().trim();

    return (
      vehicle.plate_number
        ?.toLowerCase()
        .includes(searchTerm)
    );
  });

  // =========================
  // LOADING
  // =========================

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="rounded-xl bg-white p-10 text-center shadow">
          <p className="text-lg text-gray-500">
            Loading vehicles...
          </p>
        </div>
      </div>
    );
  }

  // =========================
  // PAGE
  // =========================

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">

        {/* =========================
            HEADER
        ========================== */}

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              My Vehicles
            </h1>

            <p className="mt-2 text-gray-600">
              Register and manage your vehicles.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (showForm) {
                handleCancelForm();
              } else {
                setEditingVehicle(null);
                setShowForm(true);
              }
            }}
            className={`rounded-lg px-5 py-3 font-semibold text-white transition ${
              showForm
                ? "bg-gray-600 hover:bg-gray-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {showForm
              ? "Cancel"
              : "+ Add Vehicle"}
          </button>
        </div>

        {error && <p className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</p>}
        {success && <p className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800" role="status">{success}</p>}

        {/* =========================
            VEHICLE FORM
        ========================== */}

        {showForm && (
          <div className="mb-8">
            <VehicleForm
              initialData={editingVehicle}
              onSubmit={
                editingVehicle
                  ? handleUpdateVehicle
                  : handleCreateVehicle
              }
              loading={saving}
            />
          </div>
        )}

        {/* =========================
            SEARCH
        ========================== */}

        <div className="mb-8 rounded-xl bg-white p-5 shadow">

          <label
            htmlFor="vehicle-search"
            className="mb-2 block font-semibold text-gray-700"
          >
            Search Vehicles
          </label>

          <input
            id="vehicle-search"
            type="text"
            placeholder="Search by plate number..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            className="w-full rounded-lg border border-gray-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />

          {search && (
            <p className="mt-2 text-sm text-gray-500">
              Showing {filteredVehicles.length}{" "}
              vehicle
              {filteredVehicles.length !== 1
                ? "s"
                : ""}
            </p>
          )}
        </div>

        {/* =========================
            NO VEHICLES
        ========================== */}

        {vehicles.length === 0 ? (
          <div className="rounded-xl bg-white p-10 text-center shadow">

            <div className="mb-4 text-5xl">
              🚗
            </div>

            <h2 className="text-2xl font-semibold">
              No vehicles registered
            </h2>

            <p className="mt-3 text-gray-500">
              Click{" "}
              <strong>+ Add Vehicle</strong>{" "}
              to register your first vehicle.
            </p>

            {!showForm && (
              <button
                type="button"
                onClick={() => {
                  setEditingVehicle(null);
                  setShowForm(true);
                }}
                className="mt-6 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
              >
                + Register Your First Vehicle
              </button>
            )}
          </div>

        ) : filteredVehicles.length === 0 ? (

          /* =========================
             NO SEARCH RESULTS
          ========================== */

          <div className="rounded-xl bg-white p-10 text-center shadow">

            <div className="mb-4 text-4xl">
              🔍
            </div>

            <h2 className="text-2xl font-semibold">
              No vehicles found
            </h2>

            <p className="mt-3 text-gray-500">
              No vehicle matches{" "}
              <strong>"{search}"</strong>.
            </p>

            <button
              type="button"
              onClick={() => setSearch("")}
              className="mt-5 rounded-lg bg-gray-600 px-5 py-2 text-white hover:bg-gray-700"
            >
              Clear Search
            </button>
          </div>

        ) : (

          /* =========================
             VEHICLE LIST
          ========================== */

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

            {filteredVehicles.map((vehicle) => (

              <div
                key={vehicle.id}
                className="rounded-xl bg-white p-6 shadow transition hover:shadow-lg"
              >

                {/* Vehicle Header */}

                <div className="flex items-start justify-between">

                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {vehicle.brand}{" "}
                      {vehicle.model}
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      {vehicle.vehicle_type}
                    </p>
                  </div>

                  {/* Status */}

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      vehicle.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {vehicle.is_active
                      ? "Active"
                      : "Inactive"}
                  </span>

                </div>

                {/* Vehicle Information */}

                <div className="mt-5 space-y-3">

                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">
                      Plate
                    </span>

                    <strong>
                      {vehicle.plate_number}
                    </strong>
                  </div>

                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">
                      Type
                    </span>

                    <span>
                      {vehicle.vehicle_type}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-500">
                      Color
                    </span>

                    <span>
                      {vehicle.color}
                    </span>
                  </div>

                </div>

                {/* Actions */}

                <div className="mt-6 flex gap-3">

                  {/* Edit */}

                  <button
                    type="button"
                    onClick={() =>
                      handleEditVehicle(vehicle)
                    }
                    className="flex-1 rounded-lg bg-yellow-500 px-4 py-2 font-semibold text-white transition hover:bg-yellow-600"
                  >
                    Edit
                  </button>

                  {/* Delete */}

                  <button
                    type="button"
                    onClick={() =>
                      handleDelete(vehicle.id)
                    }
                    className="flex-1 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-700"
                  >
                    Delete
                  </button>

                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
