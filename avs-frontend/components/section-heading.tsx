export function SectionHeading({
  eyebrow,
  title,
  summary,
  align = "center",
  dark = false,
}: {
  eyebrow: string;
  title: string;
  summary?: string;
  align?: "center" | "left";
  dark?: boolean;
}) {
  const alignment = align === "center" ? "mx-auto text-center" : "text-left";
  return (
    <div className={`max-w-3xl ${alignment}`}>
      <span
        className={`text-sm font-bold uppercase tracking-[0.24em] ${
          dark ? "text-brand-green" : "text-brand-blue"
        }`}
      >
        {eyebrow}
      </span>
      <h2
        className={`mt-3 font-heading text-3xl font-extrabold tracking-tight text-balance md:text-4xl ${
          dark ? "text-white" : "text-navy"
        }`}
      >
        {title}
      </h2>
      {summary ? (
        <p className={`mt-4 text-base leading-7 md:text-lg ${dark ? "text-slate-300" : "text-slate-600"}`}>
          {summary}
        </p>
      ) : null}
    </div>
  );
}
