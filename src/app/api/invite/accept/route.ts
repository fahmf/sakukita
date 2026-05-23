import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  let body: { token?: unknown };
  try {
    body = (await req.json()) as { token?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const token =
    typeof body.token === "string" ? body.token.trim() : "";
  if (!token || token.length > 200) {
    return NextResponse.json(
      { error: "Token undangan tidak valid" },
      { status: 400 }
    );
  }

  let user = null;
  const supabase = await createClient();
  try {
    const {
      data: { user: fetchedUser },
    } = await supabase.auth.getUser();
    user = fetchedUser;
  } catch (err) {
    console.error("Auth getUser failed inside API accept invite:", err);
  }

  if (!user) {
    return NextResponse.json(
      { error: "Harus login terlebih dahulu" },
      { status: 401 }
    );
  }

  // RPC type plumbing through @supabase/ssr generics is partial; cast for now
  const { data, error } = await (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{
      data: { household_id: string; role: string }[] | null;
      error: { code?: string; message: string } | null;
    }>
  )("accept_invite", { p_token: token });

  if (error) {
    const status =
      error.code === "P0002"
        ? 404
        : error.code === "P0001"
        ? 410
        : 500;
    return NextResponse.json(
      { error: error.message ?? "Gagal menerima undangan" },
      { status }
    );
  }

  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    household_id: row?.household_id ?? null,
    role: row?.role ?? null,
  });
}
