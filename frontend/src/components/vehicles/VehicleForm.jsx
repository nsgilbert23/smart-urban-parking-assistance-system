import { useState } from "react";
import { vehicleData, colors } from "../../data/vehicleData";

export default function VehicleForm({
  onSubmit,
  loading,
}) {
  const [form, setForm] = useState({
    plate_number: "",
    vehicle_type: "CAR",
    brand: "",
    model: "",
    color: "",
  });

  const brands = Object.keys(
    vehicleData[form.vehicle_type] || {}
  );

  const models =
    vehicleData[form.vehicle_type]?.[form.brand] || [];

  function handleTypeChange(e) {
    setForm({
      ...form,
      vehicle_type: e.target.value,
      brand: "",
      model: "",
    });
  }

  function handleBrandChange(e) {
    setForm({
      ...form,
      brand: e.target.value,
      model: "",
    });
  }

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  function submit(e) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <form
      onSubmit={submit}
      className="mb-10 rounded-xl bg-white p-6 shadow"
    >
      <h2 className="mb-6 text-2xl font-bold">
        Register Vehicle
      </h2>

      <div className="grid gap-6 md:grid-cols-2">

        {/* Plate Number */}

        <div>
          <label className="mb-2 block">
            Plate Number
          </label>

          <input
            type="text"
            name="plate_number"
            value={form.plate_number}
            onChange={handleChange}
            className="w-full rounded-lg border p-3"
            placeholder="RAB123A"
            required
          />
        </div>

        {/* Vehicle Type */}

        <div>
          <label className="mb-2 block">
            Vehicle Type
          </label>

          <select
            value={form.vehicle_type}
            onChange={handleTypeChange}
            className="w-full rounded-lg border p-3"
          >
            <option value="CAR">Car</option>
            <option value="MOTORCYCLE">Motorcycle</option>
            <option value="VAN">Van</option>
            <option value="TRUCK">Truck</option>
            <option value="BUS">Bus</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        {/* Brand */}

        <div>
          <label className="mb-2 block">
            Brand
          </label>

          <select
            name="brand"
            value={form.brand}
            onChange={handleBrandChange}
            className="w-full rounded-lg border p-3"
            required
          >
            <option value="">
              Select Brand
            </option>

            {brands.map((brand) => (
              <option
                key={brand}
                value={brand}
              >
                {brand}
              </option>
            ))}
          </select>
        </div>

        {/* Model */}

        <div>
          <label className="mb-2 block">
            Model
          </label>

          <select
            name="model"
            value={form.model}
            onChange={handleChange}
            className="w-full rounded-lg border p-3"
            required
          >
            <option value="">
              Select Model
            </option>

            {models.map((model) => (
              <option
                key={model}
                value={model}
              >
                {model}
              </option>
            ))}
          </select>
        </div>

        {/* Color */}

        <div>
          <label className="mb-2 block">
            Color
          </label>

          <select
            name="color"
            value={form.color}
            onChange={handleChange}
            className="w-full rounded-lg border p-3"
            required
          >
            <option value="">
              Select Color
            </option>

            {colors.map((color) => (
              <option
                key={color}
                value={color}
              >
                {color}
              </option>
            ))}
          </select>
        </div>

      </div>

      <button
        disabled={loading}
        className="mt-8 rounded-lg bg-blue-600 px-8 py-3 text-white hover:bg-blue-700"
      >
        {loading
          ? "Saving..."
          : "Register Vehicle"}
      </button>
    </form>
  );
}