import Link from "next/link";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      aria-label="CER Analytics, inicio"
      className={`inline-flex items-center gap-3 ${light ? "text-white" : "text-foreground"}`}
      href="/"
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest text-xs font-extrabold tracking-wide text-white shadow-sm"
      >
        CER
      </span>
      <span className="text-lg font-semibold tracking-tight">
        CER <span className={light ? "text-[#a9d6b9]" : "text-forest"}>Analytics</span>
      </span>
    </Link>
  );
}
