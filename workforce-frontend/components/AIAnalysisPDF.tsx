import { Circle, Document, Image, Line, Page, Path, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import {
  buildBarGeometry,
  buildDonutGeometry,
  formatMinutes,
  niceAxisMax,
} from "@/lib/charts";
import type { ShiftAnalysis } from "@/types/workforce";

// Branded PDF export for the AI Analysis & Summary page — same teal/navy
// language as InvoicePDF, with chart geometry drawn via @react-pdf SVG
// primitives from the shared lib/charts helpers.

const teal = "#1A9797";
const darkTeal = "#006F7F";
const black = "#111111";
const grey = "#F1F1F1";
const line = "#DFE5E2";
const muted = "#5B6B66";

const scoreColor = (score: number) => (score >= 80 ? "#0D9488" : score >= 60 ? "#D97706" : "#E11D48");

export type AnalysisPdfData = {
  reference: string;
  generatedAtLabel: string;
  modelLabel: string;
  worker: { name: string; email: string };
  shift: { dateLabel: string; attendanceLabel: string };
  hiringManager: { name: string; email: string; organization: string; address: string; companyNumber: string };
  analysis: ShiftAnalysis;
  logoSrc?: string;
  captureImages: Record<string, string>;
};

export function buildAnalysisPdfData(input: {
  analysis: ShiftAnalysis;
  worker: { name: string; email: string };
  hiringManager: import("@/types/workforce").User;
  logoSrc?: string;
  captureImages: Record<string, string>;
}): AnalysisPdfData {
  const dateFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });
  const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
  const generatedAt = new Date(input.analysis.generatedAt);

  return {
    reference: `AVS-AIA-${generatedAt.toISOString().slice(0, 10).replace(/-/g, "")}-${input.analysis.shiftSessionId.slice(-4).toUpperCase()}`,
    generatedAtLabel: dateTimeFormatter.format(generatedAt),
    modelLabel: input.analysis.source === "gemini"
      ? input.analysis.aiModel || "Google Gemini"
      : "ShiftSync offline summary",
    worker: input.worker,
    shift: {
      dateLabel: dateFormatter.format(new Date(input.analysis.workDate)),
      attendanceLabel: input.analysis.metrics.attendanceStatus.replace(/_/g, " "),
    },
    hiringManager: {
      name: input.hiringManager.name,
      email: input.hiringManager.email,
      organization: input.hiringManager.organizationName || input.hiringManager.name,
      address: input.hiringManager.organizationAddress || "",
      companyNumber: input.hiringManager.companyNumber || "",
    },
    analysis: input.analysis,
    logoSrc: input.logoSrc,
    captureImages: input.captureImages,
  };
}

const styles = StyleSheet.create({
  page: { padding: 36, paddingBottom: 72, fontSize: 10, fontFamily: "Helvetica", color: black, backgroundColor: "#FFFFFF" },
  // The wave band is page-one only (content on later pages starts at the top).
  topWave: { position: "absolute", top: 28, left: 36, right: 36, height: 54, backgroundColor: teal },
  topMask: { position: "absolute", top: 58, left: 36, right: 36, height: 56, backgroundColor: "#FFFFFF" },
  bottomWave: { position: "absolute", bottom: 28, right: 36, width: 145, height: 64, backgroundColor: teal },
  bottomDarkWave: { position: "absolute", bottom: 28, right: 36, width: 88, height: 64, backgroundColor: darkTeal },
  content: { position: "relative" },
  logoWrap: { alignItems: "center", minHeight: 96, justifyContent: "flex-end", marginBottom: 5 },
  logo: { width: 150, height: 78, objectFit: "contain" },
  logoFallback: { fontSize: 28, fontFamily: "Helvetica-Bold", color: teal },
  reportTitle: { textAlign: "center", fontSize: 20, fontFamily: "Helvetica-Bold", color: teal, marginBottom: 8 },
  metaGrid: { backgroundColor: grey, paddingVertical: 7, paddingHorizontal: 12, marginBottom: 6 },
  metaRow: { flexDirection: "row" },
  metaItem: { width: "50%", flexDirection: "row", marginBottom: 3 },
  metaItemLast: { marginBottom: 0 },
  metaLabel: { fontFamily: "Helvetica-Bold", color: "#555555", marginRight: 5 },
  parties: { flexDirection: "row", marginBottom: 6 },
  party: { width: "50%", paddingHorizontal: 3, minHeight: 84 },
  partyHeading: { fontFamily: "Helvetica-Bold", color: darkTeal, fontSize: 11, marginBottom: 6 },
  partyName: { fontSize: 11, marginBottom: 4 },
  address: { fontSize: 10, lineHeight: 1.35 },
  sectionTitle: { backgroundColor: teal, color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 10, textAlign: "center", paddingVertical: 5, marginTop: 8 },
  scoreSection: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 18 },
  donutWrap: { width: 150, alignItems: "center" },
  donutScore: { marginTop: -95, fontSize: 22, fontFamily: "Helvetica-Bold", color: black },
  donutCaption: { fontSize: 7.5, color: muted, marginTop: 76 },
  kpiGrid: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  kpiTile: { width: "32%", backgroundColor: "#F7FAF9", borderRadius: 4, padding: 6, borderWidth: 1, borderColor: line },
  kpiValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: darkTeal },
  kpiLabel: { fontSize: 7.5, color: muted, marginTop: 2 },
  chartTitle: { fontFamily: "Helvetica-Bold", fontSize: 10.5, color: darkTeal, marginTop: 10, marginBottom: 4 },
  narrativeBlock: { marginBottom: 8 },
  narrativeHeading: { fontFamily: "Helvetica-Bold", color: darkTeal, fontSize: 10.5, marginBottom: 3 },
  narrativeText: { fontSize: 10, lineHeight: 1.4 },
  findingRow: { flexDirection: "row", marginBottom: 3, gap: 5, paddingRight: 12 },
  findingMarker: { fontFamily: "Helvetica-Bold", color: teal, fontSize: 10 },
  findingMarkerConcern: { fontFamily: "Helvetica-Bold", color: "#C2410C", fontSize: 10 },
  findingText: { flex: 1, fontSize: 10, lineHeight: 1.35 },
  captureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  captureCard: { width: "23%", borderRadius: 4, borderWidth: 1, borderColor: line, padding: 4 },
  captureImage: { width: "100%", height: 90, borderRadius: 2 },
  captureMissing: { width: "100%", height: 90, backgroundColor: grey, fontSize: 7.5, color: muted, textAlign: "center", paddingTop: 40 },
  captureTime: { fontSize: 7, color: muted, marginTop: 3, textAlign: "center" },
  footer: { position: "absolute", bottom: 28, left: 36, right: 200, alignItems: "center", gap: 3 },
  footerText: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#4D4D4D" },
  pageNumber: { fontSize: 8, color: muted },
});

export function DonutChart({ score, size = 130 }: { score: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const geometry = buildDonutGeometry([clamped, 100 - clamped], {
    centerX: size / 2,
    centerY: size / 2,
    outerRadius: size / 2 - 8,
    innerRadius: size / 2 - 22,
    gapDeg: 2,
  });

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size / 2} cy={size / 2} r={size / 2 - 15} fill="none" stroke="#E4E9E6" strokeWidth={14} />
      {geometry[0] && <Path d={geometry[0].path} fill={scoreColor(clamped)} />}
    </Svg>
  );
}

export function BarChartSvg({ series, unit }: { series: { label: string; value: number }[]; unit: string }) {
  const width = 500;
  const height = 158;
  const plotX = 40;
  const plotY = 14;
  const plotWidth = width - plotX - 10;
  const plotHeight = height - plotY - 22;
  const values = series.map((point) => Math.max(0, point.value));
  const axisMax = niceAxisMax(Math.max(...values, 0));
  const bars = buildBarGeometry(values, { plotX, plotY, plotWidth, plotHeight, scaleMax: axisMax });
  const labelStep = Math.ceil(series.length / 10);
  const formatValue = (value: number) => (unit === "min" ? formatMinutes(value) : `${Math.round(value)}${unit ? ` ${unit}` : ""}`);

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {[0.5, 1].map((fraction) => (
        <Line
          key={fraction}
          x1={plotX}
          y1={plotY + plotHeight - plotHeight * fraction}
          x2={plotX + plotWidth}
          y2={plotY + plotHeight - plotHeight * fraction}
          stroke="#E4E9E6"
          strokeWidth={1}
          strokeDasharray="4 5"
        />
      ))}
      <Line x1={plotX} y1={plotY + plotHeight} x2={plotX + plotWidth} y2={plotY + plotHeight} stroke="#CBD5D1" strokeWidth={1.2} />
      {[0.5, 1].map((fraction) => (
        <Text
          key={`axis-${fraction}`}
          x={plotX - 5}
          y={plotY + plotHeight - plotHeight * fraction + 3}
          style={{ fontSize: 7 }}
          fill={muted}
          textAnchor="end"
        >
          {unit === "min" ? formatMinutes(axisMax * fraction) : `${Math.round(axisMax * fraction)}`}
        </Text>
      ))}
      {bars.map((bar) => (
        <Rect key={bar.index} x={bar.x} y={bar.y} width={bar.width} height={bar.height} fill={bar.color} opacity={0.92} rx={2} />
      ))}
      {bars.map((bar) => (
        <Text
          key={`value-${bar.index}`}
          x={bar.x + bar.width / 2}
          y={bar.y - 4}
          style={{ fontSize: 7, fontFamily: "Helvetica-Bold" }}
          fill={darkTeal}
          textAnchor="middle"
        >
          {formatValue(series[bar.index].value)}
        </Text>
      ))}
      {bars.map((bar) =>
        bar.index % labelStep === 0 ? (
          <Text
            key={`label-${bar.index}`}
            x={bar.x + bar.width / 2}
            y={plotY + plotHeight + 13}
            style={{ fontSize: 7 }}
            fill={muted}
            textAnchor="middle"
          >
            {series[bar.index].label}
          </Text>
        ) : null
      )}
    </Svg>
  );
}

function PieChartSvg({ segments, unit }: { segments: { label: string; value: number }[]; unit: string }) {
  const size = 120;
  const geometry = buildDonutGeometry(segments.map((segment) => Math.max(0, segment.value)), {
    centerX: size / 2,
    centerY: size / 2,
    outerRadius: size / 2 - 8,
    innerRadius: size / 2 - 22,
  });
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  const palette = ["#0D9488", "#D97706", "#0284C7", "#7C3AED", "#E11D48", "#65A30D"];
  const formatValue = (value: number) => {
    if (unit === "min") return formatMinutes(value);
    if (unit === "%") return `${Math.round(value)}%`;
    return `${Math.round(value)} ${unit}`.trim();
  };

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {geometry.map((segment) => (
          <Path key={segment.index} d={segment.path} fill={palette[segment.index % palette.length]} opacity={0.92} />
        ))}
      </Svg>
      <View style={{ gap: 5 }}>
        {segments.map((segment, index) => (
          <View key={segment.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: palette[index % palette.length] }} />
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>{segment.label}</Text>
            <Text style={{ fontSize: 9, color: muted, marginLeft: 2 }}>
              {formatValue(segment.value)}{total > 0 ? ` · ${Math.round((segment.value / total) * 100)}%` : ""}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function AIAnalysisPDF({ data }: { data: AnalysisPdfData }) {
  const { analysis } = data;
  const captures = analysis.metrics.captures.slice(-4);
  const m = analysis.metrics;

  const kpis = [
    { label: "Adherence", value: `${analysis.adherenceScore}%` },
    { label: "Worked / scheduled", value: m.scheduledMinutes ? `${formatMinutes(m.workedMinutes)} / ${formatMinutes(m.scheduledMinutes)}` : formatMinutes(m.workedMinutes) },
    { label: "Punctuality", value: `${m.punctualityScore}%` },
    { label: "Active engagement", value: `${m.monitoring.activeSamplePercent}%` },
    { label: "Screenshots", value: `${m.monitoring.captureCount}` },
    { label: "Mouse movements", value: m.monitoring.mouseMovements.toLocaleString("en-GB") },
  ];

  const metaItems = [
    { label: "REFERENCE", value: data.reference },
    { label: "SHIFT DATE", value: data.shift.dateLabel },
    { label: "GENERATED", value: data.generatedAtLabel },
    { label: "MODEL", value: data.modelLabel },
  ];

  return (
    <Document title={`AI Shift Analysis ${data.reference}`} author="Advanced Virtual Solutions Ltd">
      <Page size="LETTER" style={styles.page}>
        {/* Brand band on the first page only; later pages start clean. */}
        <View style={styles.topWave} />
        <View style={styles.topMask} />
        <View fixed style={styles.bottomWave} />
        <View fixed style={styles.bottomDarkWave} />
        <View style={styles.content}>
          <View style={styles.logoWrap}>
            {data.logoSrc
              ? <Image src={data.logoSrc} style={styles.logo} />
              : <Text style={styles.logoFallback}>AVS</Text>}
          </View>

          <Text style={styles.reportTitle}>AI SHIFT ANALYSIS</Text>

          <View style={styles.metaGrid}>
            {[0, 2].map((rowStart) => (
              <View key={rowStart} style={styles.metaRow}>
                {metaItems.slice(rowStart, rowStart + 2).map((item, index) => {
                  const isLastRow = rowStart + index >= metaItems.length - 2;
                  return (
                    <View
                      key={item.label}
                      style={isLastRow ? { ...styles.metaItem, marginBottom: 0 } : styles.metaItem}
                    >
                      <Text style={styles.metaLabel}>{item.label}</Text>
                      <Text>{item.value}</Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

          <View style={styles.parties}>
            <View style={styles.party}>
              <Text style={styles.partyHeading}>Analysed worker</Text>
              <Text style={styles.partyName}>{data.worker.name}</Text>
              <Text style={styles.address}>{data.worker.email}{"\n"}Attendance: {data.shift.attendanceLabel}</Text>
            </View>
            <View style={styles.party}>
              <Text style={styles.partyHeading}>Report billed to</Text>
              <Text style={styles.partyName}>{data.hiringManager.organization}</Text>
              <Text style={styles.address}>
                {data.hiringManager.name} ({data.hiringManager.email}){data.hiringManager.address ? `\n${data.hiringManager.address}` : ""}{data.hiringManager.companyNumber ? `\nCompany no. ${data.hiringManager.companyNumber}` : ""}
              </Text>
            </View>
          </View>

          <View wrap={false}>
            <View style={styles.sectionTitle}><Text>PERFORMANCE SCORE</Text></View>
            <View style={styles.scoreSection}>
              <View style={styles.donutWrap}>
                <DonutChart score={analysis.overallScore} />
                <Text style={[styles.donutScore, { color: scoreColor(analysis.overallScore) }]}>{analysis.overallScore}%</Text>
                <Text style={styles.donutCaption}>Overall performance</Text>
              </View>
              <View style={styles.kpiGrid}>
                {kpis.map((kpi) => (
                  <View key={kpi.label} style={styles.kpiTile}>
                    <Text style={styles.kpiValue}>{kpi.value}</Text>
                    <Text style={styles.kpiLabel}>{kpi.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View wrap={false}>
            <View style={styles.sectionTitle}><Text>ACTIVITY VOLUME</Text></View>
            <Text style={styles.chartTitle}>{analysis.charts.bar.title || "Activity volume"}</Text>
            <BarChartSvg series={analysis.charts.bar.series} unit={analysis.charts.bar.unit} />
            <Text style={styles.chartTitle}>{analysis.charts.pie.title || "Shift volume mix"}</Text>
            <PieChartSvg segments={analysis.charts.pie.segments} unit={analysis.charts.pie.unit} />
          </View>

          <View wrap={false}>
            <View style={styles.sectionTitle}><Text>AI NARRATIVE SUMMARY</Text></View>
            <View style={styles.narrativeBlock}>
              <Text style={styles.narrativeHeading}>{analysis.narrative.headline || "Shift summary"}</Text>
              <Text style={styles.narrativeText}>{analysis.narrative.workerSummary}</Text>
            </View>
          </View>
          <View style={styles.narrativeBlock}>
            <Text style={styles.narrativeHeading}>Work done</Text>
            <Text style={styles.narrativeText}>{analysis.narrative.workSummary}</Text>
          </View>

          {analysis.narrative.highlights.length > 0 && (
            <View style={styles.narrativeBlock}>
              <Text style={styles.narrativeHeading}>Highlights</Text>
              {analysis.narrative.highlights.map((highlight) => (
                <View key={highlight} style={styles.findingRow}>
                  <Text style={styles.findingMarker}>+</Text>
                  <Text style={styles.findingText}>{highlight}</Text>
                </View>
              ))}
            </View>
          )}

          {analysis.narrative.concerns.length > 0 && (
            <View style={styles.narrativeBlock}>
              <Text style={styles.narrativeHeading}>Points to watch</Text>
              {analysis.narrative.concerns.map((concern) => (
                <View key={concern} style={styles.findingRow}>
                  <Text style={styles.findingMarkerConcern}>!</Text>
                  <Text style={styles.findingText}>{concern}</Text>
                </View>
              ))}
            </View>
          )}

          {captures.length > 0 && (
            <View style={styles.narrativeBlock} wrap={false}>
              <Text style={styles.narrativeHeading}>Screenshot evidence</Text>
              <View style={styles.captureGrid}>
                {captures.map((capture) => (
                  <View key={capture.captureId} style={styles.captureCard}>
                    {data.captureImages[capture.captureId]
                      ? <Image src={data.captureImages[capture.captureId]} style={styles.captureImage} />
                      : <Text style={styles.captureMissing}>Unavailable</Text>}
                    <Text style={styles.captureTime}>
                      {new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short" }).format(new Date(capture.capturedAt))}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated by ShiftSync · Advanced Virtual Solutions Ltd</Text>
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
