import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AcceptInviteButton } from "./accept-button";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function InviteAcceptPage({ params }: PageProps) {
  const { token } = await params;

  if (!token || token.length > 200) {
    return (
      <ErrorShell
        title="Link tidak valid"
        message="Token undangan tidak ditemukan."
      />
    );
  }

  let user = null;
  try {
    const supabase = await createClient();
    const {
      data: { user: fetchedUser },
    } = await supabase.auth.getUser();
    user = fetchedUser;
  } catch (err) {
    console.error("Auth check failed in invite route:", err);
  }

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-mint-soft text-mint-strong text-2xl">
        ✉
      </span>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Undangan Saku Kita</h1>
        <p className="text-sm text-muted-foreground">
          Kamu diundang bergabung ke sebuah household. Terima undangan untuk
          mulai berbagi catatan keuangan.
        </p>
      </div>
      <AcceptInviteButton token={token} />
      <Link
        href="/dashboard"
        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        Lewati & buka dashboard
      </Link>
    </main>
  );
}

function ErrorShell({ title, message }: { title: string; message: string }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Link
        href="/dashboard"
        className="rounded-xl bg-mint-strong px-4 py-2 text-sm font-semibold text-white hover:bg-mint-strong/90"
      >
        Kembali ke dashboard
      </Link>
    </main>
  );
}
