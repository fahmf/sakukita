# TRD — Aplikasi Saku Kita (Pencatat Keuangan Keluarga)

**Versi:** 1.1
**Tanggal:** 22 Mei 2026
**Stack:** Next.js 15 (App Router) · Bun · TypeScript · shadcn/ui · Tailwind v4 · Lucide · Supabase (region SG) · Dexie (IndexedDB) · PWA
**Deployment:** Vercel Hobby (gratis) · GitHub private repo · Supabase Free tier (cukup hingga 500MB DB & 1GB Storage)

---

## 1. Arsitektur Tingkat Tinggi

Saku adalah aplikasi *single-page-ish* berbasis Next.js App Router yang berjalan sebagai Progressive Web App. Frontend mengandalkan React Server Components untuk halaman publik (landing, login) dan Client Components untuk halaman dalam aplikasi yang sangat interaktif. Seluruh data dan auth ditangani Supabase: PostgreSQL untuk penyimpanan, Auth untuk identitas, Realtime untuk sinkronisasi push, dan Storage untuk foto struk.

Strategi offline-first diimplementasikan melalui dua lapis: **Dexie.js** di IndexedDB sebagai cache lokal & queue untuk transaksi yang dibuat saat offline, dan **Service Worker** (via `next-pwa` atau Serwist) untuk caching shell aplikasi & aset statis. Saat online, sebuah sync engine menjalankan dua proses paralel: mendorong perubahan lokal yang belum tersinkron ke Supabase, dan menarik perubahan dari Supabase Realtime channel untuk household terkait.

Berikut alur datanya secara ringkas:

```
[User Action di UI]
        ↓
  [Zustand Store] ←──── [Dexie IndexedDB] ←──── [Service Worker Cache]
        ↓                       ↑
  [Sync Engine] ────────────────┘
        ↓ (online)
  [Supabase Client (TS)]
        ↓
  [Supabase Edge: Auth · Postgres · Realtime · Storage]
        ↓
  [PostgreSQL dengan RLS per household]
```

## 2. Tech Stack & Rasional

**Next.js 15 (App Router).** Dipilih karena ekosistem React Server Components matang, routing intuitif, dan deployment ke Vercel/self-hosted Bun mulus. App Router memungkinkan streaming dan partial pre-rendering yang membantu first paint cepat.

**Bun.** Runtime & package manager. Lebih cepat install (`bun install`) dan dev server (`bun dev`) dibanding npm/pnpm. Build production tetap menggunakan Next.js build pipeline; Bun hanya sebagai package manager + runtime saat dibutuhkan.

**TypeScript strict mode.** Wajib untuk semua kode. Tipe database digenerasi otomatis via `supabase gen types typescript`.

**shadcn/ui + Tailwind v4 + Radix.** Komponen di-copy ke `src/components/ui`, sehingga sepenuhnya bisa di-custom sesuai design token monokrom-pastel. Tailwind v4 menggunakan CSS-first config (`@theme` di `globals.css`).

**Lucide React.** Icon set tunggal untuk konsistensi visual.

**Supabase.** PostgreSQL managed + Auth + Realtime + Storage dalam satu paket. Free tier cukup untuk soft launch; pro tier saat traffic naik.

**Dexie.js.** Wrapper IndexedDB yang ergonomis untuk offline storage & sync queue.

**Zustand.** State management ringan (≈1KB) untuk UI state global (active wallet, filter periode, dsb.).

**TanStack Query.** Server-state cache untuk hasil query Supabase; mengurangi refetch dan menyederhanakan optimistic update.

**Recharts.** Library chart yang ringan dan customizable; cocok untuk donut, line, bar yang dibutuhkan MVP.

**Serwist (atau next-pwa).** Generator service worker untuk Next.js App Router; mendukung Workbox runtime caching dan precache manifest.

**Vercel.** Hosting default; bisa pindah ke self-host Bun + Docker tanpa banyak perubahan.

## 3. Struktur Direktori

```
saku/
├── bun.lockb
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts          # opsional; sebagian besar config di globals.css (v4)
├── components.json             # shadcn config
├── public/
│   ├── icons/                  # PWA icons 192, 512, maskable
│   ├── manifest.webmanifest
│   └── sw.js                   # digenerate Serwist
├── supabase/
│   ├── migrations/             # SQL migrations
│   ├── seed.sql                # kategori default
│   └── config.toml
└── src/
    ├── app/
    │   ├── (marketing)/        # landing, pricing (opsional)
    │   ├── (auth)/
    │   │   ├── login/page.tsx
    │   │   └── callback/route.ts
    │   ├── (app)/
    │   │   ├── layout.tsx       # shell PWA: bottom nav + FAB
    │   │   ├── page.tsx         # dashboard
    │   │   ├── transactions/
    │   │   ├── wallets/
    │   │   ├── budgets/
    │   │   ├── reports/
    │   │   ├── household/       # invite & members
    │   │   └── settings/
    │   ├── api/                 # route handlers tipis (mis. webhook)
    │   └── globals.css
    ├── components/
    │   ├── ui/                  # shadcn primitives (button, card, dialog, dst.)
    │   ├── shell/               # BottomNav, Fab, TopBar
    │   ├── transaction/         # TransactionForm, TransactionItem, QuickAdd
    │   ├── wallet/
    │   ├── budget/
    │   ├── chart/               # DonutByCategory, CashflowLine, NetWorthLine
    │   └── shared/              # EmptyState, AmountInput, CalculatorInput
    ├── lib/
    │   ├── supabase/
    │   │   ├── client.ts        # browser client
    │   │   ├── server.ts        # server client (cookies)
    │   │   └── types.ts         # generated DB types
    │   ├── db/
    │   │   ├── dexie.ts         # local DB schema
    │   │   └── sync.ts          # sync engine
    │   ├── auth/                # helpers
    │   ├── utils/               # formatCurrency, formatDate, dst.
    │   └── push/                # web push helpers
    ├── hooks/
    │   ├── use-transactions.ts
    │   ├── use-wallets.ts
    │   ├── use-budgets.ts
    │   ├── use-household.ts
    │   └── use-online.ts
    ├── stores/
    │   ├── ui-store.ts          # zustand
    │   └── filter-store.ts
    └── types/
        └── domain.ts            # tipe domain (Transaction, Wallet, dst.)
```

## 4. Skema Database (PostgreSQL via Supabase)

Skema dirancang dengan household sebagai *tenant boundary*. Setiap tabel domain memiliki kolom `household_id` yang dipakai Row Level Security. Semua primary key UUID v7 (sortable) agar offline-created records tidak konflik.

### 4.1 Tabel Inti

```sql
-- =========================================
-- 1. PROFILES (extends auth.users)
-- =========================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  avatar_url text,
  active_household_id uuid,                 -- household terakhir dibuka
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =========================================
-- 2. HOUSEHOLDS
-- =========================================
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references profiles(id),
  currency text not null default 'IDR',
  created_at timestamptz default now()
);

-- =========================================
-- 3. HOUSEHOLD MEMBERS (m:n)
-- =========================================
create type member_role as enum ('admin', 'editor', 'viewer');

create table household_members (
  household_id uuid references households(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role member_role not null default 'editor',
  joined_at timestamptz default now(),
  primary key (household_id, user_id)
);

-- =========================================
-- 4. INVITES
-- =========================================
create type invite_status as enum ('pending', 'accepted', 'expired', 'revoked');

create table invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  invited_by uuid references profiles(id),
  email text,                               -- nullable; bisa link-only
  token text unique not null,               -- random 32 byte hex
  role member_role not null default 'editor',
  status invite_status not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- =========================================
-- 5. WALLETS
-- =========================================
create type wallet_type as enum (
  'cash', 'debit', 'credit', 'ewallet',
  'savings', 'investment', 'receivable', 'payable'
);

create table wallets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  type wallet_type not null,
  icon text,
  color text,
  initial_balance numeric(18,2) not null default 0,
  is_archived boolean not null default false,
  exclude_from_networth boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =========================================
-- 6. CATEGORIES (tree dua level)
-- =========================================
create type category_kind as enum ('income', 'expense');

create table categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  parent_id uuid references categories(id) on delete cascade,
  name text not null,
  kind category_kind not null,
  icon text,
  color text,
  sort_order int not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz default now()
);

-- =========================================
-- 7. TRANSACTIONS
-- =========================================
create type transaction_type as enum ('income', 'expense', 'transfer');

create table transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  created_by uuid not null references profiles(id),
  type transaction_type not null,
  amount numeric(18,2) not null check (amount > 0),
  occurred_at timestamptz not null,           -- dapat di masa depan (scheduled tx)
  is_scheduled boolean not null default false, -- true jika occurred_at > now()
  wallet_id uuid not null references wallets(id),
  to_wallet_id uuid references wallets(id),   -- hanya untuk transfer
  category_id uuid references categories(id), -- null untuk transfer
  note text,
  tags text[] default '{}',
  receipt_url text,                            -- reserved untuk v2 (OCR AI)
  is_deleted boolean not null default false,   -- soft delete (recycle bin)
  deleted_at timestamptz,                      -- timestamp soft delete
  deleted_by uuid references profiles(id),
  client_id uuid,                              -- id offline client
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_tx_deleted_recycle on transactions(deleted_at) where is_deleted = true;
create index idx_tx_scheduled on transactions(household_id, occurred_at) where is_scheduled = true;

create index idx_tx_household_occurred on transactions(household_id, occurred_at desc) where is_deleted = false;
create index idx_tx_wallet on transactions(wallet_id) where is_deleted = false;
create index idx_tx_category on transactions(category_id) where is_deleted = false;

-- =========================================
-- 8. BUDGETS
-- =========================================
create table budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  amount numeric(18,2) not null check (amount > 0),
  period_month date not null,               -- selalu tanggal 1 dari bulan
  carry_over boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (household_id, category_id, period_month)
);

-- =========================================
-- 9. ACTIVITY LOG (audit ringan)
-- =========================================
create table activity_logs (
  id bigserial primary key,
  household_id uuid not null references households(id) on delete cascade,
  actor_id uuid references profiles(id),
  action text not null,                     -- 'tx.create', 'tx.update', 'member.invite', dst.
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz default now()
);

-- =========================================
-- 10. PUSH SUBSCRIPTIONS (Web Push)
-- =========================================
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now()
);
```

### 4.2 View Bantu

```sql
-- Saldo aktual tiap wallet = initial_balance + sum(income/transfer-in) - sum(expense/transfer-out)
create view v_wallet_balances as
select
  w.id as wallet_id,
  w.household_id,
  w.initial_balance
    + coalesce(sum(case when t.type='income' and t.wallet_id=w.id then t.amount end), 0)
    + coalesce(sum(case when t.type='transfer' and t.to_wallet_id=w.id then t.amount end), 0)
    - coalesce(sum(case when t.type='expense' and t.wallet_id=w.id then t.amount end), 0)
    - coalesce(sum(case when t.type='transfer' and t.wallet_id=w.id then t.amount end), 0)
    as balance
from wallets w
left join transactions t
  on (t.wallet_id = w.id or t.to_wallet_id = w.id)
  and t.is_deleted = false
group by w.id;
```

### 4.3 Row Level Security (RLS)

Pola umum: user hanya boleh mengakses baris di mana `household_id` ada di `household_members` milik dirinya. Role `viewer` hanya boleh SELECT; `editor` boleh INSERT/UPDATE/DELETE pada tabel transaksional; `admin` plus manajemen anggota.

```sql
alter table transactions enable row level security;

-- helper function (di skema public)
create or replace function is_member(hid uuid) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

create or replace function has_role(hid uuid, roles member_role[]) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from household_members
    where household_id = hid and user_id = auth.uid() and role = any(roles)
  );
$$;

create policy tx_select on transactions
  for select using (is_member(household_id));

create policy tx_insert on transactions
  for insert with check (has_role(household_id, array['admin','editor']::member_role[]));

create policy tx_update on transactions
  for update using (has_role(household_id, array['admin','editor']::member_role[]));

create policy tx_delete on transactions
  for delete using (has_role(household_id, array['admin']::member_role[]));
```

Policy serupa diterapkan untuk `wallets`, `categories`, `budgets`. Tabel `households` dibatasi: SELECT untuk anggota, UPDATE/DELETE hanya owner. Tabel `invites` SELECT/INSERT untuk admin; accept-invite ditangani via Edge Function khusus yang memvalidasi token tanpa RLS.

### 4.4 Trigger & Constraint Tambahan

Trigger `set_updated_at` di-attach ke semua tabel domain untuk auto-update kolom `updated_at`. Trigger pada `transactions`: jika `type = 'transfer'`, validasi `to_wallet_id` tidak null dan berbeda dari `wallet_id`. Constraint check pada `budgets.period_month` memastikan tanggal selalu 1.

## 5. Otentikasi & Otorisasi

Supabase Auth menangani sign-in dengan dua provider: Email (magic link sebagai default, password sebagai opsi) dan Google OAuth. Callback OAuth ditangani di `app/(auth)/callback/route.ts`. Setelah berhasil login pertama kali, trigger DB `handle_new_user` membuat row `profiles` dan satu `households` default ("Keluarga [Nama]") plus `household_members` dengan role admin.

Sesi disimpan di httpOnly cookie via `@supabase/ssr` agar server components dapat membaca auth context. Middleware Next.js (`middleware.ts`) memeriksa cookie pada setiap request ke `/app/*`; jika tidak ada, redirect ke `/login`.

Untuk RLS bekerja dengan benar, Supabase client di browser memuat JWT user; semua query otomatis dievaluasi terhadap policy.

## 6. Sinkronisasi Realtime & Offline

### 6.1 Realtime (Online Mode)

Saat user membuka app dan online, kita subscribe ke channel Supabase Realtime: `household:{household_id}` dengan filter `transactions`, `budgets`, `wallets`. Setiap event (INSERT/UPDATE/DELETE) langsung di-merge ke cache TanStack Query (`queryClient.setQueryData`) sehingga UI di device kedua update <2 detik tanpa polling.

### 6.2 Offline Queue & Sync Engine

Dexie schema (`src/lib/db/dexie.ts`):

```ts
import Dexie, { Table } from 'dexie';
export class SakuDB extends Dexie {
  transactions!: Table<TxRow, string>;
  wallets!: Table<WalletRow, string>;
  categories!: Table<CategoryRow, string>;
  budgets!: Table<BudgetRow, string>;
  outbox!: Table<OutboxEntry, string>;     // antrian mutasi belum tersinkron
  constructor() {
    super('saku');
    this.version(1).stores({
      transactions: 'id, household_id, occurred_at, updated_at, syncStatus',
      wallets: 'id, household_id, updated_at',
      categories: 'id, household_id',
      budgets: 'id, household_id, period_month',
      outbox: '++seq, entity, entityId, op, createdAt',
    });
  }
}
```

Saat user menambah transaksi, urutannya: (1) generate UUID v7 di client, (2) tulis ke Dexie `transactions` dengan `syncStatus='pending'`, (3) push ke Zustand store agar UI optimistis, (4) push entri ke `outbox`, (5) jika online, sync engine immediate flush; jika offline, simpan sampai event `online`.

**Konflik resolution.** Setiap row punya `updated_at` yang di-set saat write. Saat flushing, jika server menolak karena `updated_at` lebih lama (kondisi balapan dengan device kedua), kita pull versi server, tampilkan banner "Versi diperbarui oleh Bu Aisha — gunakan versi mana?" dengan opsi *Keep mine / Keep theirs*. Untuk MVP, default *last-write-wins* by `updated_at`, dan notifikasi ditampilkan tapi tidak modal.

### 6.3 Service Worker

Strategi caching menggunakan Workbox via Serwist:

- **Precache** shell aplikasi (HTML, JS, CSS, font, icon Lucide).
- **NetworkFirst** untuk API call `/rest/v1/*` ke Supabase (timeout 3s lalu fallback cache).
- **StaleWhileRevalidate** untuk request Storage (foto struk).
- **Skip waiting** + `clients.claim` agar update SW aktif tanpa reload manual; banner "Versi baru tersedia" muncul saat update terdeteksi.

## 7. Push Notifications

Saat user mengaktifkan notifikasi di Settings, browser meminta permission, lalu kita panggil `pushManager.subscribe()` dengan VAPID public key. Subscription disimpan di `push_subscriptions`. Notifikasi dipicu dari Supabase Edge Function (`send-push`) saat: (a) budget kategori menyentuh 80%/100%, (b) anggota household menambah transaksi >Rp 500.000, (c) reminder tagihan recurring jatuh tempo H-1.

Edge function memanggil VAPID-signed POST ke endpoint subscription. Library `web-push` (Node) digunakan di sisi Edge.

## 8. Design System — Monokrom + Mint Accent

Aksen utama menggunakan **mint** (`#B8E6D3`) yang dapat di-swap dari Settings ke pastel lain (peach, sky, lavender, butter) bila user menginginkan.

```css
/* src/app/globals.css — Tailwind v4 syntax */
@import "tailwindcss";

@theme {
  /* Neutrals (monokrom) */
  --color-bg: #FAFAF9;          /* light */
  --color-bg-dark: #0A0A0A;     /* dark */
  --color-surface: #FFFFFF;
  --color-surface-dark: #171717;
  --color-border: #E7E5E4;
  --color-text: #0C0A09;
  --color-text-muted: #78716C;

  /* Single pastel accent */
  --color-accent: #B8E6D3;      /* mint */
  --color-accent-strong: #5FBF9A;
  --color-accent-soft: #E8F7F0;

  /* Semantic */
  --color-income: #5FBF9A;      /* mint strong */
  --color-expense: #E8A5A5;     /* dusty rose */
  --color-warning: #F4D2A6;     /* butter */

  /* Radii */
  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;

  /* Font */
  --font-sans: "Geist", ui-sans-serif, system-ui;
  --font-mono: "Geist Mono", ui-monospace;
}

@media (prefers-color-scheme: dark) {
  @theme {
    --color-bg: var(--color-bg-dark);
    --color-surface: var(--color-surface-dark);
    --color-border: #292524;
    --color-text: #FAFAF9;
    --color-text-muted: #A8A29E;
  }
}
```

**Aturan visual.** Background dominan `--color-bg`; kartu surface tanpa shadow (cukup border 1px lembut atau pemisah ruang); aksen mint dipakai *sparingly* — hanya untuk: progress bar budget aktif, FAB, badge status sukses, garis chart utama. Income & expense menggunakan dusty-mint dan dusty-rose, bukan hijau-merah ngejreng. Tipografi tebal di angka, regular di label. Touch target minimal 44px.

## 9. PWA Manifest

```json
{
  "name": "Saku — Pencatat Keuangan Keluarga",
  "short_name": "Saku",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#FAFAF9",
  "theme_color": "#FAFAF9",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    {
      "name": "Tambah Pengeluaran",
      "url": "/?quickAdd=expense",
      "icons": [{ "src": "/icons/shortcut-expense.png", "sizes": "96x96" }]
    },
    {
      "name": "Tambah Pemasukan",
      "url": "/?quickAdd=income",
      "icons": [{ "src": "/icons/shortcut-income.png", "sizes": "96x96" }]
    }
  ]
}
```

## 10. API & Edge Functions

Sebagian besar interaksi data terjadi langsung via Supabase JS client + RLS (no custom REST). Edge Functions hanya untuk hal yang tidak boleh dipercayakan ke client:

- `POST /functions/v1/accept-invite` — validasi token invite, tambahkan user ke `household_members`, set `status='accepted'`.
- `POST /functions/v1/send-push` — dipicu oleh database webhook (`pg_net`) saat trigger budget terlampaui.
- `POST /functions/v1/export-csv` — generate CSV transaksi untuk periode tertentu, balas signed URL Storage berumur 5 menit.
- `CRON /functions/v1/cleanup-recycle-bin` — jadwal harian (00:00 SGT via `pg_cron`); hard-delete semua row `transactions` dengan `is_deleted=true AND deleted_at < now() - interval '30 days'`.
- `CRON /functions/v1/materialize-scheduled` — jadwal harian; transaksi yang `is_scheduled=true` dan `occurred_at <= now()` di-flip `is_scheduled=false` agar muncul di laporan & memengaruhi saldo.

Untuk MVP, **email transactional** (invite & magic link) sepenuhnya pakai built-in Supabase Auth email — tidak perlu Resend/Postmark. Quota gratis Supabase (4 email/jam) sangat cukup untuk 2 pengguna.

## 11. Testing Strategy

**Unit test** dengan Vitest untuk util (formatCurrency, sync engine merge logic). **Integration test** dengan Playwright untuk flow inti: login → tambah transaksi → lihat di dashboard. **Manual offline test**: matikan network di DevTools, lakukan 5 transaksi, kembalikan network, verifikasi semua tersinkron. **RLS test** dengan Supabase test SQL: pastikan user A tidak bisa SELECT transaksi household B.

## 12. Deployment & CI/CD

Repo di GitHub. Branch `main` auto-deploy ke production (Vercel); PR otomatis dapat preview deploy. Pipeline GitHub Actions menjalankan: `bun install`, `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`. Migration Supabase dijalankan via `supabase db push` dalam workflow terpisah dengan approval manual. Secrets (Supabase URL/anon key, VAPID keys) disimpan di Vercel env & GitHub Secrets.

## 13. Observability

**Logging.** Console structured logs di Edge Functions; di browser, errors di-forward ke Sentry (atau alternatif: PostHog session capture). **Metrics.** Vercel Analytics untuk web vitals; Supabase dashboard untuk DB query slow-log. **Realtime alerting** untuk error rate via Sentry → email.

## 14. Estimasi Biaya Awal

Tahap awal (hingga ~500 user aktif): Supabase Free atau Pro ($25/bulan); Vercel Hobby gratis. Web Push gratis. Estimasi total <$30/bulan. Saat scale ke ribuan user, Supabase Pro + tier storage tambahan (~$50–100/bulan), Vercel Pro ($20/user) bila perlu.

## 15. Konfigurasi Final

**Supabase project** dibuat di region **ap-southeast-1 (Singapore)** dengan tier Free. **GitHub repository** private milik akun Fahmi, nama `saku-kita`. **Vercel project** terhubung ke GitHub, deploy otomatis dari branch `main`. **Domain** menggunakan subdomain Vercel default (`saku-kita.vercel.app`) untuk sekarang; bisa upgrade ke custom domain nanti. **Realtime presence** (siapa online) tidak masuk MVP — terlalu kompleks dan tidak esensial untuk 2 user. **Rate-limit invite** dipakaikan Supabase built-in (default cukup) plus batasan logika: 1 invite link aktif per household dalam waktu yang sama.
