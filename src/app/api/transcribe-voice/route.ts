import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 512 * 1024;
const formats: Record<string, string> = {
  "audio/webm": "audio/webm",
  "audio/ogg": "audio/ogg",
  "audio/mp4": "audio/m4a",
};

function error(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return error("Masuk kembali untuk mentranskripsikan rekaman.", 401);

  const type = req.headers.get("content-type")?.split(";")[0] ?? "";
  if (!Object.hasOwn(formats, type)) return error("Format rekaman tidak didukung.", 415);
  if (Number(req.headers.get("content-length")) > MAX_BYTES) return error("Rekaman terlalu besar.", 413);
  const reader = req.body?.getReader();
  if (!reader) return error("Rekaman kosong.", 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > MAX_BYTES) {
      await reader.cancel();
      return error("Rekaman terlalu besar.", 413);
    }
    chunks.push(value);
  }
  if (!length) return error("Rekaman kosong.", 400);
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return error("Layanan transkripsi belum dikonfigurasi.", 503);
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        signal: AbortSignal.timeout(25_000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: "Transkripsikan hanya kata-kata yang terdengar dalam rekaman bahasa Indonesia. Pertahankan nominal, nama dompet dan tag persis seperti diucapkan. Jangan menebak. Jika tidak ada ucapan yang jelas, kembalikan transcript berupa string kosong." }] },
          contents: [{ role: "user", parts: [{ inlineData: { mimeType: formats[type], data: Buffer.concat(chunks).toString("base64") } }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: { type: "OBJECT", properties: { transcript: { type: "STRING" } }, required: ["transcript"] },
          },
        }),
      },
    );
    if (!response.ok) {
      return error(response.status === 429 ? "Layanan suara sedang sibuk. Coba lagi sebentar." : "Layanan transkripsi gagal. Coba lagi.", 503);
    }
    const result = await response.json();
    const output = result.candidates?.[0]?.content?.parts?.find((p: {text?: string; thought?: boolean}) => !p.thought && p.text)?.text;
    const transcript = output && JSON.parse(output).transcript;
    if (typeof transcript !== "string" || !transcript.trim()) return error("Ucapan belum terbaca. Rekam ulang lebih dekat ke mikrofon.", 422);
    return Response.json({ transcript: transcript.trim().slice(0, 500) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return error("Transkripsi belum berhasil. Coba lagi.", 503);
  }
}
