export default function Input({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  id,
  name,
  autoComplete,
  required = false,
  disabled = false,
  error = "",
}) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={id || name} className="text-sm font-semibold text-slate-700">
          {label}
        </label>
      )}

      <input
        id={id || name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id || name}-error` : undefined}
        className={`w-full rounded-xl border bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-100 disabled:bg-slate-50 ${error ? "border-red-400" : "border-slate-300"}`}
      />
      {error && <p id={`${id || name}-error`} className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
