import { Link } from "react-router-dom";
import useAuth from "../../hooks/useAuth";

const shortcuts = [
  {
    to: "/parking",
    number: "01",
    title: "Find a parking space",
    detail: "Browse availability and reserve a slot for your vehicle.",
    accent: "bg-teal-50 text-teal-800",
    action: "Find parking",
  },
  {
    to: "/vehicles",
    number: "02",
    title: "Your vehicles",
    detail: "Keep your vehicle information up to date.",
    accent: "bg-sky-50 text-sky-800",
    action: "Manage vehicles",
  },
  {
    to: "/parking-sessions",
    number: "03",
    title: "Active sessions",
    detail: "Check current parking activity and session status.",
    accent: "bg-amber-50 text-amber-800",
    action: "View sessions",
  },
  {
    to: "/parking-history",
    number: "04",
    title: "Parking history",
    detail: "Review previous stays, durations, and recorded costs.",
    accent: "bg-violet-50 text-violet-800",
    action: "View history",
  },
];

export default function Dashboard() {
  const { user } = useAuth();
  const firstName = user?.first_name || "there";

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <section className="relative isolate overflow-hidden rounded-3xl bg-slate-900 px-6 py-8 text-white shadow-lg sm:px-10 sm:py-11">
        <div aria-hidden="true" className="absolute -right-16 -top-24 -z-10 h-72 w-72 rounded-full border-[36px] border-white/5" />
        <div aria-hidden="true" className="absolute right-28 top-28 -z-10 h-32 w-32 rounded-full bg-teal-500/15 blur-2xl" />
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-300">Driver workspace</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Good to see you, {firstName}</h1>
        <p className="mt-3 max-w-xl leading-7 text-slate-300">
          Plan your arrival, keep your vehicles organized, and follow every parking session from one place.
        </p>
        <Link
          to="/parking"
          className="mt-7 inline-flex items-center gap-2 rounded-xl bg-teal-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-teal-300 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          Find parking <span aria-hidden="true">→</span>
        </Link>
      </section>

      <section className="mt-10" aria-labelledby="shortcuts-heading">
        <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">Your account</p>
            <h2 id="shortcuts-heading" className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Everything in one place</h2>
          </div>
          <p className="text-sm text-slate-500">Choose a service to continue</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {shortcuts.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              <div className="flex items-center justify-between">
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl text-xs font-bold tracking-wide ${item.accent}`}>
                  {item.number}
                </span>
                <span aria-hidden="true" className="text-lg text-slate-300 transition group-hover:translate-x-1 group-hover:text-teal-700">→</span>
              </div>
              <h3 className="mt-5 text-lg font-bold text-slate-900">{item.title}</h3>
              <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{item.detail}</p>
              <p className="mt-5 text-sm font-semibold text-teal-800">{item.action}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="font-semibold text-slate-900">Need to update your contact details?</p>
          <p className="mt-1 text-sm text-slate-600">Your profile keeps your account information current.</p>
        </div>
        <Link to="/profile" className="inline-flex w-fit items-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
          Open profile
        </Link>
      </section>
    </main>
  );
}
