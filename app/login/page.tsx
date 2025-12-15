import LoginForm from "./ui-login";
export default function Page() {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-[rgb(var(--card))] p-6">
        <h1 className="text-2xl font-semibold">Nessie 2026</h1>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">Inicia sesión para continuar.</p>
        <div className="mt-6"><LoginForm /></div>
      </div>
    </div>
  );
}
