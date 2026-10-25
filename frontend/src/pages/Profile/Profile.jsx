import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getProfile, updateProfile } from "../../services/profileService";
import api from "../../services/api";
import GoogleSignInButton from "../../components/auth/GoogleSignInButton";

const editableFields = [
  { name: "first_name", label: "First name", autoComplete: "given-name" },
  { name: "last_name", label: "Last name", autoComplete: "family-name" },
  { name: "phone_number", label: "Phone number", autoComplete: "tel" },
];

function getErrorMessage(error) {
  const data = error.response?.data;
  if (!data) return "We couldn't load your profile. Check your connection and try again.";
  if (typeof data.detail === "string") return data.detail;
  return "Please correct the highlighted fields and try again.";
}

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [success, setSuccess] = useState("");
  const [googleError, setGoogleError] = useState("");
  const [googleSuccess, setGoogleSuccess] = useState("");
  const [linkingGoogle, setLinkingGoogle] = useState(false);

  useEffect(() => {
    let active = true;
    getProfile()
      .then((data) => {
        if (active) {
          setProfile(data);
          setForm({
            first_name: data.first_name ?? "",
            last_name: data.last_name ?? "",
            phone_number: data.phone_number ?? "",
          });
        }
      })
      .catch((error) => {
        if (active) setApiError(getErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  function beginEditing() {
    setForm({
      first_name: profile.first_name ?? "",
      last_name: profile.last_name ?? "",
      phone_number: profile.phone_number ?? "",
    });
    setErrors({});
    setApiError("");
    setSuccess("");
    setEditing(true);
  }

  function cancelEditing() {
    setForm({
      first_name: profile.first_name ?? "",
      last_name: profile.last_name ?? "",
      phone_number: profile.phone_number ?? "",
    });
    setErrors({});
    setApiError("");
    setEditing(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    setApiError("");
    setSuccess("");
    try {
      const updated = await updateProfile(form);
      setProfile(updated);
      setForm({
        first_name: updated.first_name ?? "",
        last_name: updated.last_name ?? "",
        phone_number: updated.phone_number ?? "",
      });
      setEditing(false);
      setSuccess("Your profile was saved.");
    } catch (error) {
      const data = error.response?.data;
      if (data && typeof data === "object") {
        const fieldErrors = {};
        Object.entries(data).forEach(([field, messages]) => {
          if (Array.isArray(messages)) fieldErrors[field] = messages.join(" ");
        });
        setErrors(fieldErrors);
      }
      setApiError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleGoogleCredential(credential) {
    setLinkingGoogle(true);
    setGoogleError("");
    setGoogleSuccess("");
    try {
      const response = await api.post("/auth/google/link/", { credential });
      setProfile((current) => ({ ...current, google_linked: response.data.google_linked }));
      setGoogleSuccess("Google sign-in is connected to this SUPAS account.");
    } catch (error) {
      const detail = error.response?.data?.detail;
      setGoogleError(typeof detail === "string" ? detail : "Google could not be connected. Please try again.");
    } finally {
      setLinkingGoogle(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-4" aria-busy="true">
        <div className="surface-card flex items-center gap-3 px-6 py-5">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-teal-700" aria-hidden="true" />
          <p className="text-slate-600" role="status">Loading your profile...</p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-[60vh] px-4 py-12 sm:px-6">
        <div className="surface-card mx-auto max-w-3xl p-6 sm:p-8" role="alert">
          <p className="eyebrow">Account</p>
          <h1 className="page-title mt-2">Profile unavailable</h1>
          <p className="mt-3 text-red-700">{apiError}</p>
          <Link className="mt-6 inline-flex rounded-lg bg-slate-900 px-4 py-2.5 font-semibold text-white hover:bg-slate-800" to="/dashboard">Return to dashboard</Link>
        </div>
      </main>
    );
  }

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Driver account";
  const initials = [profile.first_name, profile.last_name].filter(Boolean).map((name) => name[0]).join("").slice(0, 2).toUpperCase() || "D";
  const roleLabel = profile.role ? profile.role.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Driver";

  return (
    <main className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800 hover:text-teal-950">&larr; Dashboard</Link>
            <p className="eyebrow mt-6">Account settings</p>
            <h1 className="page-title mt-2">Driver profile</h1>
            <p className="page-description">Manage the contact details associated with your parking account.</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-900">
            <span className="h-2 w-2 rounded-full bg-teal-600" aria-hidden="true" />{roleLabel} account
          </span>
        </div>

        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.4fr]">
          <aside className="surface-card overflow-hidden" aria-label="Account overview">
            <div className="h-2 bg-gradient-to-r from-teal-700 via-teal-500 to-sky-400" />
            <div className="p-6 sm:p-7">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-teal-50 bg-slate-900 text-xl font-bold tracking-wide text-white shadow-sm" aria-hidden="true">{initials}</div>
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Signed in as</p>
              <h2 className="mt-2 break-words text-xl font-bold tracking-tight text-slate-950">{fullName}</h2>
              <p className="mt-2 break-all text-sm leading-6 text-slate-600">{profile.email}</p>
              <div className="mt-6 border-t border-slate-100 pt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account type</p>
                <p className="mt-1 font-semibold text-slate-900">{roleLabel}</p>
              </div>
              <p className="mt-5 text-sm leading-6 text-slate-500">Your profile details help keep your parking account up to date.</p>
            </div>
          </aside>

          <section className="surface-card p-5 sm:p-7" aria-labelledby="profile-details-heading">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="profile-details-heading" className="text-lg font-bold text-slate-950">Personal details</h2>
                <p className="mt-1 text-sm text-slate-500">Your name and phone number are visible here.</p>
              </div>
              {!editing && (
                <button type="button" onClick={beginEditing} className="inline-flex w-fit items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-teal-600 hover:bg-teal-50 hover:text-teal-900 focus-visible:ring-2 focus-visible:ring-teal-600">
                  Edit profile
                </button>
              )}
            </div>

            {success && <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">{success}</p>}
            {apiError && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{apiError}</p>}

            {editing ? (
              <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
                <div className="grid gap-5 sm:grid-cols-2">
                  {editableFields.map(({ name, label, autoComplete }) => (
                    <div key={name} className={name === "phone_number" ? "sm:col-span-2" : ""}>
                      <label htmlFor={name} className="mb-2 block text-sm font-semibold text-slate-700">{label}{name !== "phone_number" && <span className="ml-1 text-red-600" aria-hidden="true">*</span>}</label>
                      <input
                        id={name}
                        name={name}
                        type={name === "phone_number" ? "tel" : "text"}
                        autoComplete={autoComplete}
                        maxLength={name === "phone_number" ? 20 : 150}
                        required={name !== "phone_number"}
                        value={form[name]}
                        onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))}
                        aria-invalid={Boolean(errors[name])}
                        aria-describedby={errors[name] ? `${name}-error` : undefined}
                        className={`w-full rounded-xl border bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 ${errors[name] ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "border-slate-300 focus:border-teal-600 focus:ring-teal-100"}`}
                      />
                      {name === "phone_number" && <p className="mt-1.5 text-xs text-slate-500">If you choose mobile money at checkout, the operator can send the payment approval prompt to this number. You approve the payment on your phone.</p>}
                      {errors[name] && <p id={`${name}-error`} className="mt-1.5 text-sm text-red-700">{errors[name]}</p>}
                    </div>
                  ))}
                </div>
                <div>
                  <label htmlFor="profile-email" className="mb-2 block text-sm font-semibold text-slate-700">Email address</label>
                  <input id="profile-email" type="email" value={profile.email} disabled className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-500" />
                  <p className="mt-2 text-xs leading-5 text-slate-500">Email is used for sign-in and cannot be changed here.</p>
                </div>
                <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                  <button type="button" onClick={cancelEditing} disabled={saving} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-60">Cancel</button>
                  <button type="submit" disabled={saving} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">{saving ? "Saving..." : "Save changes"}</button>
                </div>
              </form>
            ) : (
              <dl className="mt-2 divide-y divide-slate-100">
                <div className="grid gap-1 py-5 sm:grid-cols-[minmax(9rem,0.7fr)_1.3fr] sm:items-center sm:gap-4"><dt className="text-sm font-medium text-slate-500">First name</dt><dd className="break-words font-semibold text-slate-900">{profile.first_name || "Not provided"}</dd></div>
                <div className="grid gap-1 py-5 sm:grid-cols-[minmax(9rem,0.7fr)_1.3fr] sm:items-center sm:gap-4"><dt className="text-sm font-medium text-slate-500">Last name</dt><dd className="break-words font-semibold text-slate-900">{profile.last_name || "Not provided"}</dd></div>
                <div className="grid gap-1 py-5 sm:grid-cols-[minmax(9rem,0.7fr)_1.3fr] sm:items-center sm:gap-4"><dt className="text-sm font-medium text-slate-500">Phone number</dt><dd className="break-words font-semibold text-slate-900">{profile.phone_number || "Not provided"}</dd></div>
                <div className="grid gap-1 py-5 sm:grid-cols-[minmax(9rem,0.7fr)_1.3fr] sm:items-center sm:gap-4"><dt className="text-sm font-medium text-slate-500">Email address</dt><dd className="break-all font-semibold text-slate-900">{profile.email}</dd></div>
              </dl>
            )}
          </section>
        </div>
        <section className="surface-card mt-5 flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6" aria-labelledby="google-signin-heading">
          <div>
            <h2 id="google-signin-heading" className="font-bold text-slate-900">Google sign-in</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{profile.google_linked ? "A Google account is connected. You can use it to sign in to SUPAS." : "Connect the Google account that uses this same email address. We use it only for identity; SUPAS does not access your Gmail inbox."}</p>
            {googleError && <p className="mt-2 text-sm text-red-700" role="alert">{googleError}</p>}
            {googleSuccess && <p className="mt-2 text-sm text-emerald-800" role="status">{googleSuccess}</p>}
          </div>
          {profile.google_linked ? (
            <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"><span className="h-2 w-2 rounded-full bg-emerald-600" aria-hidden="true" />Connected</span>
          ) : (
            <div className={linkingGoogle ? "pointer-events-none shrink-0 opacity-60" : "shrink-0"}>
              <GoogleSignInButton onCredential={handleGoogleCredential} disabled={linkingGoogle} />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
