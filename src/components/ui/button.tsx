import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonProps) {
  const variantClasses =
    variant === "primary"
      ? "border-forest bg-forest text-white hover:bg-forest-dark disabled:bg-forest/60"
      : "border-border bg-white text-foreground hover:bg-mist disabled:bg-white";

  return (
    <button
      className={`inline-flex min-h-12 items-center justify-center rounded-xl border px-5 py-3 text-sm font-semibold shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses} ${className}`}
      {...props}
    />
  );
}
