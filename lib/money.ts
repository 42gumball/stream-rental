// Angolan Kwanza helpers. Amounts are stored as whole Kz (integers).

export function formatKz(amount: number | null | undefined): string {
  const n = amount ?? 0;
  return `${n.toLocaleString("pt-PT", { maximumFractionDigits: 0 })} Kz`;
}

// Parse a user-typed amount ("2 000", "2000", "2.000") into an integer of Kz.
export function parseKz(input: FormDataEntryValue | null | undefined): number {
  if (input == null) return 0;
  const cleaned = String(input).replace(/[^\d]/g, "");
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : 0;
}
