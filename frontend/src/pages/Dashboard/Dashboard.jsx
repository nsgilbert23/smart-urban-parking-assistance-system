import { Link, useNavigate } from "react-router-dom";
import { storage } from "../../utils/storage";

export default function Dashboard() {
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user"));

  function logout() {
    storage.clear();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ================= NAVBAR ================= */}
      <nav className="bg-blue-700 shadow">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link
            to="/dashboard"
            className="text-2xl font-bold text-white"
          >
            Smart Urban Parking
          </Link>

          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-white md:block">
              {user?.email}
            </span>

            <Link
              to="/profile"
              className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-white"
            >
              Profile
            </Link>

            <button
              onClick={logout}
              className="rounded-lg bg-red-500 px-4 py-2 font-semibold text-white transition hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* ================= MAIN CONTENT ================= */}
      <main className="mx-auto max-w-7xl p-8">

        {/* Welcome Section */}
        <div>
          <h1 className="text-4xl font-bold text-gray-900">
            Welcome, {user?.first_name || "Driver"} 👋
          </h1>

          <p className="mt-2 text-gray-600">
            Find parking, manage your vehicles, and track your parking
            sessions easily.
          </p>
        </div>

        {/* ================= QUICK ACTION ================= */}
        <div className="mt-8 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-800 p-8 text-white shadow-lg">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold">
              Need a parking space?
            </h2>

            <p className="mt-3 text-blue-100">
              Find an available parking zone, choose your parking slot,
              select your vehicle and start your parking session.
            </p>

            <Link
              to="/parking"
              className="mt-6 inline-block rounded-lg bg-white px-6 py-3 font-bold text-blue-700 transition hover:bg-gray-100"
            >
              Find Parking →
            </Link>
          </div>
        </div>

        {/* ================= DASHBOARD CARDS ================= */}
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">

          {/* Vehicles */}
          <Link
            to="/vehicles"
            className="group rounded-xl bg-white p-6 shadow transition hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-2xl">
              🚗
            </div>

            <h2 className="mt-5 text-xl font-bold text-gray-900">
              My Vehicles
            </h2>

            <p className="mt-2 text-gray-500">
              Register and manage your vehicles.
            </p>

            <p className="mt-5 font-semibold text-blue-600 group-hover:text-blue-700">
              Manage Vehicles →
            </p>
          </Link>

          <Link
            to="/profile"
            className="group rounded-xl bg-white p-6 shadow transition hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100 text-2xl text-indigo-700" aria-hidden="true">
              {user?.first_name?.charAt(0)?.toUpperCase() || "D"}
            </div>
            <h2 className="mt-5 text-xl font-bold text-gray-900">Driver Profile</h2>
            <p className="mt-2 text-gray-500">Review your details and update your contact information.</p>
            <p className="mt-5 font-semibold text-indigo-600 group-hover:text-indigo-700">View Profile →</p>
          </Link>

          {/* Find Parking */}
          <Link
            to="/parking"
            className="group rounded-xl bg-white p-6 shadow transition hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 text-2xl">
              🅿️
            </div>

            <h2 className="mt-5 text-xl font-bold text-gray-900">
              Find Parking
            </h2>

            <p className="mt-2 text-gray-500">
              Find available parking spaces in nearby zones.
            </p>

            <p className="mt-5 font-semibold text-green-600 group-hover:text-green-700">
              Find Parking →
            </p>
          </Link>

          {/* Parking Sessions */}
          <Link
            to="/parking-sessions"
            className="group rounded-xl bg-white p-6 shadow transition hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 text-2xl">
              📋
            </div>

            <h2 className="mt-5 text-xl font-bold text-gray-900">
              Parking Sessions
            </h2>

            <p className="mt-2 text-gray-500">
              View your active and previous parking sessions.
            </p>

            <p className="mt-5 font-semibold text-purple-600 group-hover:text-purple-700">
              View Sessions →
            </p>
          </Link>

          <Link
            to="/parking-history"
            className="group rounded-xl bg-white p-6 shadow transition hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-2xl text-amber-700" aria-hidden="true">↻</div>
            <h2 className="mt-5 text-xl font-bold text-gray-900">Parking History</h2>
            <p className="mt-2 text-gray-500">Review completed and previous parking sessions.</p>
            <p className="mt-5 font-semibold text-amber-700 group-hover:text-amber-800">View History →</p>
          </Link>

        </div>

        {/* ================= PARKING WORKFLOW ================= */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900">
            How Smart Parking Works
          </h2>

          <p className="mt-2 text-gray-600">
            Follow these simple steps to park your vehicle.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3 lg:grid-cols-6">

            {/* Step 1 */}
            <div className="rounded-xl bg-white p-5 text-center shadow">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-700">
                1
              </div>

              <h3 className="mt-4 font-semibold">
                Find Zone
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                Find a nearby parking zone.
              </p>
            </div>

            {/* Step 2 */}
            <div className="rounded-xl bg-white p-5 text-center shadow">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-xl font-bold text-green-700">
                2
              </div>

              <h3 className="mt-4 font-semibold">
                Choose Slot
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                Select an available parking slot.
              </p>
            </div>

            {/* Step 3 */}
            <div className="rounded-xl bg-white p-5 text-center shadow">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 text-xl font-bold text-yellow-700">
                3
              </div>

              <h3 className="mt-4 font-semibold">
                Choose Vehicle
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                Select the vehicle you want to park.
              </p>
            </div>

            {/* Step 4 */}
            <div className="rounded-xl bg-white p-5 text-center shadow">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-xl font-bold text-purple-700">
                4
              </div>

              <h3 className="mt-4 font-semibold">
                Start Parking
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                Start your parking session.
              </p>
            </div>

            {/* Step 5 */}
            <div className="rounded-xl bg-white p-5 text-center shadow">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-xl font-bold text-orange-700">
                5
              </div>

              <h3 className="mt-4 font-semibold">
                Track Time
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                Monitor your parking time and cost.
              </p>
            </div>

            {/* Step 6 */}
            <div className="rounded-xl bg-white p-5 text-center shadow">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-xl font-bold text-red-700">
                6
              </div>

              <h3 className="mt-4 font-semibold">
                End Parking
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                Finish your session when leaving.
              </p>
            </div>

          </div>
        </div>

        {/* ================= BOTTOM ACTION ================= */}
        <div className="mt-12 rounded-xl bg-white p-6 text-center shadow">
          <h2 className="text-2xl font-bold text-gray-900">
            Ready to park?
          </h2>

          <p className="mt-2 text-gray-500">
            Start by finding an available parking space.
          </p>

          <Link
            to="/parking"
            className="mt-5 inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            Find Available Parking
          </Link>
        </div>

      </main>
    </div>
  );
}
