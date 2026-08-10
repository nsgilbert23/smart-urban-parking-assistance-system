import Button from "../ui/Button";

export default function CTA() {
  return (
    <section className="bg-blue-600 py-24 text-white">
      <div className="mx-auto max-w-4xl px-6 text-center">

        <h2 className="text-5xl font-bold">
          Ready to Experience Smarter Parking?
        </h2>

        <p className="mt-6 text-xl text-blue-100">
          Join SUPAS today and discover a faster, smarter, and more convenient
          way to park in urban areas.
        </p>

        <div className="mt-10">
          <Button
            className="bg-white text-blue-600 hover:bg-gray-100"
          >
            Get Started
          </Button>
        </div>

      </div>
    </section>
  );
}