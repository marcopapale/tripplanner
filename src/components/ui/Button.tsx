import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-sunset text-white hover:bg-sunset-dark shadow-sm shadow-sunset/30",
  secondary:
    "bg-lagoon text-white hover:bg-lagoon-dark shadow-sm shadow-lagoon/30",
  ghost: "bg-white text-foreground border border-gray-200 hover:bg-gray-50",
  danger: "bg-red-50 text-red-600 hover:bg-red-100",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
