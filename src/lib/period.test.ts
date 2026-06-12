import { describe, expect, test } from "bun:test";
import {
  MONTH_START_DAY,
  getPeriodKeyForDate,
  getPeriodRange,
  shiftPeriodKey,
  formatPeriodLabel,
  formatPeriodRangeLabel,
} from "./period";

// Semua tes mengasumsikan konfigurasi produksi: gajian tanggal 25.
// Periode "Juni 2026" = 25 Mei s/d 24 Juni (WIB).

describe("getPeriodKeyForDate", () => {
  test("tanggal sebelum hari gajian masuk periode bulan berjalan", () => {
    expect(getPeriodKeyForDate("2026-06-12T10:00:00+07:00")).toBe("2026-06-01");
    expect(getPeriodKeyForDate("2026-06-24T23:59:59+07:00")).toBe("2026-06-01");
  });

  test("hari gajian dan sesudahnya masuk periode bulan berikutnya", () => {
    expect(getPeriodKeyForDate("2026-05-25T00:00:00+07:00")).toBe("2026-06-01");
    expect(getPeriodKeyForDate("2026-05-31T12:00:00+07:00")).toBe("2026-06-01");
  });

  test("batas zona waktu: 24 Mei 18:00 UTC = 25 Mei 01:00 WIB", () => {
    expect(getPeriodKeyForDate("2026-05-24T18:00:00Z")).toBe("2026-06-01");
    // sedangkan 24 Mei 16:59 UTC masih 24 Mei 23:59 WIB
    expect(getPeriodKeyForDate("2026-05-24T16:59:00Z")).toBe("2026-05-01");
  });

  test("rollover tahun: 25 Desember masuk periode Januari tahun berikutnya", () => {
    expect(getPeriodKeyForDate("2025-12-25T08:00:00+07:00")).toBe("2026-01-01");
    expect(getPeriodKeyForDate("2026-01-24T08:00:00+07:00")).toBe("2026-01-01");
  });
});

describe("getPeriodRange", () => {
  test("periode Juni 2026 = 25 Mei s/d 24 Juni", () => {
    expect(getPeriodRange("2026-06-01")).toEqual({
      startDate: "2026-05-25",
      endDate: "2026-06-24",
    });
  });

  test("periode Januari menyeberang tahun", () => {
    expect(getPeriodRange("2026-01-01")).toEqual({
      startDate: "2025-12-25",
      endDate: "2026-01-24",
    });
  });

  test("periode Maret mulai dari Februari (bulan pendek)", () => {
    expect(getPeriodRange("2026-03-01")).toEqual({
      startDate: "2026-02-25",
      endDate: "2026-03-24",
    });
  });

  test("rentang dua periode berurutan tidak bolong dan tidak tumpang tindih", () => {
    const a = getPeriodRange("2026-06-01");
    const b = getPeriodRange("2026-07-01");
    const dayAfterA = new Date(`${a.endDate}T00:00:00Z`);
    dayAfterA.setUTCDate(dayAfterA.getUTCDate() + 1);
    expect(dayAfterA.toISOString().slice(0, 10)).toBe(b.startDate);
  });
});

describe("shiftPeriodKey", () => {
  test("mundur melewati batas tahun", () => {
    expect(shiftPeriodKey("2026-01-01", -1)).toBe("2025-12-01");
  });
  test("maju 12 bulan", () => {
    expect(shiftPeriodKey("2026-06-01", 12)).toBe("2027-06-01");
  });
});

describe("label", () => {
  test("label utama menampilkan bulan & tahun", () => {
    expect(formatPeriodLabel("2026-06-01")).toContain("Juni");
    expect(formatPeriodLabel("2026-06-01")).toContain("2026");
  });

  test("label rentang muncul ketika siklus gajian aktif", () => {
    if (MONTH_START_DAY !== 1) {
      expect(formatPeriodRangeLabel("2026-06-01").length).toBeGreaterThan(0);
    }
  });
});
