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
//
// The report is deliberately long-form: cover page, executive summary, measured
// behaviour, timeline, section-by-section analysis, charts, coaching plan and
// the screenshot evidence that the analysis was grounded in.

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
  worker: { name: string; email: string };
  shift: { dateLabel: string; attendanceLabel: string; templateLabel: string };
  hiringManager: { name: string; email: string; organization: string; address: string; companyNumber: string };
  analysis: ShiftAnalysis;
  logoSrc?: string;
  captureImages: Record<string, string>;
};

export function buildAnalysisPdfData(input: {
  analysis: ShiftAnalysis;
  worker: { name: string; email: string };
  shiftTemplate?: string;
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
    worker: input.worker,
    shift: {
      dateLabel: dateFormatter.format(new Date(input.analysis.workDate)),
      attendanceLabel: input.analysis.metrics.attendanceStatus.replace(/_/g, " "),
      templateLabel: input.shiftTemplate || "Scheduled shift",
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

/** Capture ids the report will try to embed, in story order. */
export function collectAnalysisCaptureIds(analysis: ShiftAnalysis, limit = 8): string[] {
  const ids: string[] = [];
  for (const block of analysis.screenActivity?.blocks || []) {
    if (block.captureId && !ids.includes(block.captureId)) ids.push(block.captureId);
    if (ids.length >= limit) return ids;
  }
  for (const capture of analysis.metrics.captures || []) {
    if (!ids.includes(capture.captureId)) ids.push(capture.captureId);
    if (ids.length >= limit) return ids;
  }
  return ids;
}

const styles = StyleSheet.create({
  page: { padding: 36, paddingBottom: 104, fontSize: 9.5, fontFamily: "Helvetica", color: black, backgroundColor: "#FFFFFF" },
  // The wave band is page-one only (content on later pages starts at the top).
  topWave: { position: "absolute", top: 28, left: 36, right: 36, height: 54, backgroundColor: teal },
  topMask: { position: "absolute", top: 58, left: 36, right: 36, height: 56, backgroundColor: "#FFFFFF" },
  bottomWave: { position: "absolute", bottom: 28, right: 36, width: 145, height: 64, backgroundColor: teal },
  bottomDarkWave: { position: "absolute", bottom: 28, right: 36, width: 88, height: 64, backgroundColor: darkTeal },
  content: { position: "relative" },
  logoWrap: { alignItems: "center", minHeight: 96, justifyContent: "flex-end", marginBottom: 5 },
  logo: { width: 150, height: 78, objectFit: "contain" },
  logoFallback: { fontSize: 28, fontFamily: "Helvetica-Bold", color: teal },
  reportTitle: { textAlign: "center", fontSize: 20, fontFamily: "Helvetica-Bold", color: teal, marginBottom: 4 },
  reportSubtitle: { textAlign: "center", fontSize: 8.5, color: muted, marginBottom: 10 },
  metaGrid: { backgroundColor: grey, paddingVertical: 7, paddingHorizontal: 12, marginBottom: 8 },
  metaRow: { flexDirection: "row" },
  metaItem: { width: "50%", flexDirection: "row", marginBottom: 3 },
  metaLabel: { fontFamily: "Helvetica-Bold", color: "#555555", marginRight: 5 },
  parties: { flexDirection: "row", marginBottom: 6 },
  party: { width: "50%", paddingHorizontal: 3, minHeight: 78 },
  partyHeading: { fontFamily: "Helvetica-Bold", color: darkTeal, fontSize: 10.5, marginBottom: 5 },
  partyName: { fontSize: 10.5, marginBottom: 3 },
  address: { fontSize: 9, lineHeight: 1.4 },
  sectionTitle: { backgroundColor: teal, color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 9.5, textAlign: "center", paddingVertical: 4.5, marginTop: 12, marginBottom: 6, letterSpacing: 0.4 },
  scoreSection: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 18 },
  donutWrap: { width: 150, alignItems: "center" },
  donutScore: { marginTop: -95, fontSize: 22, fontFamily: "Helvetica-Bold", color: black },
  donutCaption: { fontSize: 7.5, color: muted, marginTop: 76 },
  kpiGrid: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  kpiTile: { width: "32%", backgroundColor: "#F7FAF9", borderRadius: 4, padding: 6, borderWidth: 1, borderColor: line },
  kpiValue: { fontSize: 12.5, fontFamily: "Helvetica-Bold", color: darkTeal },
  kpiLabel: { fontSize: 7.5, color: muted, marginTop: 2 },
  verdictBox: { backgroundColor: "#F7FAF9", borderLeftWidth: 3, borderLeftColor: teal, padding: 9, marginTop: 2 },
  verdictLabel: { fontFamily: "Helvetica-Bold", fontSize: 8, color: darkTeal, marginBottom: 3, letterSpacing: 0.5 },
  verdictText: { fontSize: 9.5, lineHeight: 1.45 },
  paragraph: { fontSize: 9.5, lineHeight: 1.5, marginBottom: 6, textAlign: "justify" },
  subHeading: { fontFamily: "Helvetica-Bold", fontSize: 9.5, color: darkTeal, marginTop: 4, marginBottom: 3 },
  chartTitle: { fontFamily: "Helvetica-Bold", fontSize: 9.5, color: darkTeal, marginTop: 8, marginBottom: 4 },
  tableHeader: { flexDirection: "row", backgroundColor: teal, color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 8.5, paddingVertical: 4.5, marginTop: 8 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: line, paddingVertical: 4 },
  cell: { fontSize: 8.5, paddingHorizontal: 4 },
  cellBold: { fontFamily: "Helvetica-Bold" },
  colTime: { width: "18%" },
  colTitle: { width: "28%" },
  colDetail: { width: "54%" },
  findingRow: { flexDirection: "row", marginBottom: 3, gap: 5, paddingRight: 12 },
  findingMarker: { fontFamily: "Helvetica-Bold", color: teal, fontSize: 9.5 },
  findingMarkerConcern: { fontFamily: "Helvetica-Bold", color: "#C2410C", fontSize: 9.5 },
  findingText: { flex: 1, fontSize: 9.2, lineHeight: 1.4 },
  recommendation: { borderWidth: 1, borderColor: line, borderRadius: 4, padding: 7, marginBottom: 5 },
  recommendationHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  recommendationTitle: { fontFamily: "Helvetica-Bold", fontSize: 9.2, color: black, flex: 1, paddingRight: 6 },
  priorityChip: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#FFFFFF", backgroundColor: teal, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  priorityHigh: { backgroundColor: "#E11D48" },
  priorityLow: { backgroundColor: "#0F766E" },
  recommendationText: { fontSize: 9, lineHeight: 1.4, color: "#333333" },
  captureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  captureCard: { width: "32%", borderRadius: 4, borderWidth: 1, borderColor: line, padding: 5, marginBottom: 6 },
  captureImage: { width: "100%", height: 118, borderRadius: 2 },
  captureMissing: { width: "100%", height: 118, backgroundColor: grey, fontSize: 7.5, color: muted, textAlign: "center", paddingTop: 52 },
  captureHeader: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  captureTime: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: darkTeal },
  captureActivity: { fontSize: 7, color: muted, textTransform: "capitalize" },
  captureNote: { fontSize: 7.6, lineHeight: 1.35, color: "#333333", marginTop: 2 },
  captureApps: { fontSize: 7, color: muted, marginTop: 2 },
  footer: { position: "absolute", bottom: 28, left: 36, right: 200, alignItems: "center", gap: 3 },
  footerText: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#4D4D4D" },
  pageNumber: { fontSize: 8, color: muted },
  confidence: { fontSize: 7, color: muted },
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
  const labelStep = Math.ceil(series.length / 10) || 1;
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

export function PieChartSvg({ segments, unit }: { segments: { label: string; value: number }[]; unit: string }) {
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

export function Paragraphs({ value }: { value?: string }) {
  if (!value) return null;
  const paragraphs = value.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  return (
    <>
      {(paragraphs.length ? paragraphs : [value]).map((paragraph, index) => (
        <Text key={index} style={styles.paragraph}>{paragraph}</Text>
      ))}
    </>
  );
}

const clockFormatter = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
const timeLabel = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "--:--" : clockFormatter.format(date);
};

function SectionHeading({ children }: { children: string }) {
  return (
    <View wrap={false} minPresenceAhead={80}>
      <View style={styles.sectionTitle}><Text>{children}</Text></View>
    </View>
  );
}

const activityLabel = (value: string) => (value ? value.replace(/_/g, " ") : "unknown");

export function AIAnalysisPDF({ data }: { data: AnalysisPdfData }) {
  const { analysis } = data;
  const narrative = analysis.narrative;
  const sections = narrative.sections || {};
  const derived = analysis.derived;
  const m = analysis.metrics;
  const blocks = (analysis.screenActivity?.blocks || []).slice(0, 6);
  const timeline = analysis.timeline || [];
  const recommendations = analysis.recommendations || [];

  const kpis = [
    { label: "Adherence", value: `${analysis.adherenceScore}%` },
    { label: "Worked / scheduled", value: m.scheduledMinutes ? `${formatMinutes(m.workedMinutes)} / ${formatMinutes(m.scheduledMinutes)}` : formatMinutes(m.workedMinutes) },
    { label: "Punctuality", value: `${m.punctualityScore}%` },
    { label: "Active engagement", value: `${m.monitoring.activeSamplePercent}%` },
    { label: "Screenshots", value: `${m.monitoring.captureCount}` },
    { label: "Mouse movements", value: m.monitoring.mouseMovements.toLocaleString("en-GB") },
  ];

  const measured = [
    ["Time utilisation", derived ? `${derived.timeUtilisationPercent}%` : `${m.scheduledMinutes ? Math.round((m.workedMinutes / m.scheduledMinutes) * 100) : 0}%`],
    ["Break share of schedule", derived ? `${derived.breakSharePercent}%` : `${m.breakMinutes}m`],
    ["Overtime", formatMinutes(m.overtimeMinutes)],
    ["Lateness", `${m.lateMinutes} min`],
    ["Tracked minutes", derived ? `${derived.trackedMinutes}` : `${m.monitoring.mouseSampleCount}`],
    ["Active minutes", derived ? `${derived.activeMinutes}` : "—"],
    ["Active vs worked time", derived ? `${derived.activeToWorkedPercent}%` : "—"],
    ["Peak activity hour", derived?.peakHour || "—"],
    ["Longest inactive gap", derived ? (derived.longestGapMinutes ? `${formatMinutes(derived.longestGapMinutes)} (${derived.longestGapWindow})` : "none recorded") : "—"],
    ["Narrated screen windows", derived ? `${derived.screenBlocks}` : `${blocks.length}`],
    ["Windows read as focused", derived ? `${derived.focusedBlocks}` : "—"],
    ["Top applications", derived?.topApps?.length ? derived.topApps.slice(0, 4).join(", ") : "—"],
  ];

  const metaItems = [
    { label: "REFERENCE", value: data.reference },
    { label: "SHIFT DATE", value: data.shift.dateLabel },
    { label: "GENERATED", value: data.generatedAtLabel },
    { label: "ATTENDANCE", value: activityLabel(data.shift.attendanceLabel) },
  ];

  const captureItems = [
    ...blocks
      .filter((block) => block.captureId)
      .map((block) => ({
        id: block.captureId as string,
        time: block.capturedAt || block.startedAt,
        window: `${timeLabel(block.startedAt)}–${timeLabel(block.endedAt)}`,
        summary: block.summary,
        activity: block.activity,
        apps: block.apps,
        confidence: block.confidence,
      })),
    ...m.captures
      .filter((capture) => !blocks.some((block) => block.captureId === capture.captureId))
      .map((capture) => ({
        id: capture.captureId,
        time: capture.capturedAt,
        window: "",
        summary: "",
        activity: "",
        apps: [] as string[],
        confidence: 0,
      })),
  ].slice(0, 6);

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
          <Text style={styles.reportSubtitle}>{data.shift.templateLabel} · prepared for {data.hiringManager.organization}</Text>

          <View style={styles.metaGrid}>
            {[0, 2].map((rowStart) => (
              <View key={rowStart} style={[styles.metaRow, rowStart === 2 ? { marginBottom: 0 } : {}]}>
                {metaItems.slice(rowStart, rowStart + 2).map((item) => (
                  <View key={item.label} style={styles.metaItem}>
                    <Text style={styles.metaLabel}>{item.label}</Text>
                    <Text>{item.value}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>

          <View style={styles.parties}>
            <View style={styles.party}>
              <Text style={styles.partyHeading}>Analysed worker</Text>
              <Text style={styles.partyName}>{data.worker.name}</Text>
              <Text style={styles.address}>{data.worker.email}{"\n"}Attendance: {activityLabel(data.shift.attendanceLabel)}{"\n"}Shift: {data.shift.dateLabel}</Text>
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

          <View style={styles.verdictBox}>
            <Text style={styles.verdictLabel}>ANALYST VERDICT</Text>
            <Text style={styles.verdictText}>{narrative.verdict || narrative.headline}</Text>
          </View>

          <SectionHeading>EXECUTIVE SUMMARY</SectionHeading>
          <Paragraphs value={narrative.executiveSummary || narrative.workerSummary} />

          <SectionHeading>MEASURED BEHAVIOUR</SectionHeading>
          <View style={styles.tableHeader}>
            <Text style={[styles.cell, { width: "34%", fontFamily: "Helvetica-Bold" }]}>Measure</Text>
            <Text style={[styles.cell, { width: "66%", fontFamily: "Helvetica-Bold" }]}>Value</Text>
          </View>
          {measured.map(([label, value], index) => (
            <View key={label} style={[styles.tableRow, index % 2 === 1 ? { backgroundColor: "#F7FAF9" } : {}]}>
              <Text style={[styles.cell, { width: "34%" }]}>{label}</Text>
              <Text style={[styles.cell, { width: "66%" }, styles.cellBold]}>{value}</Text>
            </View>
          ))}

          {timeline.length > 0 && (
            <>
              <SectionHeading>SHIFT TIMELINE</SectionHeading>
              <View style={styles.tableHeader}>
                <Text style={[styles.cell, styles.colTime]}>Time</Text>
                <Text style={[styles.cell, styles.colTitle]}>Milestone</Text>
                <Text style={[styles.cell, styles.colDetail]}>What happened</Text>
              </View>
              {timeline.map((entry, index) => (
                <View key={`${entry.time}-${index}`} style={[styles.tableRow, index % 2 === 1 ? { backgroundColor: "#F7FAF9" } : {}]}>
                  <Text style={[styles.cell, styles.colTime]}>{entry.time}</Text>
                  <Text style={[styles.cell, styles.colTitle, styles.cellBold]}>{entry.title}</Text>
                  <Text style={[styles.cell, styles.colDetail]}>{entry.detail}</Text>
                </View>
              ))}
            </>
          )}

          {sections.attendance ? (
            <>
              <SectionHeading>ATTENDANCE &amp; PUNCTUALITY</SectionHeading>
              <Paragraphs value={sections.attendance} />
            </>
          ) : null}

          {sections.time ? (
            <>
              <SectionHeading>TIME &amp; SCHEDULE ADHERENCE</SectionHeading>
              <Paragraphs value={sections.time} />
            </>
          ) : null}

          {sections.productivity ? (
            <>
              <SectionHeading>PRODUCTIVITY &amp; ENGAGEMENT</SectionHeading>
              <Paragraphs value={sections.productivity} />
            </>
          ) : null}

          <SectionHeading>WHAT THE SCREENSHOTS SHOW</SectionHeading>
          <Paragraphs value={sections.screen || narrative.workSummary} />

          <View wrap={false}>
            <SectionHeading>ACTIVITY VOLUME</SectionHeading>
            <Text style={styles.chartTitle}>{analysis.charts.bar.title || "Activity volume"}</Text>
            <BarChartSvg series={analysis.charts.bar.series} unit={analysis.charts.bar.unit} />
            <Text style={styles.chartTitle}>{analysis.charts.pie.title || "Shift volume mix"}</Text>
            <PieChartSvg segments={analysis.charts.pie.segments} unit={analysis.charts.pie.unit} />
          </View>

          {sections.risk ? (
            <>
              <SectionHeading>RISKS &amp; COMPLIANCE</SectionHeading>
              <Paragraphs value={sections.risk} />
            </>
          ) : null}

          {(narrative.highlights.length > 0 || narrative.concerns.length > 0) && (
            <View style={styles.parties}>
              <View style={{ width: "50%", paddingRight: 8 }}>
                <Text style={styles.subHeading}>Highlights</Text>
                {narrative.highlights.map((highlight) => (
                  <View key={highlight} style={styles.findingRow}>
                    <Text style={styles.findingMarker}>+</Text>
                    <Text style={styles.findingText}>{highlight}</Text>
                  </View>
                ))}
              </View>
              <View style={{ width: "50%", paddingLeft: 8 }}>
                <Text style={styles.subHeading}>Points to watch</Text>
                {narrative.concerns.length ? narrative.concerns.map((concern) => (
                  <View key={concern} style={styles.findingRow}>
                    <Text style={styles.findingMarkerConcern}>!</Text>
                    <Text style={styles.findingText}>{concern}</Text>
                  </View>
                )) : <Text style={styles.findingText}>No material concerns were recorded.</Text>}
              </View>
            </View>
          )}

          {sections.coaching ? (
            <>
              <SectionHeading>COACHING PLAN</SectionHeading>
              <Paragraphs value={sections.coaching} />
            </>
          ) : null}
          {recommendations.length > 0 && (
            <View style={{ marginTop: 4 }}>
              {recommendations.map((recommendation, index) => (
                <View key={`${recommendation.title}-${index}`} style={styles.recommendation} wrap={false}>
                  <View style={styles.recommendationHead}>
                    <Text style={styles.recommendationTitle}>{recommendation.title}</Text>
                    <Text style={[styles.priorityChip, recommendation.priority === "high" ? styles.priorityHigh : recommendation.priority === "low" ? styles.priorityLow : {}]}>
                      {recommendation.priority.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.recommendationText}>{recommendation.detail}</Text>
                </View>
              ))}
            </View>
          )}

          {sections.outlook ? (
            <>
              <SectionHeading>OUTLOOK</SectionHeading>
              <Paragraphs value={sections.outlook} />
            </>
          ) : null}

          {captureItems.length > 0 && (
            <>
              <SectionHeading>SCREENSHOT EVIDENCE</SectionHeading>
              <Text style={styles.captureNote}>
                Periodic captures aligned to the narrated windows above. Images are stored securely and are reproduced here only for the named hiring manager.
              </Text>
              <View style={styles.captureGrid}>
                {captureItems.map((item) => (
                  <View key={item.id} style={styles.captureCard} wrap={false}>
                    {data.captureImages[item.id]
                      ? <Image src={data.captureImages[item.id]} style={styles.captureImage} />
                      : <Text style={styles.captureMissing}>Screenshot unavailable</Text>}
                    <View style={styles.captureHeader}>
                      <Text style={styles.captureTime}>
                        {new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.time))}
                      </Text>
                      {item.activity ? <Text style={styles.captureActivity}>{item.activity}</Text> : null}
                    </View>
                    {item.summary ? <Text style={styles.captureNote}>{item.summary.slice(0, 170)}{item.summary.length > 170 ? "…" : ""}</Text> : null}
                    {item.apps.length ? <Text style={styles.captureApps}>{item.apps.slice(0, 3).join(" · ")}</Text> : null}
                  </View>
                ))}
              </View>
            </>
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
