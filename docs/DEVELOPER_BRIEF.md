# Developer Brief — Saku Kita

**Klien:** Fahmi (bridjadid@gmail.com)
**Project:** Aplikasi pencatat keuangan keluarga (PWA mobile-first)
**Tipe:** Personal project, gratis selamanya, untuk pemakaian internal keluarga (2 user aktif)
**Dokumen referensi:** `PRD.md`, `TRD.md`, `USER_JOURNEY.md` (di folder yang sama)

---

## 1. Tujuan Singkat

Membangun PWA pencatat keuangan keluarga dengan pengalaman input transaksi super cepat (<5 detik), kolaborasi 2 device real-time, dukungan offline, dan tampilan minimalis monokrom + aksen mint pastel.

## 2. Tech Stack (Wajib)

| Layer | Pilihan | Catatan |
|-------|---------|---------|
| Frontend | Next.js 15 (App Router) + TypeScript strict | RSC + Client mix |
| Runtime / Pkg | **Bun** | `bun install`, `bun dev`, `bun run build` |
| UI | shadcn/ui + Tailwind v4 + Radix | Token via `@theme` di `globals.css` |
| Icons | lucide-react | Satu set, konsisten |
| Backend | Supabase (region **ap-southeast-1 Singapore**) | Free tier |
| Auth | Supabase Auth — Email magic link + Google OAuth | Built-in email cukup |
| DB | PostgreSQL via Supabase + Row Level Security | Skema lengkap di TRD §4 |
| Realtime | Supabase Realtime | Channel per household |
| Offline | Dexie.js (IndexedDB) + outbox pattern | Sync engine custom |
| PWA | Serwist atau next-pwa | Service worker + manifest |
| State | Zustand + TanStack Query | Lihat TRD §3 |
| Chart | Recharts | Donut, line, bar |
| Hosting | Vercel Hobby (gratis) | Auto-deploy dari `main` |
| Repo | GitHub private (`saku-kita`) | |

## 3. Lingkup MVP (5 Pilar)

1. **Auth & onboarding** — Google OAuth + email magic link, auto-create household + kategori default.
2. **Transaksi multi-wallet** — income/expense/transfer, kalkulator inline, kategori 2-level, scheduled tx, recycle bin 30 hari.
3. **Budget bulanan** — per kategori, progress bar, alert 80% & 100%, carry-over opsional.
4. **Dashboard + Laporan visual** — saldo total, cashflow, donut per kategori, net worth trend 12 bulan, export CSV.
5. **Kolaborasi household** — invite via email/link, role admin/editor/viewer, realtime sync ke device kedua <2 detik.

Tambahan: **PWA offline-first** + push notification (budget warning & transaksi besar) + quick-add FAB.

**Tidak masuk MVP:** investasi, multi-currency, OCR struk, import CSV bank, recurring auto, syariah, debt tracker. Semua ada di roadmap di PRD §8.

## 4. Estimasi Effort (Developer Mid-Senior)

| Sprint | Durasi | Output |
|--------|--------|--------|
| Sprint 0 — Setup | 1 minggu | Repo, Supabase, design token, auth flow |
| Sprint 1–2 — Core | 3 minggu | Wallet, kategori, transaksi, dashboard, PWA shell + offline |
| Sprint 3 — Budget & Report | 2 minggu | Budgeting, chart cashflow/donut, net worth |
| Sprint 4 — Collab | 2 minggu | Invite link, role, realtime sync, push notif |
| Sprint 5 — Polish & Launch | 1 minggu | Export CSV, recycle bin, QA, beta soft launch |
| **Total** | **9 minggu** | **MVP siap pakai** |

Jika developer full-time: ±2 bulan. Jika part-time (10 jam/minggu): ±4 bulan.

## 5. Indikasi Biaya (Rupiah, perkiraan pasar Indonesia 2026)

**Biaya developer (sekali bayar):**
- Mid-level full-stack Next.js freelance: Rp 40.000.000 – Rp 70.000.000 untuk MVP utuh.
- Senior independent: Rp 70.000.000 – Rp 120.000.000.
- Mahasiswa/junior dengan supervisi: Rp 15.000.000 – Rp 30.000.000 (risiko quality lebih tinggi, durasi lebih lama).

**Biaya operasional bulanan (setelah live):**
- Supabase Free + Vercel Hobby = **Rp 0**.
- Jika user >500 atau storage besar, naik ke Supabase Pro ≈ Rp 400.000/bulan.
- Domain custom (opsional): Rp 150.000–300.000/tahun.

**Untuk kasusmu (2 user keluarga):** biaya operasional **Rp 0/bulan** selamanya cukup di tier gratis.

## 6. Deliverables yang Harus Diserahkan Developer

1. **Source code** di GitHub private repo `saku-kita`, dengan akses owner kamu.
2. **Supabase project** terkonfigurasi di region SG dengan kredensial (Supabase URL, anon key, service key) diserahkan ke kamu.
3. **Vercel project** terhubung ke GitHub, deploy otomatis berjalan.
4. **VAPID keys** untuk push notification, disimpan di env vars Vercel & Supabase.
5. **Dokumentasi README.md** berisi: cara menjalankan lokal, env vars, command deploy.
6. **Migration SQL** lengkap di `supabase/migrations/` agar bisa di-reset/replay.
7. **Akun admin testing** yang bisa kamu pakai login langsung.
8. **Video walkthrough** singkat (5–10 menit) menjelaskan struktur kode, di-upload ke Loom/YouTube unlisted.

## 7. Acceptance Criteria (Cek Sebelum Bayar Penuh)

- [ ] Login Google & email magic link berfungsi.
- [ ] Bisa install ke home screen Android & iOS (PWA).
- [ ] Tambah transaksi <5 detik dari buka app.
- [ ] Mode offline: tambah 5 transaksi, matikan internet, sambungkan lagi, semuanya tersinkron.
- [ ] Invite anggota kedua via email berfungsi, role editor jalan.
- [ ] Transaksi dari HP A muncul di HP B dalam <3 detik (realtime).
- [ ] Lighthouse PWA score ≥ 90.
- [ ] Tidak ada error console di happy path.
- [ ] RLS bekerja: user A tidak bisa lihat data household B (tes manual via Supabase dashboard).
- [ ] Recycle bin: transaksi terhapus muncul di recycle bin, hard-delete otomatis setelah 30 hari.
- [ ] Export CSV menghasilkan file valid yang bisa dibuka di Excel.

## 8. Yang Harus Kamu Siapkan Sebelum Mulai

1. **Akun Google** untuk daftar Supabase, Vercel, GitHub (kamu sudah punya: bridjadid@gmail.com).
2. **GitHub account** (gratis) — buat di github.com lalu kasih akses ke developer.
3. **Domain custom** (opsional, nanti) — beli di Niagahoster/Rumahweb (~Rp 150K/tahun).
4. **Brief visual** — sudah lengkap di TRD §8 (monokrom + mint accent #B8E6D3).
5. **Test devices** — minimal 2 HP (kamu + pasangan) untuk uji kolaborasi.

## 9. Di Mana Mencari Developer

- **Sribu, Projects.co.id, Fastwork.id** — marketplace Indonesia, banyak pilihan harga.
- **Discord komunitas Next.js Indonesia, Codepolitan, Hacktiv8 alumni group** — developer aktif & terlatih.
- **Upwork / Toptal** — jika oke dengan developer luar Indonesia (biasanya lebih mahal).
- **LinkedIn search:** "Next.js + Supabase + Indonesia".

**Tips memilih:** minta portfolio yang sudah pakai Next.js App Router (versi 13+), Supabase, dan minimal 1 project PWA. Hindari developer yang masih pakai Next.js Page Router atau belum familiar dengan Tailwind v4.

## 10. Cara Pakai Dokumen Ini

Kirim ke developer paket berisi 4 file: `PRD.md`, `TRD.md`, `USER_JOURNEY.md`, `DEVELOPER_BRIEF.md`. Dengan paket ini, developer berpengalaman bisa langsung estimasi waktu & biaya tanpa banyak tanya. Jika ada pertanyaan teknis dari developer, kamu bisa balik lagi ke sini dan aku bantu jawab.

---

**Catatan akhir:** Dokumen ini ditulis dengan asumsi MVP minimal viable. Setelah developer accept project, mereka mungkin akan mengusulkan trade-off (misal: tunda offline mode ke v1.1 agar MVP lebih cepat selesai). Diskusikan bersama, prioritaskan yang paling memberi nilai untukmu & keluarga.
