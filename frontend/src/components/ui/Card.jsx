export default function Card({ children, className = "" }) {
  return (
    <div
      className={`
        rounded-xl
        bg-white
        p-6
        shadow-sm
        transition
        hover:shadow-lg
        ${className}
      `}
    >
      {children}
    </div>
  );
}