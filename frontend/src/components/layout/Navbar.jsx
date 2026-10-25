import { useState } from "react";
import { Link } from "react-router-dom";
export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigation = [
    ["#locations", "Locations"],
    ["#features", "Platform"],
    ["#how", "How it works"],
    ["#contact", "About"],
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-18 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-lg font-bold text-white shadow-sm">S</span>

          <div>
            <span className="block text-sm font-extrabold tracking-wide text-slate-900">SUPAS</span>
            <span className="text-xs text-slate-500">Smart Urban Parking</span>
          </div>
        </Link>

        <nav aria-label="Main navigation" className={`${menuOpen ? "flex" : "hidden"} order-3 w-full flex-col gap-1 border-t border-slate-100 pt-3 sm:order-none sm:flex sm:w-auto sm:flex-row sm:border-0 sm:pt-0`}>
          {navigation.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-teal-800">
              {label}
            </a>
          ))}
          <Link to="/login" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 sm:hidden">Sign in</Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/login" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:inline-flex">Sign in</Link>
          <Link to="/register" className="rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 sm:px-4"><span className="sm:hidden">Join</span><span className="hidden sm:inline">Create account</span></Link>
          <button type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 sm:hidden">
            <span aria-hidden="true">{menuOpen ? "×" : "☰"}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
