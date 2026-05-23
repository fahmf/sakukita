import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { image, mimeType, categories } = await req.json();
    if (!image || !mimeType) {
      return NextResponse.json({ error: "Missing image data" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key is not configured" },
        { status: 500 }
      );
    }

    // Build categories formatted list for context
    const categoriesPromptText = (categories || [])
      .map(
        (c: any) =>
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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API direct error:", errText);
      return NextResponse.json(
        { error: "Gemini AI processing failed", details: errText },
        { status: response.status }
      );
    }

    const responseData = await response.json();
    const textResult = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResult) {
      return NextResponse.json(
        { error: "Failed to extract text from Gemini model result" },
        { status: 500 }
      );
    }

    const parsedResult = JSON.parse(textResult);
    return NextResponse.json(parsedResult);
  } catch (error: any) {
    console.error("Scan receipt exception:", error);
    return NextResponse.json(
      { error: error.message || "Failed to scan receipt" },
      { status: 500 }
    );
  }
}
