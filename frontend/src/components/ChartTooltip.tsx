interface TooltipEntry {
  name?: string;
  value?: number | string | null;
  color?: string;
  unit?: string;
  payload?: Record<string, unknown>;
}

export function ChartTooltip({
  active,
  payload,
  label,
  valueSuffix = '',
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  valueSuffix?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="min-w-[168px] rounded-lg border border-[#DDDAD0] bg-white/95 px-3 py-2 text-xs shadow-[0_8px_24px_rgba(23,28,25,0.12)] backdrop-blur-xs">
      {label !== undefined && label !== '' && (
        <div className="mb-1.5 border-b border-[#EFECE4] pb-1 font-mono text-[11px] font-semibold text-[#171C19]">
          {label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((entry, idx) => {
          const val = entry.value;
          const formatted =
            val === null || val === undefined
              ? '—'
              : typeof val === 'number'
                ? Number.isInteger(val)
                  ? `${val}${valueSuffix}`
                  : `${val.toFixed(2)}${valueSuffix}`
                : String(val);

          return (
            <div key={idx} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-[11px] text-[#5C6660]">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color || '#154734' }}
                />
                <span className="truncate max-w-[150px]">{entry.name}</span>
              </span>
              <span className="font-mono text-[11px] font-semibold tabular-nums text-[#171C19]">
                {formatted}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

