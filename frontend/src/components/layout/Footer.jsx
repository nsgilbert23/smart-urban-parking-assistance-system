import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer id="contact" className="border-t border-white/10 bg-slate-950 py-10 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-7 px-4 sm:px-6 md:flex-row md:items-end md:justify-between lg:px-8">
        <div>
          <p className="text-lg font-extrabold tracking-wide">SUPAS</p>
          <p className="mt-2 text-sm text-slate-400">Smart Urban Parking Assistance System</p>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400">
          <a href="#features" className="hover:text-white">Platform</a>
          <a href="#how" className="hover:text-white">How it works</a>
          <Link to="/login" className="hover:text-white">Sign in</Link>
          <span>© 2026 SUPAS</span>
        </div>
      </div>
    </footer>
  );
}
