import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// The client compresses receipts to ~900px JPEG (typically < 300 KB), so 6 MB
// of base64 is generous while still stopping abuse of the paid Gemini quota.
const MAX_IMAGE_BASE64_CHARS = 6 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_CATEGORIES = 200;

export async function POST(req: NextRequest) {
  try {
    // Don't rely on middleware alone: this route spends the Gemini quota, so
    // verify the session here too.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Harus login terlebih dahulu" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const { image, mimeType } = body ?? {};
    const categories: { name: string; id: string; kind: string }[] = Array.isArray(body?.categories)
      ? body.categories.slice(0, MAX_CATEGORIES)
      : [];
    if (typeof image !== "string" || !image || typeof mimeType !== "string") {
      return NextResponse.json({ error: "Missing image data" }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json({ error: "Format gambar tidak didukung" }, { status: 415 });
    }
    if (image.length > MAX_IMAGE_BASE64_CHARS) {
      return NextResponse.json({ error: "Ukuran gambar terlalu besar" }, { status: 413 });
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key is not configured" },
        { status: 500 }
      );
    }

    // Build categories formatted list for context
    const categoriesPromptText = categories
      .map(
        (c: { name: string; id: string; kind: string }) =>
          `- Name: "${c.name}", ID: "${c.id}", Type (kind): "${c.kind}"`
      )
      .join("\n");

    const systemPrompt = `Anda adalah asisten kecerdasan buatan (AI) keuangan untuk aplikasi PWA Saku Kita.
Tugas Anda adalah membaca kuitansi/struk belanja/receipt dari gambar yang diberikan dan mengekstrak rincian transaksi:

1. Total Belanja (amount): Cari total akhir/jumlah bayar dari struk (sebagai angka bulat/integer).
2. Catatan Ringkasan (note): Buat satu baris ringkasan pengeluaran dalam Bahasa Indonesia yang informatif, padat, dan rapi. Contoh: "Belanja bulanan di Indomaret: Susu, Roti, Telur" atau "Makan siang di Solaria: Nasi Goreng, Es Teh".
3. Kategori Transaksi terdekat (category_id): Pilih satu ID kategori paling cocok dari daftar kategori aktif di Saku Kita berikut. Pastikan hanya memilih ID kategori yang memiliki kind="expense" (Pengeluaran). Jika tidak ada yang relevan, kosongkan atau biarkan null.

Daftar Kategori Aktif di Saku Kita yang Tersedia:
${categoriesPromptText}

4. Rincian Barang (items): Ekstrak daftar barang yang dibeli, harga masing-masing, dan kategori singkat barang tersebut.

Kembalikan hasil analisis dalam format JSON terstruktur yang valid sesuai dengan skema properti.`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: systemPrompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            amount: { type: "INTEGER" },
            note: { type: "STRING" },
            category_id: { type: "STRING" },
            items: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING" },
                  price: { type: "INTEGER" },
                  category: { type: "STRING" },
                },
                required: ["name", "price"],
              },
            },
          },
          required: ["amount", "note", "items"],
        },
      },
    };

    // Abort the Gemini call if it hangs so the client fails fast instead of
    // waiting indefinitely on a slow/queued upstream response.
    const controller = new AbortController();
    const GEMINI_TIMEOUT_MS = 25_000;
    const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    // Measure how long the upstream Gemini call actually takes so we can tell
    // network/upstream latency apart from client-side image compression.
    const geminiStart = Date.now();
    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        }
      );
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        console.error(
          `[scan-receipt] Gemini call aborted after ${GEMINI_TIMEOUT_MS}ms timeout`
        );
        return NextResponse.json(
          { error: "Proses AI terlalu lama. Silakan coba lagi." },
          { status: 504 }
        );
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    const geminiMs = Date.now() - geminiStart;

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[scan-receipt] Gemini API error after ${geminiMs}ms:`, errText);
      return NextResponse.json(
        // Upstream details stay in the server log only.
        { error: "Gagal memproses struk dengan AI. Coba lagi." },
        { status: response.status }
      );
    }

    const responseData = await response.json();

    // Log upstream timing + token usage so slow scans can be diagnosed:
    // a large geminiMs with small output tokens points at network/cold-start,
    // while high output tokens points at generation cost.
    const usage = responseData.usageMetadata;
    console.log(
      `[scan-receipt] gemini=${geminiMs}ms tokens(prompt/candidates/total)=` +
        `${usage?.promptTokenCount ?? "?"}/${usage?.candidatesTokenCount ?? "?"}/${usage?.totalTokenCount ?? "?"}`
    );

    const textResult = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResult) {
      return NextResponse.json(
        { error: "Failed to extract text from Gemini model result" },
        { status: 500 }
      );
    }

    const parsedResult = JSON.parse(textResult);
    return NextResponse.json(parsedResult);
  } catch (error) {
    console.error("Scan receipt exception:", error);
    const message = error instanceof Error ? error.message : "Failed to scan receipt";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
