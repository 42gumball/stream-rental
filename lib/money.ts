// Angolan Kwanza helpers. Amounts are stored as whole Kz (integers).

export function formatKz(amount: number | null | undefined): string {
  const n = amount ?? 0;
  return `${n.toLocaleString("pt-PT", { maximumFractionDigits: 0 })} Kz`;
}

// Compact Kz for tight spaces (chart labels): 1 500 → "1.5k", 12 000 → "12k".
export function formatKzCompact(amount: number | null | undefined): string {
  const n = amount ?? 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs < 1000) return `${n}`;
  const k = abs / 1000;
  const str = k >= 100 || k % 1 === 0 ? String(Math.round(k)) : k.toFixed(1);
  return `${sign}${str}k`;
}

// Parse a user-typed amount ("2 000", "2000", "2.000") into an integer of Kz.
export function parseKz(input: FormDataEntryValue | null | undefined): number {
  if (input == null) return 0;
  const cleaned = String(input).replace(/[^\d]/g, "");
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : 0;
}
