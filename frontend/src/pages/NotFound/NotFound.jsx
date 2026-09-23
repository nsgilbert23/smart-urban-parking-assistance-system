import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
      <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow">
        <h1 className="text-3xl font-bold text-slate-900">
          Page not found
        </h1>

        <p className="mt-3 text-slate-600">
          The page you are looking for does not exist.
        </p>

        <Link
          to="/"
          className="mt-6 inline-flex rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
