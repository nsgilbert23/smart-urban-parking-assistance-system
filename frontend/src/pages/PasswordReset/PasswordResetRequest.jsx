import { useState } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "../../layouts/AuthLayout";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import api from "../../services/api";

export default function PasswordResetRequest() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/password-reset/", { email });
      setSent(true);
    } catch (requestError) {
      const detail = requestError.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "We couldn't send reset instructions. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout eyebrow="Account help" title="Reset your password" description="Enter the email address on your SUPAS account. We'll send a secure reset link if an account matches.">
      {sent ? (
        <div className="space-y-5">
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900" role="status">If an active account uses that email, password reset instructions have been sent. Check your inbox.</p>
          <Link className="block text-center text-sm font-semibold text-teal-800 hover:underline" to="/login">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}
          <Input id="reset-email" name="email" label="Email address" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <Button type="submit" disabled={loading} className="w-full">{loading ? "Sending…" : "Send reset link"}</Button>
          <Link className="block text-center text-sm font-semibold text-teal-800 hover:underline" to="/login">Back to sign in</Link>
        </form>
      )}
    </AuthLayout>
  );
}
