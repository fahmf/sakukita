import assert from "node:assert/strict";
import test from "node:test";
import { parseVoiceTransaction } from "../src/lib/voice-transaction.ts";

const category = (name, kind = "expense", children = []) => ({
  id: name, name, kind, subcategories: children.map(child => ({ id: child, name: child, kind })),
});
const categories = [
  category("Makanan", "expense", ["Jajan & Kopi", "Belanja Dapur"]),
  category("Gaji", "income", ["Gaji Bulanan"]),
  category("Proyek A"),
];
const wallets = ["Tunai", "BCA", "BCA Bisnis"].map(name => ({ id: name, name }));
const parse = text => parseVoiceTransaction(text, categories, wallets, "2026-01-01");

test("kopi untuk rapat memakai kategori rumah tangga dan tanggal WIB", () => {
  const draft = parse("Kemarin beli dua kopi dua puluh lima ribu pakai Tunai untuk rapat kantor");
  assert.equal(draft.type, "expense");
  assert.equal(draft.amount, 25000);
  assert.equal(draft.categoryId, "Jajan & Kopi");
  assert.equal(draft.walletId, "Tunai");
  assert.equal(draft.date, "2025-12-31");
  assert.deepEqual(new Set(draft.tags), new Set(["kopi", "rapat", "kantor"]));
});

test("nominal lisan, angka dengan satuan, dan format rupiah", () => {
  for (const [amount, phrases] of [
    [25000, ["Rp25.000", "25rb", "25 k", "dua puluh lima ribu rupiah"]],
    [12000, ["dua belas ribu", "Rp12.000,00"]],
    [1250000, ["1,25 juta", "satu juta dua ratus lima puluh ribu"]],
    [2500000, ["dua setengah juta", "2.5jt", "dua koma lima juta"]],
    [101500, ["seratus satu ribu lima ratus"]],
  ]) for (const phrase of phrases) assert.equal(parse(phrase).amount, amount, phrase);
  assert.equal(parse("beras 500 gram 15 ribu").amount, 15000);
});

test("nominal ambigu atau tidak terbaca perlu diperiksa", () => {
  for (const phrase of ["kopi 2 gelas", "kopi 10 ribu dan roti 5 ribu", "Rp0",
    "kopi 25.000 dan roti 10 ribu", "99999999999999999 rupiah"]) {
    assert.equal(parse(phrase).amount, null, phrase);
  }
});

test("pemasukan, dompet paling spesifik dan transfer dua arah", () => {
  const salary = parse("Terima transfer gaji lima juta ke BCA Bisnis");
  assert.equal(salary.type, "income");
  assert.equal(salary.categoryId, "Gaji Bulanan");
  assert.equal(salary.walletId, "BCA Bisnis");
  for (const route of ["dari Tunai ke BCA", "ke BCA dari Tunai"]) {
    const transfer = parse("Besok transfer 50 ribu " + route);
    assert.equal(transfer.type, "transfer");
    assert.equal(transfer.walletId, "Tunai");
    assert.equal(transfer.toWalletId, "BCA");
    assert.equal(transfer.categoryId, undefined);
    assert.equal(transfer.date, "2026-01-02");
  }
});

test("kategori buatan sendiri, tag ucapan, dan pilihan yang belum dikenal", () => {
  const custom = parse("Bayar 100 ribu kategori Proyek A tag renovasi #renovasi pakai OVO");
  assert.equal(custom.categoryId, "Proyek A");
  assert.deepEqual(custom.tags, ["renovasi"]);
  assert.equal(custom.walletId, undefined);
  assert.equal(custom.needsWallet, true);
  assert.equal(parse("Bayar 100 ribu").categoryId, undefined);
  assert.equal(parse("Bayar satu juta kategori Gaji").categoryId, undefined);
});
