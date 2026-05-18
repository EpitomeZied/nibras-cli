'use client';

import styles from './Sparkline.module.css';

export type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  ariaLabel?: string;
};

export default function Sparkline({
  values,
  width = 120,
  height = 36,
  color = 'var(--primary, #22c55e)',
  fill = true,
  ariaLabel = 'Trend',
}: SparklineProps) {
  if (values.length === 0) {
    return <span className={styles.empty} aria-label={ariaLabel}>—</span>;
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;

  const points = values.map((value, idx) => {
    const x = idx * stepX;
    const y = height - ((value - min) / range) * height;
    return [x, y] as const;
  });

  const linePath = points
    .map(([x, y], idx) => `${idx === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ');

  const fillPath = `${linePath} L${width} ${height} L0 ${height} Z`;

  return (
    <svg
      className={styles.spark}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
    >
      {fill && (
        <path
          d={fillPath}
          fill={color}
          fillOpacity="0.15"
        />
      )}
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
