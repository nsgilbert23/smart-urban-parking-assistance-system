import { Link } from "react-router-dom";

export default function Hero() {
  return (
    <section id="home" className="overflow-hidden bg-[#f4f7fa]">
      <div className="mx-auto grid min-h-[650px] max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-teal-800 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-teal-500" aria-hidden="true" />
            Smart city mobility
          </span>

          <h1 className="mt-7 max-w-2xl text-5xl font-bold leading-[1.08] tracking-[-0.045em] text-slate-950 sm:text-6xl lg:text-7xl">
            Parking that works around <span className="text-teal-700">your day.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            Find a space, reserve with confidence, and keep your parking journey organized with one connected platform.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link to="/register" className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">Create your account <span aria-hidden="true">→</span></Link>
            <a href="#features" className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Explore the platform</a>
          </div>

          <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 border-t border-slate-200 pt-6 text-sm text-slate-600">
            <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-teal-600" />Sensor-informed availability</span>
            <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-teal-600" />Clear session tracking</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <div aria-hidden="true" className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-teal-200/60 blur-3xl" />
          <div aria-hidden="true" className="absolute -bottom-12 -left-10 h-52 w-52 rounded-full bg-sky-200/60 blur-3xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-white bg-slate-900 p-5 shadow-2xl shadow-slate-900/15 sm:p-7">
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-teal-300">SUPAS platform</p>
                <p className="mt-1 text-lg font-semibold text-white">A smoother arrival</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-teal-300" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.7"><path d="M5 20V5a2 2 0 0 1 2-2h8a4 4 0 0 1 4 4v13M3 20h18M9 7h6M9 11h6M9 15h2" /><path d="M16 16h3v4h-3z" /></svg>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4" aria-label="Illustration of the parking journey">
              {[
                ["01", "Choose a zone", "Review parking options"],
                ["02", "Reserve a space", "Confirm your selection"],
                ["03", "Arrive and park", "Sensor starts your session"],
                ["04", "Leave with ease", "Session closes on departure"],
              ].map(([number, title, detail]) => (
                <div key={number} className="min-h-32 rounded-2xl border border-white/10 bg-white/[0.06] p-4 sm:p-5">
                  <p className="text-xs font-bold tracking-[0.12em] text-teal-300">{number}</p>
                  <h2 className="mt-4 font-semibold text-white">{title}</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-center text-xs text-slate-400">One connected parking experience, from reservation to departure.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
