import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../../layouts/AuthLayout";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import useAuth from "../../hooks/useAuth";
import GoogleSignInButton from "../../components/auth/GoogleSignInButton";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithGoogle } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleCredential(credential) {
    setError("");
    setGoogleLoading(true);
    try {
      const result = await loginWithGoogle(credential);
      navigate(result.user?.role === "ADMIN" ? "/admin-dashboard" : result.user?.role === "OPERATOR" ? "/operator-dashboard" : "/dashboard");
    } catch (requestError) {
      const detail = requestError.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Google sign-in could not be completed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  }

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await login(form);
      navigate(result.user?.role === "ADMIN" ? "/admin-dashboard" : result.user?.role === "OPERATOR" ? "/operator-dashboard" : "/dashboard");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "We couldn’t sign you in. Check your details and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout eyebrow="Welcome back" title="Sign in to SUPAS" description="Access your vehicles, reservations, and parking sessions.">
      <form onSubmit={handleSubmit} className="space-y-5">
        {location.state?.passwordReset && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">Your password was reset. Sign in with your new password.</p>}
        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}
        <Input
          id="login-email"
          name="email"
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={handleChange}
          required
        />
        <Input
          id="login-password"
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={form.password}
          onChange={handleChange}
          required
        />
        <div className="-mt-2 text-right">
          <Link to="/reset-password" className="text-sm font-semibold text-teal-800 hover:underline">Forgot password?</Link>
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <div className="my-5 flex items-center gap-3" aria-hidden="true"><span className="h-px flex-1 bg-slate-200" /><span className="text-xs font-medium uppercase tracking-wide text-slate-400">or</span><span className="h-px flex-1 bg-slate-200" /></div>
      <GoogleSignInButton onCredential={handleGoogleCredential} disabled={googleLoading || loading} />
      <p className="mt-3 text-center text-xs leading-5 text-slate-500">Google shares your name and verified email for sign-in. SUPAS does not access your Gmail inbox. You can add your phone number and vehicle after signing in.</p>
      <p className="mt-6 text-center text-sm text-slate-600">
        New to SUPAS? <Link className="font-semibold text-teal-800 hover:underline" to="/register">Create an account</Link>
      </p>
    </AuthLayout>
  );
}
