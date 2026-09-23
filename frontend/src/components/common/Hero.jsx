import { Link } from "react-router-dom";
import Button from "../ui/Button";

export default function Hero() {
  return (
    <section id="home" className="bg-slate-50">
      <div className="mx-auto grid min-h-[85vh] max-w-7xl grid-cols-1 items-center gap-16 px-6 py-20 lg:grid-cols-2">
        <div>
          <span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
            Smart City Parking Solution
          </span>

          <h1 className="mt-6 text-5xl font-extrabold leading-tight text-slate-900 lg:text-6xl">
            Find Parking
            <span className="text-blue-600">
              {" "}Before{" "}
            </span>
            You Arrive
          </h1>

          <p className="mt-8 max-w-xl text-lg leading-8 text-gray-600">
            Smart Urban Parking Assistance System helps drivers locate
            available parking spaces in real time, receive parking reminders,
            and reduce time spent searching for parking.
          </p>

          <div className="mt-10 flex gap-4">
            <Link to="/register">
              <Button>
                Get Started
              </Button>
            </Link>

            <a href="#features">
              <Button variant="secondary">
                Learn More
              </Button>
            </a>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="flex h-[420px] w-full max-w-md items-center justify-center rounded-3xl border-2 border-dashed border-blue-300 bg-white shadow-lg">
            <div className="text-center">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-blue-600 text-5xl font-bold text-white">
                P
              </div>

              <h3 className="mt-6 text-2xl font-bold">
                Parking Availability
              </h3>

              <p className="mt-3 text-gray-500">
                View parking zones, available slots, and active sessions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
