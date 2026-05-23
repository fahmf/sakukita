# PRD — Aplikasi Pencatat Keuangan Keluarga: **Saku Kita Kita**

**Versi:** 1.1
**Tanggal:** 22 Mei 2026
**Owner:** Fahmi
**Status:** Approved Scope
**Lingkup pengguna:** Pribadi (keluarga Fahmi, 2 anggota aktif), gratis selamanya, tidak ada monetisasi

---

## 1. Ringkasan Eksekutif

**Saku Kita** adalah Progressive Web App (PWA) pencatat keuangan keluarga yang dirancang mobile-first dengan estetika monokrom minimalis dan satu aksen pastel. Fokus utamanya adalah kecepatan input transaksi (<5 detik), kemudahan berbagi dompet antar anggota keluarga via invite link/email, serta laporan visual yang ringkas untuk memahami arus kas dan kekayaan bersih (net worth).

Berbeda dengan aplikasi sejenis yang penuh menu, Saku Kita menonjolkan tiga aktivitas inti: **mencatat**, **memahami**, **merencanakan**. Semuanya dapat dilakukan online maupun offline berkat arsitektur offline-first dengan sinkronisasi otomatis ke Supabase.

## 2. Latar Belakang & Masalah

Keluarga modern di Indonesia umumnya memiliki beberapa sumber dana (rekening pribadi, rekening bersama, e-wallet, cash) dan beberapa pelaku transaksi (suami, istri, kadang anak/asisten). Aplikasi yang ada saat ini punya tiga kelemahan utama yang sering dikeluhkan: pertama, sebagian besar berfokus pada satu user sehingga sulit melihat gambaran keuangan rumah tangga secara utuh. Kedua, alur input transaksi banyak menuntut klik berlapis sehingga pencatatan harian terasa beban. Ketiga, banyak yang penuh iklan, atau menempatkan fitur dasar di balik paywall.

Saku Kita hadir untuk mengisi celah tersebut dengan pendekatan yang sederhana namun lengkap: satu dompet bersama yang bisa diakses dua perangkat secara real-time, input super cepat dengan FAB & gesture, dan laporan visual yang langsung menjawab pertanyaan "ke mana uangku pergi bulan ini?".

## 3. Tujuan & Success Metrics

Tujuan utama produk adalah membuat pencatatan keuangan harian terasa ringan dan kolaboratif. Indikator keberhasilan diukur dari empat hal: (a) **time-to-first-transaction** di bawah 60 detik setelah signup; (b) **median input transaksi** di bawah 5 detik dari buka app hingga submit; (c) **D7 retention** minimal 40% pada cohort awal; (d) **kolaborasi aktif**, yaitu minimal 30% household memiliki ≥2 anggota aktif dalam 14 hari pertama.

Untuk MVP, target teknis adalah Lighthouse PWA score ≥90, Time-to-Interactive <2.5 detik di 4G, dan offline-success-rate >99% (transaksi yang dibuat offline berhasil tersinkron tanpa konflik).

## 4. Target Pengguna & Persona

**Persona Primer — Bu Aisha (32, ibu rumah tangga & freelancer)**. Memegang sebagian besar pengeluaran rumah tangga (belanja dapur, sekolah anak, listrik). Ingin tahu apakah pengeluaran masih sesuai budget bulanan dan ingin suaminya bisa lihat real-time tanpa harus tanya. Pengguna HP dominan; jarang buka laptop.

**Persona Sekunder — Pak Ridho (35, karyawan swasta)**. Pemilik penghasilan utama, ingin melihat ringkasan bulanan dan tren net worth (tabungan + aset - utang). Lebih sering buka app di akhir pekan atau saat tanggal gajian untuk transfer dan alokasi. Suka chart sederhana.

**Persona Tersier — Anak/Asisten (opsional)**. Dapat di-invite sebagai "viewer" atau "contributor" terbatas pada dompet tertentu (mis. dompet belanja dapur), tanpa akses ke laporan keseluruhan.

## 5. Lingkup MVP (v1.0)

MVP dibatasi pada lima pilar yang menjawab kebutuhan dasar keluarga: pencatatan transaksi, multi-wallet dengan kategori, budgeting bulanan, laporan visual termasuk net worth, dan kolaborasi via invite. Fitur lanjutan seperti investasi, multi-currency, OCR struk, syariah, dan import bank statement masuk ke roadmap pasca-MVP.

### 5.1 Fitur Inti MVP

**Manajemen Transaksi.** User dapat mencatat tiga jenis transaksi: pemasukan (income), pengeluaran (expense), dan transfer antar dompet. Setiap transaksi memiliki field wajib (nominal, tanggal, dompet, kategori) dan field opsional (catatan, tag, foto struk, lokasi). Input nominal mendukung kalkulator inline (mis. mengetik `25000+8500` langsung dihitung). Quick-add FAB tersedia di setiap halaman dengan shortcut gesture swipe-up.

**Multi-Wallet & Kategori.** Setiap household dapat membuat beberapa dompet (Cash, BCA, BRI, GoPay, OVO, Dana, Kartu Kredit, dst.) masing-masing dengan saldo awal dan icon. Kategori dibagi dua tingkat: parent (mis. Makanan) dan sub-kategori (Dapur, Restoran, Jajan). Kategori bawaan tersedia agar onboarding cepat, tapi sepenuhnya dapat dimodifikasi. Tiap kategori punya icon Lucide dan warna pastel pilihan.

**Budgeting Bulanan.** User dapat mengatur batas pengeluaran per kategori per bulan. Progress bar real-time menunjukkan sisa budget, dan notifikasi muncul saat menyentuh 80% dan 100%. Budget bersifat rolling: setiap bulan otomatis reset, tapi user bisa mengaktifkan opsi "carry-over" untuk surplus/defisit.

**Sharing & Kolaborasi.** Setiap user otomatis memiliki satu household saat signup. Owner dapat mengundang anggota via email atau salinan link (kadaluwarsa 7 hari). Anggota baru memilih role: **Admin** (akses penuh, kelola anggota), **Editor** (input/edit/hapus transaksi), atau **Viewer** (read-only laporan). Sinkronisasi real-time menggunakan Supabase Realtime, sehingga transaksi yang dibuat di HP istri langsung muncul di HP suami dalam <2 detik.

**Laporan & Net Worth.** Dashboard utama menampilkan saldo total semua dompet, pengeluaran bulan ini vs bulan lalu, dan top-3 kategori boros. Halaman Laporan menyediakan grafik cashflow (line chart 30 hari), donut chart per kategori, dan tren net worth (line chart 6/12 bulan). Net worth dihitung otomatis dari saldo dompet aset dikurangi dompet liabilitas (kartu kredit, utang).

**PWA Offline-First.** Aplikasi dapat di-install ke home screen (iOS & Android). Saat offline, transaksi tetap dapat dibuat dan disimpan di IndexedDB; saat koneksi pulih, sinkronisasi otomatis berjalan dengan konflik dipecahkan via *last-write-wins* berbasis timestamp + user_id. Push notification (via Web Push API) dipakai untuk reminder budget tercapai dan recurring transaction jatuh tempo.

### 5.2 Eksplisit Bukan untuk MVP

Untuk menjaga ruang lingkup, hal-hal berikut **tidak** masuk MVP: investasi & portfolio tracking, multi-currency dengan exchange rate, OCR foto struk, import CSV bank statement, kalkulator zakat & fitur syariah, hutang/piutang antar individu (debt tracking), split bill, recurring transaction otomatis (manual dulu), serta export PDF beraneka template. Semua ada di roadmap.

## 6. Daftar Fitur Lengkap (Master List)

Berikut adalah katalog fitur yang lazim ditemukan di aplikasi keuangan modern. Tanda **[MVP]** menandakan masuk v1.0; **[v1.x]** = patch berikutnya; **[v2]** = post-launch.

**Pencatatan.** Input transaksi tiga tipe [MVP], kalkulator inline [MVP], multi-wallet [MVP], kategori dua tingkat dengan icon & warna [MVP], catatan & tag [MVP], **transaksi tanggal mendatang / scheduled [MVP]** (mis. jadwal bayar SPP), lokasi geotag [v1.x], transaksi recurring otomatis [v1.x], split transaction (satu transaksi terbagi ke beberapa kategori) [v1.x], **foto struk + OCR AI otomatis (ekstrak nominal, merchant, tanggal via Claude Vision / Gemini Flash) [v2]**, import CSV bank [v2], voice input [v2].

**Akun & Dompet.** Wallet tipe (cash, debit, kredit, e-wallet, tabungan, deposito, piutang, utang) [MVP], saldo awal & reconcile [MVP], arsip dompet [MVP], transfer antar dompet dengan biaya admin opsional [MVP], multi-currency [v2].

**Budgeting.** Budget per kategori bulanan [MVP], progress bar & alert [MVP], carry-over [MVP], budget tahunan [v1.x], envelope method (zero-based budgeting ala YNAB) [v2], budget per dompet [v1.x].

**Goals.** Savings goal dengan target nominal & tanggal [v1.x], auto-allocate dari income [v1.x], visualisasi progress [v1.x].

**Hutang & Piutang.** Tracking utang/piutang dengan due date [v1.x], reminder push [v1.x], partial payment [v1.x], chart aging [v2].

**Laporan.** Dashboard summary [MVP], cashflow chart [MVP], pie/donut per kategori [MVP], net worth trend [MVP], comparison bulan ke bulan [MVP], filter periode custom [MVP], filter per dompet/kategori/tag [MVP], export CSV [MVP], export PDF rapi [v1.x], laporan tahunan otomatis [v1.x], kalender heatmap pengeluaran [v1.x].

**Kolaborasi.** Household workspace [MVP], invite via email & link [MVP], role admin/editor/viewer [MVP], realtime sync [MVP], activity log per anggota [MVP], leave household [MVP], transfer ownership [v1.x], mention anggota di catatan [v1.x].

**Keamanan.** Email + Google OAuth via Supabase Auth [MVP], session management & logout semua device [MVP], Row Level Security per household [MVP], PIN/biometric lock di device [v1.x], 2FA TOTP [v2], export data & hapus akun (GDPR) [MVP].

**Notifikasi.** Web Push: budget warning, transaksi besar (>threshold), reminder bayar tagihan recurring [MVP], digest mingguan via email [v1.x], in-app notification center [MVP].

**Personalisasi.** Dark mode otomatis [MVP], pilihan kategori default saat onboarding [MVP], custom kategori & icon [MVP], shortcut quick-add (1 tap dari home screen) [MVP], pinned wallet [MVP], bahasa (ID only di MVP) [MVP].

**Data Management.** Backup ke Supabase otomatis [MVP], restore ke device baru via login [MVP], export CSV per periode [MVP], **soft-delete transaksi (recycle bin 30 hari) [MVP]**, hapus permanen manual dari recycle bin [MVP].

**Engagement.** Streak harian pencatatan [v1.x], achievement badges [v2], tips keuangan harian [v2], integrasi widget HP (iOS/Android home screen) [v2].

## 7. Persyaratan Non-Fungsional

**Performa.** First Contentful Paint <1.5s di 4G; Time-to-Interactive <2.5s; bundle initial route <200KB gzipped. Lazy-load semua chart library. Cache aset statis selama 1 tahun via service worker.

**Aksesibilitas.** Kontras minimal WCAG AA (4.5:1 untuk teks normal); semua interaksi keyboard-navigable; touch target ≥44px; mendukung screen reader (semua icon punya aria-label).

**Privasi & Keamanan.** Tidak ada data finansial yang di-share ke pihak ketiga. Semua komunikasi TLS 1.3. Data sensitif (saldo, transaksi) hanya bisa diakses oleh anggota household terkait via Row Level Security Supabase. Foto struk diunggah ke Supabase Storage dengan signed URL berumur pendek.

**Skalabilitas Awal.** Mendukung hingga 10.000 household aktif dengan rata-rata 5.000 transaksi/household tanpa perlu sharding (dijamin oleh PostgreSQL + index yang tepat).

**Reliabilitas.** Target uptime 99.5% (dibatasi oleh tier Supabase free/pro). Offline mode mengurangi ketergantungan uptime: pencatatan tetap bisa dilakukan saat backend down.

**Compliance.** Tidak menyimpan kredensial bank, tidak menjadi PJP/PJK; jadi tidak masuk regulasi OJK/BI. Kebijakan privasi sederhana sesuai UU PDP.

## 8. Roadmap Indikatif

**Sprint 0 (1 minggu).** Setup Next.js + Bun + shadcn/ui + Supabase, design token monokrom-pastel, skema DB awal, auth flow.

**Sprint 1–2 (3 minggu).** MVP core: wallet, transaksi, kategori, dashboard, PWA shell + offline.

**Sprint 3 (2 minggu).** Budgeting, laporan visual, net worth.

**Sprint 4 (2 minggu).** Kolaborasi: invite link, role, realtime sync.

**Sprint 5 (1 minggu).** Polish: push notif, export CSV, soft-launch ke 10 keluarga beta.

**Post-MVP (v1.1–v1.5).** Recurring transactions, debt tracker, savings goals, kalender heatmap, export PDF, PIN lock, email digest.

**v2.0.** Multi-currency, investasi, OCR struk, import CSV bank, fitur syariah.

## 9. Risiko & Mitigasi

Risiko utama adalah **konflik sinkronisasi** saat dua anggota household edit transaksi yang sama secara offline. Mitigasi: gunakan UUID client-generated, last-write-wins berbasis updated_at, dan tampilkan banner "transaksi ini diubah oleh [nama]" jika terjadi overwrite. Risiko kedua adalah **adopsi rendah karena habit**; mitigasi dengan onboarding yang menampilkan template transaksi dummy & FAB super menonjol agar barrier-to-entry minimal. Risiko ketiga adalah **kebocoran data**; mitigasi dengan RLS ketat, audit query, dan tidak menyimpan PII lebih dari yang diperlukan.

## 10. Keputusan Final & Konfigurasi

Berikut keputusan yang sudah dikunci untuk MVP: **brand** = Saku Kita; **region Supabase** = Singapore (ap-southeast-1) untuk latency Indonesia terbaik; **maks anggota per household** = 5 (cukup untuk keluarga inti + 1 asisten/anak); **future-dated transactions** = didukung (transaksi terjadwal manual untuk MVP, recurring otomatis di v1.x); **recycle bin** = aktif sejak MVP (soft-delete 30 hari, lalu hard-delete via cron Edge Function); **foto struk + OCR AI** = ditunda ke v2 dengan pendekatan AI vision; **email transactional** = pakai built-in Supabase Auth email (gratis, cukup untuk 2 pengguna); **repository** = GitHub private repo (gratis, milik Fahmi); **monetisasi** = tidak ada — gratis selamanya untuk penggunaan pribadi keluarga.
