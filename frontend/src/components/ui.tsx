import React from 'react';
import { AlertCircle } from 'lucide-react';
import type { DataOrigin } from '../types/fieldwise';
import { cn } from '../utils/cn';

const ORIGIN_META: Record<
  string,
  { label: string; dot: string; tone: string }
> = {
  live_retrieved: {
    label: 'Live NASA Data',
    dot: 'bg-[#1D7A4C]',
    tone: 'bg-[#F3F8F5] text-[#154734] border-[#D3E4DA]',
  },
  historical_satellite: {
    label: 'Satellite Archive',
    dot: 'bg-[#2B6CB0]',
    tone: 'bg-[#F2F6FA] text-[#1E3F66] border-[#D3DFEC]',
  },
  user_entered: {
    label: 'Field / Lab Input',
    dot: 'bg-[#475569]',
    tone: 'bg-[#F4F5F7] text-[#334155] border-[#DCE0E6]',
  },
  illustrative_demo: {
    label: 'Illustrative Demo',
    dot: 'bg-[#B7791F]',
    tone: 'bg-[#FBF7EE] text-[#7C4E0B] border-[#ECDCC0]',
  },
  model_derived: {
    label: 'Deterministic Model',
    dot: 'bg-[#154734]',
    tone: 'bg-[#F4F6F4] text-[#283B30] border-[#DCE2DC]',
  },
  hypothetical_simulation: {
    label: 'Hypothetical What-If',
    dot: 'bg-[#B91C1C]',
    tone: 'bg-[#FDF3F2] text-[#8E1C1C] border-[#F2CECA]',
  },
};

export function OriginBadge({ origin, className }: { origin?: DataOrigin | string | null; className?: string }) {
  const key = origin || 'model_derived';
  const cfg = ORIGIN_META[key] || {
    label: String(key),
    dot: 'bg-slate-400',
    tone: 'bg-[#F4F3EE] text-[#4E5650] border-[#E0DDD2]',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight tracking-tight whitespace-nowrap',
        cfg.tone,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', cfg.dot)} />
      <span>{cfg.label}</span>
    </span>
  );
}

export function RiskBadge({ category }: { category: string }) {
  const styles: Record<string, string> = {
    Low: 'bg-[#ECF6F0] text-[#155E3A] border-[#C6E3D2]',
    Moderate: 'bg-[#FBF6EA] text-[#854D0E] border-[#ECD9AE]',
    Elevated: 'bg-[#FFF3EC] text-[#9A3412] border-[#F6CFB5]',
    High: 'bg-[#FDF1F1] text-[#991B1B] border-[#F2C6C6]',
    'Insufficient Data': 'bg-[#F3F2ED] text-[#5C6660] border-[#DFDDD4]',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-tight whitespace-nowrap',
        styles[category] || styles['Insufficient Data'],
      )}
    >
      {category}
    </span>
  );
}

export function Panel({
  title,
  subtitle,
  right,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        'min-w-0 rounded-lg border border-[#E4E1D6] bg-white shadow-[0_1px_2px_rgba(23,28,25,0.03)]',
        className,
      )}
    >
      {(title || right) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-[#EFECE4] px-5 py-3.5">
          <div className="min-w-0">
            {title && (
              <h2 className="text-[13.5px] font-semibold text-[#171C19] tracking-[-0.01em]">{title}</h2>
            )}
            {subtitle && <p className="mt-0.5 text-xs text-[#5C6660] leading-snug">{subtitle}</p>}
          </div>
          {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
        </header>
      )}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export function KpiCard({
  label,
  value,
  unit,
  subtext,
  origin,
  tone = 'neutral',
}: {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  subtext?: string;
  origin?: DataOrigin | string;
  tone?: 'neutral' | 'green' | 'amber' | 'red';
}) {
  const valueTone = {
    neutral: 'text-[#171C19]',
    green: 'text-[#154734]',
    amber: 'text-[#92400E]',
    red: 'text-[#991B1B]',
  }[tone];

  const dotTone = {
    neutral: 'bg-[#64748B]',
    green: 'bg-[#1D7A4C]',
    amber: 'bg-[#D97706]',
    red: 'bg-[#DC2626]',
  }[tone];

  const isUnavailable = value === null || value === undefined || value === '';

  return (
    <div className="flex flex-col justify-between rounded-lg border border-[#E4E1D6] bg-white p-4 shadow-[0_1px_2px_rgba(23,28,25,0.03)] min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5C6660] truncate">
          <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotTone)} />
          <span className="truncate">{label}</span>
        </span>
      </div>
      <div className="mt-2.5 flex items-baseline gap-1.5">
        {isUnavailable ? (
          <span className="text-sm font-medium text-[#8C948E]">Not Retrieved</span>
        ) : (
          <>
            <span className={cn('tabular-nums text-[26px] font-bold leading-none tracking-[-0.025em]', valueTone)}>
              {value}
            </span>
            {unit && <span className="font-mono text-[11px] font-medium text-[#5C6660]">{unit}</span>}
          </>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5 border-t border-[#F2EFE8] pt-2">
        <p className="text-[11px] leading-snug text-[#5C6660]">{subtext || ''}</p>
        {origin && <OriginBadge origin={origin} />}
      </div>
    </div>
  );
}

export function EmptyOrErrorState({
  title,
  message,
  actionLabel,
  onAction,
  isError = false,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  isError?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-start justify-between gap-4 rounded-lg border p-5 sm:flex-row sm:items-center',
        isError
          ? 'border-[#F2CECA] bg-[#FDF6F5] text-[#7F1D1D]'
          : 'border-[#E4E1D6] bg-[#FAF9F5] text-[#171C19]',
      )}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className={cn('mt-0.5 h-5 w-5 shrink-0', isError ? 'text-[#B91C1C]' : 'text-[#154734]')} />
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-0.5 text-xs text-[#5C6660] leading-relaxed">{message}</p>
        </div>
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 rounded-md bg-[#154734] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#0E291E] cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
