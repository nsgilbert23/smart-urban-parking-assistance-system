export default function Footer() {
  return (
    <footer id="contact" className="bg-slate-900 py-12 text-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
        <div>
          <h2 className="text-2xl font-bold">
            SUPAS
          </h2>

          <p className="mt-2 text-gray-400">
            Smart Urban Parking Assistance System
          </p>
        </div>

        <div className="text-center text-gray-400 md:text-right">
          <p>University of Rwanda</p>
          <p>Computer Engineering</p>
          <p>Copyright 2026. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
