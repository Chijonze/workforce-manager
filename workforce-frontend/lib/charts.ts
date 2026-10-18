// Pure chart geometry shared by the on-screen SVG chart components
// (components/charts/Charts.tsx) and the @react-pdf/renderer SVG primitives in
// AIAnalysisPDF. No React or DOM here — only math and path strings — so both
// renderers produce identical shapes.

export const CHART_COLORS = [
  "#0D9488", // brand teal
  "#D97706", // amber
  "#0284C7", // sky
  "#7C3AED", // violet
  "#E11D48", // rose
  "#65A30D", // lime
];

export const chartColor = (index: number) => CHART_COLORS[index % CHART_COLORS.length];

export type Point = { x: number; y: number };

export const polarToCartesian = (
  centerX: number,
  centerY: number,
  radius: number,
  angleDeg: number
): Point => {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(rad),
    y: centerY + radius * Math.sin(rad),
  };
};

// Annular sector ("donut" segment) as an SVG path string.
export const donutSegmentPath = (
  centerX: number,
  centerY: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number
) => {
  const sweep = endAngle - startAngle;
  if (sweep <= 0) return "";

  const startOuter = polarToCartesian(centerX, centerY, outerRadius, startAngle);
  const endOuter = polarToCartesian(centerX, centerY, outerRadius, endAngle);
  const startInner = polarToCartesian(centerX, centerY, innerRadius, endAngle);
  const endInner = polarToCartesian(centerX, centerY, innerRadius, startAngle);
  const largeArc = sweep > 180 ? 1 : 0;

  return [
    `M ${startOuter.x.toFixed(2)} ${startOuter.y.toFixed(2)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${endOuter.x.toFixed(2)} ${endOuter.y.toFixed(2)}`,
    `L ${startInner.x.toFixed(2)} ${startInner.y.toFixed(2)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${endInner.x.toFixed(2)} ${endInner.y.toFixed(2)}`,
    "Z",
  ].join(" ");
};

// Filled pie wedge from the center — used by the PDF pie chart.
export const pieWedgePath = (
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number
) => {
  const sweep = endAngle - startAngle;
  if (sweep <= 0) return "";

  const start = polarToCartesian(centerX, centerY, radius, startAngle);
  const end = polarToCartesian(centerX, centerY, radius, endAngle);
  const largeArc = sweep > 180 ? 1 : 0;

  return [
    `M ${centerX} ${centerY}`,
    `L ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    `A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
    "Z",
  ].join(" ");
};

export type PieSegmentGeometry = {
  index: number;
  path: string;
  color: string;
  startAngle: number;
  endAngle: number;
};

// Distributes values evenly around 360° and returns one donut path per value.
// A small angular gap keeps adjacent segments visually separated.
export const buildDonutGeometry = (
  values: number[],
  options: {
    centerX: number;
    centerY: number;
    outerRadius: number;
    innerRadius: number;
    gapDeg?: number;
  }
): PieSegmentGeometry[] => {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 0 || !values.length) return [];

  const gapDeg = Math.min(options.gapDeg ?? 1.2, 360 / values.length / 2);
  let cursor = 0;

  return values.map((value, index) => {
    const sweep = (Math.max(0, value) / total) * 360;
    const startAngle = cursor + gapDeg / 2;
    const endAngle = cursor + Math.max(sweep - gapDeg, 0.5);
    cursor += sweep;

    return {
      index,
      path: donutSegmentPath(
        options.centerX,
        options.centerY,
        options.outerRadius,
        options.innerRadius,
        startAngle,
        endAngle
      ),
      color: chartColor(index),
      startAngle,
      endAngle,
    };
  });
};

export type BarGeometry = {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};

// Lays out vertical bars inside a plot area; bars grow up from the baseline.
// scaleMax is the axis maximum the plot area represents (bars are drawn
// relative to it, not to the largest value).
export const buildBarGeometry = (
  values: number[],
  options: {
    plotX: number;
    plotY: number;
    plotWidth: number;
    plotHeight: number;
    gapRatio?: number;
    scaleMax?: number;
  }
): BarGeometry[] => {
  const scaleMax = options.scaleMax ?? Math.max(...values, 1);
  const slot = options.plotWidth / Math.max(values.length, 1);
  const gap = slot * (options.gapRatio ?? 0.35);

  return values.map((value, index) => {
    const barHeight = Math.max((value / scaleMax) * options.plotHeight, value > 0 ? 2 : 0);
    return {
      index,
      x: options.plotX + slot * index + gap / 2,
      y: options.plotY + options.plotHeight - barHeight,
      width: Math.max(slot - gap, 1),
      height: barHeight,
      color: chartColor(0),
    };
  });
};

// Nice rounded axis maximum for bar charts (e.g. 37 -> 40, 480 -> 500).
export const niceAxisMax = (value: number) => {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const scaled = value / magnitude;
  const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return nice * magnitude;
};

export const formatMinutes = (minutes: number) => {
  const whole = Math.round(minutes);
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};
