import Card from "../ui/Card";

const features = [
  {
    icon: "01",
    title: "Live slot visibility",
    description:
      "Review available, reserved, occupied, and maintenance spaces before you set out.",
  },
  {
    icon: "02",
    title: "Simple reservations",
    description:
      "Choose a zone, vehicle, and available slot through a clear reservation flow.",
  },
  {
    icon: "03",
    title: "Session visibility",
    description:
      "See active sessions and review recorded duration and cost in your account.",
  },
  {
    icon: "04",
    title: "Operator workspace",
    description:
      "Give parking teams a focused view of occupancy, slots, and active sessions.",
  },
];

export default function Features() {
  return (
    <section id="features" className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 max-w-2xl">
          <p className="eyebrow">A connected platform</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Designed for the full parking journey
          </h2>

          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
            Drivers and parking teams share a clearer view of availability, reservations, and sessions.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => (
            <Card
              key={feature.title}
              interactive
              className="border-slate-200 p-6 hover:border-teal-200"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-xs font-bold tracking-wide text-teal-800">
                {feature.icon}
              </div>

              <h3 className="mb-2 text-lg font-bold text-slate-900">
                {feature.title}
              </h3>

              <p className="text-sm leading-6 text-slate-600">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
