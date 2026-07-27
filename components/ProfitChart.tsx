import { formatKz, formatKzCompact } from "@/lib/money";
import { monthKey, monthShort } from "@/lib/dates";

export type MonthDatum = {
  month: Date;
  revenue: number;
  expense: number;
  profit: number;
};

// A server-rendered bar chart of monthly profit. Positive months grow up in
// green, negative months grow down in red, sharing a single value scale around
// a zero baseline. Pure HTML/CSS — no client JS, no chart library.
export function ProfitChart({ data, selectedKey }: { data: MonthDatum[]; selectedKey?: string }) {
  const maxPos = Math.max(0, ...data.map((d) => d.profit));
  const minNeg = Math.min(0, ...data.map((d) => d.profit));
  const maxAbs = Math.max(maxPos, -minNeg);

  if (maxAbs === 0) {
    return <div className="card text-center text-sm muted" style={{ padding: 24 }}>No profit recorded in this range yet.</div>;
  }

  // Shared scale: px per Kz. Each side's track is only as tall as it needs.
  const FULL = 130; // px for the largest bar
  const pxPerKz = FULL / maxAbs;
  const posTrack = Math.ceil(maxPos * pxPerKz);
  const negTrack = Math.ceil(-minNeg * pxPerKz);

  const barSize = (v: number) => Math.max(3, Math.round(Math.abs(v) * pxPerKz));

  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <div className="flex items-stretch gap-2" style={{ minWidth: data.length * 34 }}>
        {data.map((d) => {
          const key = monthKey(d.month);
          const isSel = key === selectedKey;
          const pos = d.profit >= 0;
          const title = `${monthShort(d.month)} ${d.month.getFullYear()}\nRevenue ${formatKz(d.revenue)}\nSpent ${formatKz(d.expense)}\nProfit ${formatKz(d.profit)}`;
          return (
            <div key={key} className="flex flex-1 flex-col items-center" style={{ minWidth: 26 }} title={title}>
              {/* Positive track (bars grow up from the zero line) */}
              <div className="flex w-full flex-col items-center justify-end" style={{ height: posTrack }}>
                {pos && d.profit !== 0 && (
                  <>
                    <span className="mb-1 text-[10px] font-semibold" style={{ color: "var(--color-pos)", whiteSpace: "nowrap" }}>
                      {formatKzCompact(d.profit)}
                    </span>
                    <div
                      style={{
                        width: "70%",
                        maxWidth: 26,
                        height: barSize(d.profit),
                        borderRadius: "4px 4px 0 0",
                        background: "var(--color-pos)",
                        opacity: isSel ? 1 : 0.85,
                        outline: isSel ? "2px solid var(--color-brand)" : "none",
                        outlineOffset: 1,
                      }}
                    />
                  </>
                )}
              </div>

              {/* Zero baseline */}
              <div style={{ height: 1, width: "100%", background: "var(--color-border-strong)" }} />

              {/* Negative track (bars grow down) — only rendered when a month lost money */}
              {negTrack > 0 && (
                <div className="flex w-full flex-col items-center justify-start" style={{ height: negTrack }}>
                  {!pos && (
                    <>
                      <div
                        style={{
                          width: "70%",
                          maxWidth: 26,
                          height: barSize(d.profit),
                          borderRadius: "0 0 4px 4px",
                          background: "var(--color-neg)",
                          opacity: isSel ? 1 : 0.85,
                          outline: isSel ? "2px solid var(--color-brand)" : "none",
                          outlineOffset: 1,
                        }}
                      />
                      <span className="mt-1 text-[10px] font-semibold" style={{ color: "var(--color-neg)", whiteSpace: "nowrap" }}>
                        {formatKzCompact(d.profit)}
                      </span>
                    </>
                  )}
                </div>
              )}

              {/* Month label */}
              <span
                className="mt-2 text-[11px] font-medium"
                style={{ color: isSel ? "var(--color-brand)" : "var(--color-muted)", whiteSpace: "nowrap" }}
              >
                {monthShort(d.month)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
