import { Link } from "react-router-dom";

export default function CTA() {
  return (
    <section className="bg-slate-900 py-16 text-white sm:py-20">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">

        <p className="text-xs font-bold uppercase tracking-[0.15em] text-teal-300">Start with SUPAS</p>
        <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
          Make the next parking trip easier to plan.
        </h2>

        <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-300">
          Create your account to manage vehicles, find available spaces, and keep your sessions organized.
        </p>

        <Link to="/register" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-teal-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-teal-300 focus-visible:ring-2 focus-visible:ring-white">Create your account <span aria-hidden="true">→</span></Link>

      </div>
    </section>
  );
}
