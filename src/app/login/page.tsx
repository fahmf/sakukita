import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = { title: "Masuk — Saku Kita" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-mint text-lg font-bold text-foreground">
            S
          </span>
          <span className="text-xl font-semibold">Saku Kita</span>
        </Link>

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold">Masuk ke Saku Kita</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catat keuangan keluarga, simpel banget.
          </p>
        </div>

        <LoginForm next={next ?? "/dashboard"} error={error} />

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Dengan masuk, kamu setuju Saku Kita menyimpan data keuanganmu secara
          privat dan aman.
        </p>
      </div>
    </main>
  );
}
