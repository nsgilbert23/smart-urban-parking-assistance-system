import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../../layouts/AuthLayout";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
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

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await api.post("/auth/register/", form);
      setSuccess("Your account was created. Redirecting you to sign in…");
      window.setTimeout(() => navigate("/login"), 1200);
    } catch (requestError) {
      const data = requestError.response?.data;
      setError(data ? Object.values(data).flat().join(" ") : "We couldn’t create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout eyebrow="Get started" title="Create your account" description="Set up your driver account to manage vehicles and parking reservations.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}
        {success && <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">{success}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="register-first-name" name="first_name" label="First name" autoComplete="given-name" placeholder="First name" value={form.first_name} onChange={handleChange} required />
          <Input id="register-last-name" name="last_name" label="Last name" autoComplete="family-name" placeholder="Last name" value={form.last_name} onChange={handleChange} required />
        </div>
        <Input id="register-email" name="email" label="Email address" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required />
        <Input id="register-phone" name="phone_number" label="Phone number" type="tel" autoComplete="tel" placeholder="Optional" value={form.phone_number} onChange={handleChange} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="register-password" name="password" label="Password" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={handleChange} required />
          <Input id="register-password-confirm" name="password_confirm" label="Confirm password" type="password" autoComplete="new-password" placeholder="Repeat password" value={form.password_confirm} onChange={handleChange} required />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Already registered? <Link to="/login" className="font-semibold text-teal-800 hover:underline">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
