# User Journey & Flow — Saku

**Versi:** 1.0
**Tanggal:** 22 Mei 2026
**Pelengkap untuk:** PRD.md & TRD.md

---

## 1. Peta Perjalanan Pengguna (High-Level)

Perjalanan pengguna Saku dibagi menjadi enam fase besar. Tabel di bawah ini meringkas tujuan tiap fase, aksi kunci yang dilakukan user, dan metric yang ingin dijaga di tahap tersebut.

| Fase | Tujuan User | Aksi Kunci | Metric yang Dijaga |
|------|-------------|------------|--------------------|
| 1. Discovery | Memahami apa itu Saku | Buka landing, baca value prop | Bounce rate <60% |
| 2. Onboarding | Mulai mencatat dengan cepat | Sign up, pilih default kategori | Time-to-first-transaction <60s |
| 3. Daily Use | Catat transaksi harian | Quick add via FAB / shortcut | Median input <5s |
| 4. Collaboration | Mengajak pasangan/anggota | Generate invite link / email | ≥30% household punya ≥2 anggota |
| 5. Insight | Memahami arus kas & saldo | Buka dashboard & laporan mingguan | Weekly active dashboard view ≥3x |
| 6. Plan & Adjust | Bikin/ubah budget, rapikan kategori | Edit budget, archive wallet | Budget completion rate >70% |

---

## 2. Persona Mapping ke Fase

**Bu Aisha (Editor utama)** bergerak sangat sering di fase 3 (input transaksi harian). Setiap kali belanja, dia membuka Saku dari shortcut home screen, tekan FAB, isi nominal & kategori, selesai. Sesekali dia membuka fase 5 untuk mengecek sisa budget bulan ini.

**Pak Ridho (Admin & Reviewer)** lebih banyak di fase 5 dan 6. Setiap akhir minggu dia membuka dashboard, melihat tren, dan menyesuaikan budget. Dia juga melakukan transfer antar dompet (tabungan ke investasi, misalnya) dan menambah pemasukan saat gajian.

**Anak/Asisten (Viewer/Editor terbatas)** hanya muncul di fase 3 untuk wallet tertentu, misalnya "Dompet Belanja Dapur".

---

## 3. Flow: Onboarding Pengguna Baru

User baru membuka URL Saku (misalnya `saku.app`). Landing page menampilkan headline ringkas ("Pencatat keuangan keluarga, simpel banget"), dua tombol — *Masuk* dan *Mulai Gratis* — serta tiga screenshot ilustratif. Saat user menekan *Mulai Gratis*, dia diarahkan ke `/login` dengan dua opsi: **Lanjutkan dengan Google** atau **Masuk dengan Email** (magic link). Pemilihan Google memicu OAuth Supabase; pemilihan email menampilkan input email dan mengirim magic link.

Setelah callback OAuth/magic-link berhasil, server side:
1. Membuat row `profiles` (jika belum ada).
2. Membuat household default bernama "Keluarga [DisplayName]" dengan currency IDR.
3. Membuat row `household_members` dengan role `admin`.
4. Menyisipkan kategori default (Makanan, Transport, Belanja, Hiburan, Kesehatan, Tagihan, Gaji, Hadiah, Lain-lain) via `seed.sql` yang dijalankan saat household dibuat.
5. Membuat satu wallet default "Cash" dengan saldo awal 0.

User kemudian dibawa ke layar onboarding tiga langkah:
- **Langkah 1 — Buat dompet pertama.** Form sederhana: nama, tipe (cash/bank/e-wallet), saldo awal. Tombol "Lewati" tersedia.
- **Langkah 2 — Pasang ke home screen.** Banner mendorong install PWA (mendeteksi event `beforeinstallprompt`); jika user iOS, instruksi visual "Tap ⎋ lalu *Add to Home Screen*".
- **Langkah 3 — Coba catat transaksi pertama.** Form transaksi diisi otomatis dengan placeholder (misal Rp 25.000 untuk Makanan); user hanya perlu menekan *Simpan* untuk merasakan flow input. Konfeti pastel kecil muncul saat sukses.

Setelah onboarding, user mendarat di dashboard kosong dengan empty state ramah ("Catatanmu baru dimulai. Tap tombol + untuk menambah transaksi.").

---

## 4. Flow: Mencatat Transaksi (Skenario Inti)

Skenario: Bu Aisha baru pulang belanja sayur seharga Rp 47.500, dibayar pakai cash.

1. **Akses cepat.** Bu Aisha tap icon Saku di home screen HP. PWA terbuka langsung ke dashboard dalam <1 detik (precached shell).
2. **Tap FAB.** Tombol bundar berwarna mint di kanan bawah. Sheet/modal naik dari bawah (`Drawer` shadcn) menampilkan form transaksi.
3. **Default cerdas.** Form sudah ter-set: tipe = *Pengeluaran* (paling sering), wallet = wallet terakhir dipakai (Cash), tanggal = hari ini. Cursor langsung fokus di input nominal.
4. **Input nominal.** Bu Aisha mengetik `47500`. Display merender `Rp 47.500` realtime. Jika dia mengetik `25000+22500`, calculator inline langsung menghitung.
5. **Pilih kategori.** Di bawah nominal ada chip horizontal scrollable berisi 6 kategori paling sering dipakai (machine-learning sederhana berbasis frequency). Tap "Makanan → Dapur" sekali, chip aktif.
6. **Opsional: catatan & foto.** Bu Aisha tap "Tambah catatan" jika perlu (mis. "sayur asem + ikan"). Tombol kamera untuk foto struk.
7. **Simpan.** Tombol "Simpan" besar di bawah. Tap → modal tertutup, toast pastel muncul "Tersimpan ✓ Sisa budget Makanan: Rp 320.000". Total durasi <5 detik.
8. **Sync.** Di balik layar, transaksi ditulis ke Dexie + outbox → sync engine push ke Supabase → realtime channel broadcast → HP Pak Ridho yang sedang buka dashboard refresh angka secara real-time.

**Jalur offline.** Jika WiFi/data mati, langkah 1–7 identik. Di langkah 8, sync engine mendeteksi offline (`navigator.onLine === false` + ping check), simpan ke outbox. Badge kecil di top bar ("📴 1 transaksi belum tersinkron") muncul. Saat koneksi kembali, badge berubah jadi spinner lalu hilang.

---

## 5. Flow: Transfer Antar Dompet

Skenario: Pak Ridho memindahkan Rp 2.000.000 dari BCA ke Tabungan Anak.

1. Buka FAB → pilih tab "Transfer" (atau swipe header).
2. Form transfer: dompet asal (BCA), dompet tujuan (Tabungan Anak), nominal Rp 2.000.000, tanggal, catatan opsional. Checkbox "Ada biaya admin?" — jika dicentang, muncul input biaya yang dipotong dari dompet asal sebagai expense terkategori "Biaya Admin".
3. Tap Simpan. Sistem membuat 1 row `transactions` dengan `type='transfer'`. Saldo BCA langsung turun, Tabungan Anak naik. Tidak ada kategori expense/income, sehingga tidak memengaruhi laporan pengeluaran.

---

## 6. Flow: Membuat & Memantau Budget

**Setup awal.** Pak Ridho buka menu `Budget` di bottom nav. Halaman menampilkan daftar kategori expense dengan tombol "Tetapkan budget" di samping setiap kategori belum ber-budget. Tap → modal: nominal Rp 1.500.000/bulan untuk "Makanan", toggle *Carry-over* (off by default). Simpan.

**Pemantauan.** Di dashboard muncul kartu "Budget Bulan Ini" menampilkan top 3 kategori dengan progress bar berwarna mint (≤80%), butter (80–100%), rose (>100%). Di halaman Budget, semua kategori berbudget muncul dengan progress, sisa rupiah, dan tanggal proyeksi habis ("Sisa Rp 320.000 — diperkirakan habis di tanggal 24").

**Notifikasi.** Saat akumulasi pengeluaran menyentuh 80% di tengah bulan, Edge Function `send-push` mengirim push notif "⚠️ Makanan sudah 80% (Rp 1.200.000 dari Rp 1.500.000)". Tap notif → langsung ke detail kategori dengan list transaksi.

---

## 7. Flow: Mengajak Anggota Keluarga (Invite)

**Sisi Pengirim (Admin).** Pak Ridho buka `Pengaturan → Anggota Keluarga`. Halaman menampilkan list anggota saat ini (Pak Ridho — Admin). Tombol "Undang Anggota" → modal:
- Input email (opsional) atau pilih "Buat link saja".
- Pilih role: Admin / Editor / Viewer (default Editor) dengan tooltip penjelasan tiap role.
- Pilih masa berlaku link: 24 jam / 7 hari (default 7) / 30 hari.

Tap *Buat Undangan*. Backend membuat row `invites` dengan `token` random. Jika email diisi, kirim email transactional (via Supabase + Resend) berisi link `https://saku.app/invite/{token}`. Modal menampilkan link untuk di-copy ke WhatsApp.

**Sisi Penerima.** Bu Aisha tap link di WhatsApp. Browser membuka `/invite/{token}`. Halaman menampilkan:
- Nama household yang mengundang ("Keluarga Pak Ridho mengundangmu").
- Role yang akan diberikan ("sebagai Editor — bisa input & ubah transaksi").
- Tombol "Terima Undangan" yang mengarahkan ke login Google/email.

Setelah login (atau jika sudah login), Edge Function `accept-invite` dijalankan:
1. Validasi token: ada, status `pending`, belum expired.
2. Insert ke `household_members` (household_id dari invite, user_id dari auth, role dari invite).
3. Update `invites.status = 'accepted'`.
4. Set `profiles.active_household_id` ke household baru.
5. Insert ke `activity_logs`.

Bu Aisha langsung dibawa ke dashboard household baru dengan banner sambutan "Selamat datang di Keluarga Pak Ridho 👋".

**Switching household.** Jika Bu Aisha juga punya household sendiri, di top bar ada dropdown household; pemilihan lain set `active_household_id` dan refresh data.

---

## 8. Flow: Membaca Laporan

Skenario: Pak Ridho akhir bulan ingin tahu ke mana uang pergi.

1. Tap tab `Laporan` di bottom nav.
2. Halaman default: bulan berjalan. Header menampilkan total income, total expense, dan selisih (savings).
3. **Cashflow Chart.** Line chart 30 hari menunjukkan akumulasi income vs expense. Tap point untuk tooltip detail.
4. **Per Kategori (Donut).** Donut chart pengeluaran per kategori induk, dengan legend di kanan. Tap slice → drill-down ke sub-kategori.
5. **Top Transaksi.** List 5 transaksi terbesar bulan ini, dengan info siapa yang input ("oleh Bu Aisha, 12 Mei").
6. **Net Worth Trend.** Line chart 12 bulan terakhir saldo total aset - liabilitas.
7. **Filter.** Tombol di top: ganti periode (mingguan, bulanan, custom range, year-to-date), filter per dompet, filter per anggota.
8. **Export.** Tombol "Export CSV" menjalankan Edge Function `export-csv`, kembali dengan signed URL untuk download.

---

## 9. Flow: Edit & Hapus Transaksi

Dari list transaksi, swipe-left pada item membuka aksi: **Edit** dan **Hapus**. Tap Edit membuka form dengan data terisi. Tap Hapus menampilkan confirm dialog "Hapus transaksi ini?". Soft delete (set `is_deleted=true`) untuk MVP belum diimplementasi recycle bin, hapus permanen langsung. (Recycle bin masuk v1.x.)

Activity log mencatat: `actor=Bu Aisha, action=tx.update, entity_id=...`. Pak Ridho dapat melihat di halaman `Aktivitas`.

---

## 10. Flow: Offline & Sync

**Skenario offline:** Bu Aisha di parkiran mall tanpa sinyal.
1. Buka Saku — shell ter-load instan dari cache.
2. Dashboard menampilkan data terakhir disimpan di Dexie.
3. Bu Aisha tambah 3 transaksi belanja. Semuanya tersimpan lokal dengan badge "Belum tersinkron".
4. Top bar menampilkan indikator offline (icon cloud-off pastel).

**Kembali online:** Saat masuk rumah dan terhubung WiFi:
1. Event `online` ter-fire.
2. Sync engine memproses outbox satu per satu (FIFO).
3. Setiap sukses: badge "Belum tersinkron" hilang dari transaksi.
4. Jika ada konflik (sangat jarang dalam keluarga kecil), banner muncul "Bu Aisha — transaksi 'Belanja Indomaret' diubah oleh Pak Ridho. [Lihat detail]".

---

## 11. Flow: Notifikasi Push

User pertama kali harus *opt-in* push. Pemicunya non-intrusif: banner di settings "Aktifkan notifikasi untuk pengingat budget & transaksi". Tap *Aktifkan* → browser prompt → sukses → subscription dikirim ke `push_subscriptions`.

Jenis notif yang dikirim di MVP:
- **Budget warning** (80% & 100%).
- **Transaksi besar** (>Rp 500.000 oleh anggota lain).
- **Anggota baru bergabung** ("Bu Aisha bergabung ke keluarga").

Tap notif membuka URL deep-link (`/transactions/{id}` atau `/budgets/{categoryId}`).

---

## 12. Edge Cases & Error States

**Jaringan lambat.** Skeleton loader pastel muncul untuk semua list. Jika request >5 detik, fallback ke data Dexie + banner "Data mungkin tertinggal".

**Sesi habis.** Middleware mendeteksi JWT expired → redirect ke `/login` dengan param `?next=/dashboard` agar setelah login balik ke halaman semula.

**Token invite expired.** Halaman `/invite/{token}` menampilkan empty state "Undangan ini sudah kedaluwarsa. Minta undangan baru ke pengirim."

**Mencoba edit transaksi sebagai Viewer.** Tombol edit/hapus disembunyikan di UI. Jika ada race (role baru saja diubah), Supabase RLS menolak update, UI menampilkan toast "Kamu tidak punya izin untuk mengubah ini."

**Dompet dihapus padahal masih punya transaksi.** Dialog konfirmasi "Dompet ini punya 42 transaksi. Pilih:
- Pindahkan transaksi ke dompet lain.
- Arsipkan dompet (tetap simpan history).
- Batal."
Hapus permanen baru aktif jika dompet kosong.

**Saldo negatif.** Tidak diblokir (cash bisa minus jika user salah catat). Warning ditampilkan: "Saldo BCA menjadi -Rp 100.000. Yakin?".

---

## 13. Empty States — Penting untuk Aplikasi Baru

Tiap halaman utama harus punya empty state ramah, bukan layar kosong. Contoh:

- **Dashboard kosong:** ilustrasi monokrom kecil + "Belum ada transaksi bulan ini. Tap + untuk mulai mencatat."
- **Laporan kosong:** "Catat 5 transaksi dulu agar laporan bermakna."
- **Budget kosong:** "Belum ada budget. Atur batas pengeluaranmu agar Saku bisa ingatkan."
- **Anggota tunggal:** "Hanya kamu di sini. [Undang pasangan/keluargamu →]"

---

## 14. Wireframe Tekstual — Halaman Utama

**Dashboard (mobile, 393×852)**
```
┌────────────────────────────────┐
│ ⌄ Keluarga Pak Ridho      🔔  │  ← top bar: household switcher + notif
├────────────────────────────────┤
│ Mei 2026                       │
│ Saldo Total                    │
│ Rp 24.350.000                  │  ← angka besar, font bold
│ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔           │
│                                │
│ ┌────────┐  ┌────────┐         │  ← 2 kartu summary
│ │Pemasukan│  │Pengeluaran│      │
│ │+8.5jt   │  │-3.2jt    │      │
│ └────────┘  └────────┘         │
│                                │
│ Budget Bulan Ini               │
│ ━━━━━━━━━━━━━━░░ Makanan 75%   │
│ ━━━━░░░░░░░░░░░░ Transport 28% │
│ [Lihat semua →]                │
│                                │
│ Transaksi Terakhir             │
│ 🥬 Belanja sayur     -47.500   │
│    Cash · 2 menit lalu         │
│ 🚗 Bensin            -50.000   │
│    BCA · 3 jam lalu            │
│ [Lihat semua →]                │
├────────────────────────────────┤
│  🏠     📊     ➕     📈    ⚙️  │  ← bottom nav (FAB di tengah)
└────────────────────────────────┘
```

**Form Tambah Transaksi (drawer dari bawah)**
```
┌────────────────────────────────┐
│  ━━━                           │  ← drag handle
│  [Pengeluaran][Pemasukan][⇄ Transfer] │
│                                │
│  Rp                            │
│  47.500                        │  ← angka besar, mint cursor
│                                │
│  🍽️ Makanan › Dapur            │  ← chip aktif
│  Pilihan cepat:                │
│  [🚗 Transport][🛒 Belanja][...] │
│                                │
│  💳 Cash                       │  ← wallet picker
│  📅 Hari ini, 14:30             │
│  📝 Tambah catatan              │
│  📎 Foto struk                  │
│                                │
│  ┌──────────────────────────┐  │
│  │       Simpan             │  │  ← tombol full-width mint
│  └──────────────────────────┘  │
└────────────────────────────────┘
```

---

## 15. Ringkasan Hal yang Harus Disiapkan untuk Sprint 1

Tim development perlu memastikan: (a) repo Next.js + Bun + shadcn ter-setup dengan design token yang sudah disepakati; (b) Supabase project dibuat di region SG dengan migrations awal (profiles, households, members, wallets, categories, transactions, RLS); (c) auth flow Google + magic link berfungsi end-to-end; (d) shell PWA + manifest + service worker bisa di-install di Android & iOS; (e) FAB & form tambah transaksi sudah berfungsi online (offline & sync masuk sprint berikutnya). Dengan fondasi ini, sprint 2 dapat fokus ke offline-first + realtime sync tanpa harus mengulang setup.
