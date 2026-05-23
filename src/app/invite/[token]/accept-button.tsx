"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const accept = async () => {
    setPending(true);
    try {
      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Gagal menerima undangan");
      }
      toast.success("Undangan diterima. Mengalihkan...");
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menerima undangan";
      toast.error(message);
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      onClick={accept}
      disabled={pending}
      className="h-12 w-full rounded-2xl bg-mint-strong text-base font-semibold text-white hover:bg-mint-strong/90"
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin mr-2" /> Memproses...
        </>
      ) : (
        "Terima undangan"
      )}
    </Button>
  );
}
