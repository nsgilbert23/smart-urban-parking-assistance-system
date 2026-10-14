export default function Card({ children, className = "", interactive = false }) {
  return (
    <div
      className={`surface-card p-6 ${interactive ? "transition duration-200 hover:-translate-y-0.5 hover:shadow-lg" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
