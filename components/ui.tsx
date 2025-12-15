import React from "react";
import clsx from "clsx";

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary"|"ghost"|"danger" }) {
  const { className, variant="primary", ...rest } = props;
  const base = "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition border";
  const styles = {
    primary: "bg-[rgb(var(--brand))] text-black border-transparent hover:opacity-90",
    ghost: "bg-transparent text-[rgb(var(--fg))] border-[rgb(var(--border))] hover:bg-[rgb(var(--card))]",
    danger: "bg-red-600 text-white border-transparent hover:opacity-90",
  }[variant];
  return <button className={clsx(base, styles, className)} {...rest} />;
}
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("rounded-xl border bg-[rgb(var(--card))] p-4", className)} {...props} />;
}
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input className={clsx("w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--brand))]", className)} {...rest} />;
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props;
  return <select className={clsx("w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--brand))]", className)} {...rest} />;
}
export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={clsx("text-sm text-[rgb(var(--muted))]", className)} {...props} />;
}
export function Divider() { return <div className="my-3 h-px w-full bg-[rgb(var(--border))]" />; }
