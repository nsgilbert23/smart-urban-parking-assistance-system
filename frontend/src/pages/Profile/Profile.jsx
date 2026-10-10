import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getProfile, updateProfile } from "../../services/profileService";

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

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-gray-100 px-4" aria-busy="true">
        <p className="text-gray-600" role="status">Loading your profile…</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-[60vh] bg-gray-100 px-4 py-12">
        <div className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow" role="alert">
          <h1 className="text-2xl font-bold text-gray-900">Profile unavailable</h1>
          <p className="mt-3 text-red-700">{apiError}</p>
          <Link className="mt-5 inline-block font-semibold text-blue-700 hover:underline" to="/dashboard">Return to dashboard</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-100 px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <Link to="/dashboard" className="text-sm font-semibold text-blue-700 hover:underline">← Dashboard</Link>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">Driver Profile</h1>
          <p className="mt-2 text-gray-600">Review and update your contact details.</p>
        </div>

        <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-8" aria-labelledby="profile-details-heading">
          <div className="flex flex-col justify-between gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium text-gray-500">Signed in as</p>
              <h2 className="mt-1 text-xl font-semibold text-gray-900">{profile.first_name} {profile.last_name}</h2>
              <p className="mt-1 break-all text-gray-600">{profile.email}</p>
            </div>
            <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-800">{profile.role}</span>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <h2 id="profile-details-heading" className="text-lg font-semibold text-gray-900">Contact details</h2>
            {!editing && (
              <button type="button" onClick={beginEditing} className="rounded-lg border border-blue-700 px-4 py-2 font-semibold text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">Edit profile</button>
            )}
          </div>

          {success && <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800" role="status">{success}</p>}
          {apiError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{apiError}</p>}

          {editing ? (
            <form className="mt-5 space-y-5" onSubmit={handleSubmit} noValidate>
              {editableFields.map(({ name, label, autoComplete }) => (
                <div key={name}>
                  <label htmlFor={name} className="mb-2 block text-sm font-medium text-gray-700">{label}</label>
                  <input
                    id={name}
                    name={name}
                    type="text"
                    autoComplete={autoComplete}
                    maxLength={name === "phone_number" ? 20 : 150}
                    required={name !== "phone_number"}
                    value={form[name]}
                    onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))}
                    aria-invalid={Boolean(errors[name])}
                    aria-describedby={errors[name] ? `${name}-error` : undefined}
                    className={`w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 ${errors[name] ? "border-red-500 focus:ring-red-200" : "border-gray-300 focus:border-blue-500 focus:ring-blue-200"}`}
                  />
                  {errors[name] && <p id={`${name}-error`} className="mt-1 text-sm text-red-700">{errors[name]}</p>}
                </div>
              ))}
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700">Email address</label>
                <input id="email" type="email" value={profile.email} disabled className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-500" />
                <p className="mt-1 text-sm text-gray-500">Email is managed by your sign-in account.</p>
              </div>
              <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-5 sm:flex-row sm:justify-end">
                <button type="button" onClick={cancelEditing} disabled={saving} className="rounded-lg border border-gray-300 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60">{saving ? "Saving…" : "Save changes"}</button>
              </div>
            </form>
          ) : (
            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              <div><dt className="text-sm font-medium text-gray-500">First name</dt><dd className="mt-1 break-words text-gray-900">{profile.first_name}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Last name</dt><dd className="mt-1 break-words text-gray-900">{profile.last_name}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Phone number</dt><dd className="mt-1 break-words text-gray-900">{profile.phone_number || "Not provided"}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Email address</dt><dd className="mt-1 break-all text-gray-900">{profile.email}</dd></div>
            </dl>
          )}
        </section>
      </div>
    </main>
  );
}
