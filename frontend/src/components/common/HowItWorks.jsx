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
    title: "Park Your Vehicle",
    description: "Occupy the selected parking slot and start your parking session.",
  },
  {
    number: "04",
    title: "Pay & Leave",
    description: "The system calculates your parking fee automatically.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="bg-slate-50 py-24">
      <div className="mx-auto max-w-7xl px-6">

        <div className="mb-20 text-center">
          <h2 className="text-4xl font-bold">
            How It Works
          </h2>

          <p className="mt-4 text-lg text-gray-600">
            Parking has never been this simple.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step) => (
            <div
              key={step.number}
              className="rounded-xl bg-white p-8 text-center shadow-sm"
            >
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white">
                {step.number}
              </div>

              <h3 className="mb-4 text-xl font-bold">
                {step.title}
              </h3>

              <p className="text-gray-600">
                {step.description}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}