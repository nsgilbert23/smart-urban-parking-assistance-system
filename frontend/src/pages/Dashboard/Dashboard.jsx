import { useNavigate, Link } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user"));

  function logout() {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("user");

    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navbar */}
      <nav className="bg-blue-700 shadow">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <h1 className="text-2xl font-bold text-white">
            Smart Urban Parking
          </h1>

          <button
            onClick={logout}
            className="rounded-lg bg-red-500 px-4 py-2 text-white hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl p-8">
        <h2 className="text-4xl font-bold">
          Welcome, {user?.first_name} 👋
        </h2>

        <p className="mt-2 text-gray-600">
          Welcome to the Smart Urban Parking Assistance System Dashboard.
        </p>

        {/* Cards */}
        <div className="mt-10 grid gap-6 md:grid-cols-3">

          {/* Vehicles */}
          <Link
            to="/vehicles"
            className="rounded-xl bg-white p-6 shadow transition hover:-translate-y-1 hover:shadow-lg"
          >
            <h3 className="text-xl font-semibold">Vehicles</h3>

            <p className="mt-2 text-gray-500">
              Manage your registered vehicles.
            </p>
          </Link>

          {/* Parking Sessions */}
          <div className="rounded-xl bg-white p-6 shadow">
            <h3 className="text-xl font-semibold">
              Parking Sessions
            </h3>

            <p className="mt-2 text-gray-500">
              View active and previous parking sessions.
            </p>
          </div>

          {/* Parking Zones */}
          <div className="rounded-xl bg-white p-6 shadow">
            <h3 className="text-xl font-semibold">
              Parking Zones
            </h3>

            <p className="mt-2 text-gray-500">
              Find available parking spaces nearby.
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}