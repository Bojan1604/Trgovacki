'use client';

import { useMemo, useState } from 'react';
import { formatAmount, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface TrendPoint {
  date: string;
  value: number;
  /** Opcionalna druga vrijednost prikazana samo u opisu pri prelasku mišem. */
  secondaryValue?: number;
  secondaryLabel?: string;
}

/**
 * Kretanje kroz vrijeme — jedna serija, površina + linija.
 * Namjerno bez druge osi: druga mjera ide u zaseban grafikon.
 */
export function TrendArea({
  data,
  height = 140,
  valueLabel = 'Promet',
  unit = '€',
  className,
}: {
  data: TrendPoint[];
  height?: number;
  valueLabel?: string;
  unit?: string;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const geometry = useMemo(() => {
    if (data.length === 0) return null;
    const width = 1000;
    const padTop = 8;
    const padBottom = 18;
    const plotHeight = height - padTop - padBottom;
    const max = Math.max(...data.map((d) => d.value), 1);
    const min = 0;
    const stepX = data.length > 1 ? width / (data.length - 1) : width;

    const points = data.map((d, i) => ({
      x: i * stepX,
      y: padTop + plotHeight - ((d.value - min) / (max - min || 1)) * plotHeight,
      ...d,
    }));

    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = `${line} L${width},${padTop + plotHeight} L0,${padTop + plotHeight} Z`;

    return { width, points, line, area, max, padTop, plotHeight, stepX };
  }, [data, height]);

  if (!geometry) {
    return (
      <div className={cn('grid place-items-center text-sm text-ink-4', className)} style={{ height }}>
        Nema podataka za odabrano razdoblje
      </div>
    );
  }

  const active = hover !== null ? geometry.points[hover] : null;

  return (
    <div className={cn('relative', className)}>
      <svg
        viewBox={`0 0 ${geometry.width} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          const index = Math.round(ratio * (data.length - 1));
          setHover(Math.min(Math.max(index, 0), data.length - 1));
        }}
      >
        {/* Recesivna mreža — tri razine */}
        {[0, 0.5, 1].map((t) => (
          <line
            key={t}
            x1={0}
            x2={geometry.width}
            y1={geometry.padTop + geometry.plotHeight * t}
            y2={geometry.padTop + geometry.plotHeight * t}
            stroke="var(--color-hairline)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <path d={geometry.area} fill="var(--viz-1-soft)" />
        <path
          d={geometry.line}
          fill="none"
          stroke="var(--viz-1)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {active && (
          <>
            <line
              x1={active.x}
              x2={active.x}
              y1={geometry.padTop}
              y2={geometry.padTop + geometry.plotHeight}
              stroke="var(--color-ink-4)"
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={active.x}
              cy={active.y}
              r={4.5}
              fill="var(--viz-1)"
              stroke="var(--color-surface)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>

      {/* Os X — prvi, srednji i zadnji datum */}
      <div className="flex justify-between px-0.5 text-2xs text-ink-4 tnum">
        <span>{formatDate(data[0]?.date)}</span>
        {data.length > 2 && <span>{formatDate(data[Math.floor(data.length / 2)]?.date)}</span>}
        <span>{formatDate(data[data.length - 1]?.date)}</span>
      </div>

      {active && (
        <div
          className="pointer-events-none absolute top-0 z-10 min-w-[120px] rounded-md bg-surface px-2 py-1.5 shadow-[var(--shadow-overlay)]"
          style={{
            left: `calc(${(active.x / geometry.width) * 100}% + ${active.x / geometry.width > 0.7 ? -130 : 8}px)`,
          }}
        >
          <p className="text-2xs text-ink-3">{formatDate(active.date)}</p>
          <p className="text-md font-semibold tnum">
            {formatAmount(active.value)} {unit}
          </p>
          <p className="text-2xs text-ink-4">{valueLabel}</p>
          {active.secondaryValue !== undefined && (
            <p className="mt-0.5 text-2xs text-ink-3 tnum">
              {active.secondaryLabel}: {formatAmount(active.secondaryValue)} {unit}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
