import type { TransactionType } from "./supabase/types";

type Named = { id: string; name: string };
type Category = Named & { kind: "expense" | "income" };
type CategoryTree = Category & { subcategories: Category[] };

const units: Record<string, number> = {
  nol: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6,
  tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11,
};
const words = [...Object.keys(units), "belas", "puluh", "ratus", "seratus", "setengah",
  "ribu", "seribu", "juta", "sejuta", "miliar", "semiliar", "koma"];
const token = `(?:\\d+(?:[.,]\\d+)*|(?:${words.join("|")})\\b)`;
const amountPattern = new RegExp(
  `\\b(rp\\.?\\s*)?(${token}(?:\\s+${token})*)(?:\\s*(rb|jt|k)\\b)?(?:\\s*(rupiah)\\b)?`, "gi",
);

function belowThousand(text: string): number {
  if (!text) return NaN;
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(text)) return Number(text.replaceAll(".", "").replace(",", "."));
  if (/^\d+(?:[.,]\d+)?$/.test(text)) return Number(text.replace(",", "."));
  if (Object.hasOwn(units, text)) return units[text];
  if (text === "setengah") return 0.5;
  const half = text.match(/^(.*) setengah$/);
  if (half) return belowThousand(half[1]) + 0.5;
  const decimal = text.match(/^(.+) koma (\w+)$/);
  if (decimal && units[decimal[2]] < 10) return belowThousand(decimal[1]) + units[decimal[2]] / 10;
  const hundreds = text.match(/^(?:seratus|(\w+) ratus)(?: (.+))?$/);
  if (hundreds) return (hundreds[1] ? units[hundreds[1]] : 1) * 100 + (hundreds[2] ? belowThousand(hundreds[2]) : 0);
  const tens = text.match(/^(\w+) puluh(?: (\w+))?$/);
  if (tens) return units[tens[1]] * 10 + (tens[2] ? units[tens[2]] : 0);
  const teens = text.match(/^(\w+) belas$/);
  return teens ? 10 + units[teens[1]] : NaN;
}

function spokenNumber(phrase: string): number {
  let rest = phrase.replace(/\bse(ribu|juta|miliar)\b/g, "satu $1");
  let total = 0;
  for (const [scale, value] of [["miliar", 1e9], ["juta", 1e6], ["ribu", 1e3]] as const) {
    const parts = rest.split(new RegExp(`\\b${scale}\\b`));
    if (parts.length === 1) continue;
    if (parts.length !== 2) return NaN;
    total += belowThousand(parts[0].trim()) * value;
    rest = parts[1].trim();
  }
  return total + (rest ? belowThousand(rest) : 0);
}

function readAmount(text: string): number | null {
  const candidates: number[] = [];
  for (const match of text.matchAll(amountPattern)) {
    const [, prefix, phrase, suffix, currency] = match;
    const amount = spokenNumber(phrase) * (suffix === "jt" ? 1e6 : suffix ? 1e3 : 1);
    const money = prefix || suffix || currency || /ribu|juta|miliar/.test(phrase);
    const before = text.slice(0, match.index);
    const after = text.slice(match.index + match[0].length);
    const quantity = /^(?:\s+)(?:gram|gr|kg|ml|liter|buah|pcs|lembar|meter)\b/.test(after);
    const dateOrTime = /\b(?:tanggal|tahun|jam)\s*$/.test(before);
    if (money || (amount >= 100 && !quantity && !dateOrTime)) candidates.push(amount);
  }
  const [amount] = candidates;
  return candidates.length === 1 && Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

const rules: [string, RegExp][] = [
  ["Jajan & Kopi", /\b(kopi|ngopi|jajan|camilan|cemilan|boba|es krim)\b/],
  ["Makan di Luar", /\b(makan (siang|malam|pagi)|sarapan|restoran|warung|bakso|nasi goreng|nasi padang|gofood|grabfood)\b/],
  ["Belanja Dapur", /\b(sayur|sembako|beras|telur|belanja dapur|bahan masak|bumbu)\b/],
  ["Bensin", /\b(bensin|pertalite|pertamax|solar|bbm)\b/],
  ["Ojek, Parkir & Tol", /\b(ojek|ojol|gojek|grab|parkir|tol)\b/],
  ["Listrik & Air", /\b(listrik|pln|pdam)\b/],
  ["Gas & Galon", /\b(gas|elpiji|galon)\b/],
  ["Pulsa & Internet", /\b(pulsa|internet|wifi|paket data)\b/],
  ["Obat & Vitamin", /\b(apotek|obat|vitamin)\b/],
  ["SPP & Biaya Sekolah", /\b(spp|uang sekolah)\b/],
  ["Zakat, Infak & Sedekah", /\b(zakat|infak|infaq|sedekah|donasi)\b/],
  ["Kebutuhan Anak & Bayi", /\b(popok|susu formula|perlengkapan bayi)\b/],
  ["Gaji Bulanan", /\b(gaji|gajian)\b/],
  ["Bonus, THR & Lembur", /\b(bonus|thr|lembur)\b/],
  ["Usaha & Sampingan", /\b(freelance|honor|penjualan)\b/],
  ["Refund", /\b(refund|pengembalian dana)\b/],
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function mentions(sentence: string, name: string) {
  return !!name && ` ${sentence} `.includes(` ${name} `);
}

function namedMatch<T extends Named>(text: string, options: T[]): T | undefined {
  const matches = options.filter(x => mentions(text, normalize(x.name)));
  // If two distinct names match, only accept the more specific, nested name.
  return matches.find(x => matches.every(y => x.id === y.id ||
    (normalize(x.name) !== normalize(y.name) && mentions(normalize(x.name), normalize(y.name)))));
}

function categoryFor(text: string, tree: CategoryTree[], type: TransactionType) {
  const parents = tree.filter(p => p.kind === type);
  const all = parents.flatMap(p => [p, ...p.subcategories]);
  const explicit = text.match(/\bkategori (.+)/);
  if (explicit) return namedMatch(explicit[1], all)?.id;
  const inferred = rules.filter(([, pattern]) => pattern.test(text)).flatMap(([name]) =>
    all.filter(c => c.name === name));
  const direct = namedMatch(text, all);
  if (direct && !parents.some(p => p.id === direct.id)) return direct.id;
  if (inferred.length === 1) return inferred[0].id;
  return direct?.id;
}

export function parseVoiceTransaction(
  transcript: string, categories: CategoryTree[], wallets: Named[], today: string,
  defaultType: TransactionType = "expense",
) {
  // Spoken tags run to the next comma, tag, or transaction-field marker.
  const tags = new Set<string>();
  const body = transcript.toLowerCase().replace(
    /(?:#|\btag\s+)([\p{L}\p{N}][\p{L}\p{N} -]*?)(?=\s+(?:tag|pakai|dari|ke dompet|kemarin|besok|hari ini|kategori)\b|[^\p{L}\p{N} -]|$)/gu,
    (_, value: string) => { tags.add(value.trim().replace(/\s+/g, " ")); return " "; },
  );
  const text = normalize(body);
  for (const keyword of ["kantor", "keluarga", "anak", "liburan", "rapat", "sekolah", "bulanan",
    "kopi", "parkir", "bensin", "indomaret", "alfamart", "shopee", "tokopedia"]) {
    if (mentions(text, keyword)) tags.add(keyword);
  }
  const direction = text.match(/\bke\s+(.+?)(?:\bdari\b|$)/);
  const destination = direction ? namedMatch(direction[1], wallets) : undefined;
  const isTransfer = /\b(transfer|pindah saldo|pindahkan saldo)\b/.test(text);
  const isExpense = /\b(beli|belanja|bayar|pengeluaran|keluar)\b/.test(text);
  const isIncome = /\b(pemasukan|terima|menerima|masuk|gaji|gajian|bonus|thr|refund|honor|penjualan)\b/.test(text);
  let type = defaultType;
  if (isExpense) type = "expense";
  else if (isIncome) type = "income";
  else if (isTransfer) type = "transfer";
  const from = text.match(/\bdari\s+(.+?)(?:\bke\b|$)/);
  const sourceText = type === "transfer" ? from?.[1] ?? text.split(/\bke\b/)[0] : text;
  const wallet = namedMatch(sourceText, wallets);
  const date = new Date(today + "T00:00:00Z");
  if (mentions(text, "kemarin")) date.setUTCDate(date.getUTCDate() - 1);
  else if (mentions(text, "besok")) date.setUTCDate(date.getUTCDate() + 1);
  return {
    type, amount: readAmount(body), date: date.toISOString().slice(0, 10),
    needsWallet: type === "transfer" || /\b(pakai|dompet|lewat|rekening)\b/.test(text),
    walletId: wallet?.id, toWalletId: type === "transfer" ? destination?.id : undefined,
    categoryId: categoryFor(text, categories, type), tags: Array.from(tags),
    note: transcript.trim(),
  };
}
