import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AuthLayout from "../../layouts/AuthLayout";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import api from "../../services/api";

function messageFromError(error) {
  const data = error.response?.data;
  if (typeof data?.detail === "string") return data.detail;
  if (data?.new_password) return data.new_password.flat().join(" ");
  if (data?.password_confirm) return data.password_confirm.flat().join(" ");
  if (data?.token) return data.token.flat().join(" ");
  return "We couldn't reset your password. Request a new link and try again.";
}

export default function PasswordResetConfirm() {
  const { uid, token } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ new_password: "", password_confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/password-reset/confirm/", { uid, token, ...form });
      navigate("/login", { replace: true, state: { passwordReset: true } });
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout eyebrow="Account help" title="Choose a new password" description="Use at least eight characters. Your other SUPAS sessions will be signed out.">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}
        <Input id="reset-new-password" name="new_password" label="New password" type="password" autoComplete="new-password" value={form.new_password} onChange={(event) => setForm((current) => ({ ...current, new_password: event.target.value }))} required minLength={8} />
        <Input id="reset-confirm-password" name="password_confirm" label="Confirm new password" type="password" autoComplete="new-password" value={form.password_confirm} onChange={(event) => setForm((current) => ({ ...current, password_confirm: event.target.value }))} required minLength={8} />
        <Button type="submit" disabled={loading} className="w-full">{loading ? "Saving…" : "Reset password"}</Button>
        <Link className="block text-center text-sm font-semibold text-teal-800 hover:underline" to="/login">Back to sign in</Link>
      </form>
    </AuthLayout>
  );
}
