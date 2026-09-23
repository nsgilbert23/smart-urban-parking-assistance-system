import Card from "../ui/Card";

const features = [
  {
    icon: "P",
    title: "Real-Time Parking Detection",
    description:
      "Instantly view available parking spaces without driving around the city.",
  },
  {
    icon: "Map",
    title: "Interactive Parking Map",
    description:
      "Locate the nearest available parking space with directions to your destination.",
  },
  {
    icon: "Bell",
    title: "Smart Notifications",
    description:
      "Receive reminders before your parking time expires and extend your session if needed.",
  },
  {
    icon: "Pay",
    title: "Automatic Billing",
    description:
      "Parking fees are calculated automatically based on the selected pricing rule.",
  },
];

export default function Features() {
  return (
    <section id="features" className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <h2 className="text-4xl font-bold text-slate-900">
            Why Choose SUPAS?
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            We combine smart technology, automation, and user-friendly design
            to make urban parking easier and more efficient.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="text-center hover:-translate-y-2"
            >
              <div className="mb-5 text-3xl font-bold text-blue-600">
                {feature.icon}
              </div>

              <h3 className="mb-4 text-xl font-bold">
                {feature.title}
              </h3>

              <p className="text-gray-600">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
