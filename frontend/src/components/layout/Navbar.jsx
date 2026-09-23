import { Link } from "react-router-dom";
import Button from "../ui/Button";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white shadow">
            P
          </div>

          <div>
            <h1 className="text-xl font-bold text-slate-800">
              SUPAS
            </h1>

            <p className="text-xs text-gray-500">
              Smart Urban Parking
            </p>
          </div>
        </Link>

        <nav className="hidden gap-8 font-medium md:flex">
          <a href="#home" className="hover:text-blue-600">
            Home
          </a>

          <a href="#features" className="hover:text-blue-600">
            Features
          </a>

          <a href="#how" className="hover:text-blue-600">
            How It Works
          </a>

          <a href="#contact" className="hover:text-blue-600">
            Contact
          </a>
        </nav>

        <div className="flex gap-3">
          <Link to="/login">
            <Button variant="secondary">
              Login
            </Button>
          </Link>

          <Link to="/register">
            <Button>
              Get Started
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
