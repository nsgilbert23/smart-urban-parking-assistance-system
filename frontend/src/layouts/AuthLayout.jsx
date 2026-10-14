import { Link } from "react-router-dom";

export default function AuthLayout({ eyebrow, title, description, children }) {
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[0.95fr_1.05fr]">
      <aside className="relative hidden overflow-hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div aria-hidden="true" className="absolute -right-36 top-20 h-[30rem] w-[30rem] rounded-full border border-white/10" />
        <div aria-hidden="true" className="absolute -right-20 top-36 h-[22rem] w-[22rem] rounded-full border border-white/10" />
        <div aria-hidden="true" className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-teal-700/20 blur-3xl" />
        <Link to="/" className="relative z-10 flex w-fit items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500 text-lg font-bold text-slate-950">S</span>
          <span>
            <span className="block text-sm font-extrabold tracking-wide">SUPAS</span>
            <span className="text-xs text-slate-400">Smart Urban Parking</span>
          </span>
        </Link>
        <div className="relative z-10 max-w-xl py-16">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-300">Parking, made clearer</p>
          <h2 className="mt-5 text-4xl font-bold leading-tight tracking-tight xl:text-5xl">One place for every part of your parking journey.</h2>
          <p className="mt-5 max-w-lg leading-7 text-slate-300">Manage vehicles, find a space, and keep your sessions organized through a connected account.</p>
          <div className="mt-9 grid grid-cols-3 gap-3 border-t border-white/10 pt-6 text-xs font-medium text-slate-300">
            <span>Find spaces</span><span>Manage vehicles</span><span>Track sessions</span>
          </div>
        </div>
        <p className="relative z-10 text-xs text-slate-500">Smart Urban Parking Assistance System</p>
      </aside>

      <section className="flex min-h-screen flex-col items-center justify-center px-4 py-8 sm:px-8 lg:px-12 xl:px-20">
        <div className="mb-8 w-full max-w-md lg:hidden">
          <Link to="/" className="inline-flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 font-bold text-white">S</span>
            <span className="text-sm font-extrabold tracking-wide text-slate-900">SUPAS</span>
          </Link>
        </div>
        <div className="w-full max-w-md">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
        <p className="mt-10 text-center text-xs text-slate-400">© 2026 SUPAS · Secure account access</p>
      </section>
    </main>
  );
}
