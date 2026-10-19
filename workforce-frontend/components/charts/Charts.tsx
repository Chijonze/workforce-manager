"use client";

import { formatMinutes, buildBarGeometry, buildDonutGeometry, chartColor, niceAxisMax } from "@/lib/charts";
import type { AnalysisChartPoint } from "@/types/workforce";

// On-screen SVG chart set for the AI Analysis & Summary page. The PDF export
// draws the same geometry with @react-pdf primitives so both stay in sync.

const scoreColor = (score: number) => (score >= 80 ? "#0D9488" : score >= 60 ? "#D97706" : "#E11D48");

export function ScoreDonut({
  score,
  size = 200,
  caption = "Overall performance",
}: {
  score: number;
  size?: number;
  caption?: string;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const centerX = size / 2;
  const centerY = size / 2;
  const outerRadius = size / 2 - 10;
  const innerRadius = outerRadius - 18;
  const geometry = buildDonutGeometry([clamped, 100 - clamped], {
    centerX,
    centerY,
    outerRadius,
    innerRadius,
    gapDeg: 2,
  });
  const progress = geometry[0];

  return (
    <div className="score-donut" role="img" aria-label={`${caption}: ${clamped}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={centerX} cy={centerY} r={outerRadius - 9} fill="none" stroke="#E4E9E6" strokeWidth={18} />
        {progress && <path d={progress.path} fill={scoreColor(clamped)} />}
        <text x={centerX} y={centerY - 2} textAnchor="middle" className="score-donut-value">
          {clamped}%
        </text>
        <text x={centerX} y={centerY + 18} textAnchor="middle" className="score-donut-caption">
          {caption}
        </text>
      </svg>
    </div>
  );
}

export function BarChart({
  title,
  unit,
  series,
  height = 230,
}: {
  title: string;
  unit: string;
  series: AnalysisChartPoint[];
  height?: number;
}) {
  const width = 560;
  const plotX = 44;
  const plotY = 14;
  const plotWidth = width - plotX - 12;
  const plotHeight = height - plotY - 30;
  const values = series.map((point) => Math.max(0, point.value));
  const axisMax = niceAxisMax(Math.max(...values, 0));
  const bars = buildBarGeometry(values, { plotX, plotY, plotWidth, plotHeight, scaleMax: axisMax });
  const labelStep = Math.ceil(series.length / 10);
  const formatValue = (value: number) => {
    if (unit === "min") return formatMinutes(value);
    if (unit === "%") return `${Math.round(value)}%`;
    return `${Math.round(value)}${unit ? ` ${unit}` : ""}`;
  };

  return (
    <div className="chart-card">
      <h3 className="chart-title">{title}</h3>
      {series.length ? (
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="chart-svg">
          {[0.25, 0.5, 0.75, 1].map((fraction) => {
            const y = plotY + plotHeight - plotHeight * fraction;
            return (
              <g key={fraction}>
                <line x1={plotX} y1={y} x2={plotX + plotWidth} y2={y} stroke="#E4E9E6" strokeWidth={1} strokeDasharray="4 5" />
                <text x={plotX - 8} y={y + 4} textAnchor="end" className="chart-axis-label">
                  {Math.round(axisMax * fraction)}
                </text>
              </g>
            );
          })}
          <line x1={plotX} y1={plotY + plotHeight} x2={plotX + plotWidth} y2={plotY + plotHeight} stroke="#CBD5D1" strokeWidth={1.5} />
          {bars.map((bar) => (
            <g key={bar.index}>
              <rect x={bar.x} y={bar.y} width={bar.width} height={bar.height} rx={4} fill={bar.color} opacity={0.92}>
                <title>{`${series[bar.index].label}: ${formatValue(series[bar.index].value)}`}</title>
              </rect>
              {bar.index % labelStep === 0 && (
                <text
                  x={bar.x + bar.width / 2}
                  y={plotY + plotHeight + 16}
                  textAnchor="middle"
                  className="chart-axis-label"
                >
                  {series[bar.index].label}
                </text>
              )}
            </g>
          ))}
        </svg>
      ) : (
        <p className="muted">No volume data was recorded for this shift.</p>
      )}
    </div>
  );
}

export function PieChart({
  title,
  unit,
  segments,
  size = 190,
}: {
  title: string;
  unit: string;
  segments: AnalysisChartPoint[];
  size?: number;
}) {
  const centerX = size / 2;
  const centerY = size / 2;
  const outerRadius = size / 2 - 8;
  const innerRadius = outerRadius - 20;
  const values = segments.map((segment) => Math.max(0, segment.value));
  const total = values.reduce((sum, value) => sum + value, 0);
  const geometry = buildDonutGeometry(values, { centerX, centerY, outerRadius, innerRadius });
  const formatValue = (value: number) => (unit === "min" ? formatMinutes(value) : `${Math.round(value)}${unit ? ` ${unit}` : ""}`);

  return (
    <div className="chart-card">
      <h3 className="chart-title">{title}</h3>
      {segments.length >= 1 && total > 0 ? (
        <div className="chart-pie-layout">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {geometry.map((segment) => (
              <path key={segment.index} d={segment.path} fill={segment.color} opacity={0.92}>
                <title>{`${segments[segment.index].label}: ${formatValue(segments[segment.index].value)}`}</title>
              </path>
            ))}
          </svg>
          <ul className="chart-legend">
            {segments.map((segment, index) => (
              <li key={segment.label}>
                <span className="legend-dot" style={{ backgroundColor: chartColor(index) }} />
                <span className="legend-label">{segment.label}</span>
                <span className="legend-value">
                  {formatValue(segment.value)}
                  {total > 0 && ` · ${Math.round((segment.value / total) * 100)}%`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted">No allocation data was recorded for this shift.</p>
      )}
    </div>
  );
}
