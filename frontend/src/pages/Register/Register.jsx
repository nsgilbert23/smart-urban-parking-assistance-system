import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    password: "",
    password_confirm: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      await api.post("/auth/register/", form);

      setSuccess("Account created successfully.");

      setTimeout(() => {
        navigate("/login");
      }, 1500);

    } catch (err) {
      if (err.response?.data) {
        const messages = Object.values(err.response.data).flat().join(" ");
        setError(messages);
      } else {
        setError("Registration failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-lg">

        <h1 className="mb-2 text-3xl font-bold">
          Create Account
        </h1>

        <p className="mb-8 text-gray-500">
          Join Smart Urban Parking Assistance System
        </p>

        {error && (
          <div className="mb-4 rounded bg-red-100 p-3 text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded bg-green-100 p-3 text-green-700">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          <input
            type="text"
            name="first_name"
            placeholder="First Name"
            value={form.first_name}
            onChange={handleChange}
            className="w-full rounded border p-3"
            required
          />

          <input
            type="text"
            name="last_name"
            placeholder="Last Name"
            value={form.last_name}
            onChange={handleChange}
            className="w-full rounded border p-3"
            required
          />

          <input
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            className="w-full rounded border p-3"
            required
          />

          <input
            type="text"
            name="phone_number"
            placeholder="Phone Number"
            value={form.phone_number}
            onChange={handleChange}
            className="w-full rounded border p-3"
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            className="w-full rounded border p-3"
            required
          />

          <input
            type="password"
            name="password_confirm"
            placeholder="Confirm Password"
            value={form.password_confirm}
            onChange={handleChange}
            className="w-full rounded border p-3"
            required
          />

          <button
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 p-3 font-semibold text-white hover:bg-blue-700"
          >
            {loading ? "Creating..." : "Create Account"}
          </button>

        </form>

        <p className="mt-6 text-center">
          Already have an account?

          <Link
            to="/login"
            className="ml-2 text-blue-600"
          >
            Login
          </Link>
        </p>

      </div>
    </div>
  );
}