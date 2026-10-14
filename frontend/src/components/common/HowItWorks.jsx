const steps = [
  {
    number: "01",
    title: "Register",
    description: "Create your account and register your vehicle.",
  },
  {
    number: "02",
    title: "Find a Parking Space",
    description: "Search for available parking spaces in real time.",
  },
  {
    number: "03",
    title: "Arrive and park",
    description: "The slot sensor confirms arrival and starts the parking session.",
  },
  {
    number: "04",
    title: "Leave when ready",
    description: "The slot sensor records departure and completes the session.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="bg-slate-50 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        <div className="mb-12 max-w-2xl">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            How It Works
          </h2>

          <p className="mt-4 text-lg leading-7 text-slate-600">
            A straightforward path from finding a space to completing your session.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map((step) => (
            <div
              key={step.number}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-sm font-bold text-teal-800">
                {step.number}
              </div>

              <h3 className="mb-2 text-lg font-bold text-slate-900">
                {step.title}
              </h3>

              <p className="text-sm leading-6 text-slate-600">
                {step.description}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
