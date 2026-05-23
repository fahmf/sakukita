"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export function LoginForm({ next }: { next: string }) {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState<"google" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const callback = (origin: string) =>
    `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function signInWithGoogle() {
    setLoading("google");
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback(window.location.origin) },
    });
    if (error) {
      setError("Gagal masuk dengan Google. Coba lagi.");
      setLoading(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading("submit");
    setError(null);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message === "Invalid login credentials" 
          ? "Email atau password salah." 
          : error.message);
        setLoading(null);
      } else {
        window.location.href = next;
      }
    } else {
      // signup
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: email.split("@")[0], // Seed a default name
          }
        }
      });
      if (error) {
        setError(error.message);
        setLoading(null);
      } else if (!data.session) {
        setError("Akun berhasil dibuat. Harap cek email untuk verifikasi.");
        setLoading(null);
      } else {
        window.location.href = next;
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        variant="outline"
        className="h-11 w-full gap-2"
        onClick={signInWithGoogle}
        disabled={loading !== null}
      >
        {loading === "google" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        Lanjutkan dengan Google
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        atau
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="kamu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-11"
          />
        </div>

        <Button
          type="submit"
          className="h-11 w-full gap-2 mt-2 bg-mint-strong hover:bg-mint-strong/90 text-white rounded-xl"
          disabled={loading !== null || !email || !password}
        >
          {loading === "submit" && <Loader2 className="size-4 animate-spin" />}
          {mode === "login" ? "Masuk" : "Daftar Akun Baru"}
        </Button>
      </form>

      {error && <p className="text-sm text-expense">{error}</p>}

      <div className="text-center text-xs mt-2">
        {mode === "login" ? (
          <p className="text-muted-foreground">
            Belum punya akun?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className="text-mint-strong font-semibold hover:underline cursor-pointer"
            >
              Daftar gratis
            </button>
          </p>
        ) : (
          <p className="text-muted-foreground">
            Sudah punya akun?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className="text-mint-strong font-semibold hover:underline cursor-pointer"
            >
              Masuk di sini
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
