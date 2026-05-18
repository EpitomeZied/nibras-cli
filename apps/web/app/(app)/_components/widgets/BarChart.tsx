'use client';

import styles from './BarChart.module.css';

export type BarChartDatum = {
  label: string;
  value: number;
  color?: string;
};

export type BarChartProps = {
  data: BarChartDatum[];
  height?: number;
  yLabel?: string;
  showValues?: boolean;
  ariaLabel?: string;
};

export default function BarChart({
  data,
  height = 200,
  yLabel,
  showValues = false,
  ariaLabel = 'Bar chart',
}: BarChartProps) {
  if (data.length === 0) {
    return <div className={styles.empty}>No data</div>;
  }

  const width = 600;
  const paddingLeft = 36;
  const paddingRight = 12;
  const paddingTop = 12;
  const paddingBottom = 26;
  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;
  const max = Math.max(...data.map((d) => d.value), 1);
  const barGap = 6;
  const barWidth = Math.max(8, (innerWidth - barGap * (data.length - 1)) / data.length);

  return (
    <figure className={styles.chart} aria-label={ariaLabel}>
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        preserveAspectRatio="none"
      >
        {/* y-axis grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = paddingTop + innerHeight * (1 - tick);
          return (
            <g key={tick}>
              <line
                x1={paddingLeft}
                x2={width - paddingRight}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeOpacity="0.12"
              />
              <text
                x={paddingLeft - 6}
                y={y + 3}
                textAnchor="end"
                fontSize="9"
                fill="currentColor"
                opacity="0.55"
              >
                {Math.round(max * tick)}
              </text>
            </g>
          );
        })}

        {/* bars */}
        {data.map((datum, idx) => {
          const x = paddingLeft + idx * (barWidth + barGap);
          const barHeight = (datum.value / max) * innerHeight;
          const y = paddingTop + innerHeight - barHeight;
          return (
            <g key={`${datum.label}-${idx}`}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={3}
                fill={datum.color ?? 'var(--primary, #22c55e)'}
                opacity={0.85}
              >
                <title>{`${datum.label}: ${datum.value}`}</title>
              </rect>
              {showValues && (
                <text
                  x={x + barWidth / 2}
                  y={y - 4}
                  textAnchor="middle"
                  fontSize="9"
                  fill="currentColor"
                  opacity="0.75"
                >
                  {datum.value}
                </text>
              )}
              <text
                x={x + barWidth / 2}
                y={height - 8}
                textAnchor="middle"
                fontSize="10"
                fill="currentColor"
                opacity="0.6"
              >
                {datum.label}
              </text>
            </g>
          );
        })}
      </svg>
      {yLabel && <figcaption className={styles.caption}>{yLabel}</figcaption>}
    </figure>
  );
}
