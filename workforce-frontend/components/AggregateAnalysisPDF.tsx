import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { BarChartSvg, DonutChart, Paragraphs } from "@/components/AIAnalysisPDF";
import { formatMinutes } from "@/lib/charts";
import type { AggregateAnalysis, AggregateWorkerRow } from "@/types/workforce";

// Branded PDF export for the aggregate period report — the longest artefact the
// product produces. It is designed for a hiring manager to read end to end:
// cover, executive summary, period analytics, per-worker profiles, the
// chronological screenshot story, the evidence itself, risks and
// recommendations.

const teal = "#1A9797";
const darkTeal = "#006F7F";
const black = "#111111";
const grey = "#F1F1F1";
const line = "#DFE5E2";
const muted = "#5B6B66";

const scoreColor = (score: number) => (score >= 80 ? "#0D9488" : score >= 60 ? "#D97706" : "#E11D48");

export type AggregatePdfData = {
  reference: string;
  generatedAtLabel: string;
  periodLabel: string;
  coverageLabel: string;
  worker?: { name: string; email: string } | null;
  hiringManager: { name: string; email: string; organization: string; address: string; companyNumber: string };
  aggregate: AggregateAnalysis;
  logoSrc?: string;
  captureImages: Record<string, string>;
};

export function buildAggregatePdfData(input: {
  aggregate: AggregateAnalysis;
  worker?: { name: string; email: string } | null;
  hiringManager: import("@/types/workforce").User;
  logoSrc?: string;
  captureImages: Record<string, string>;
}): AggregatePdfData {
  const generatedAt = new Date();
  const { aggregate } = input;

  return {
    reference: `AVS-AIP-${generatedAt.toISOString().slice(0, 10).replace(/-/g, "")}-${aggregate.endDate.replace(/-/g, "").slice(2)}`,
    generatedAtLabel: new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(generatedAt),
    periodLabel: `${aggregate.startDate} to ${aggregate.endDate}`,
    coverageLabel: `${aggregate.totals.analyses} analysed shift${aggregate.totals.analyses === 1 ? "" : "s"} · ${aggregate.totals.workers} worker${aggregate.totals.workers === 1 ? "" : "s"}`,
    worker: input.worker || null,
    hiringManager: {
      name: input.hiringManager.name,
      email: input.hiringManager.email,
      organization: input.hiringManager.organizationName || input.hiringManager.name,
      address: input.hiringManager.organizationAddress || "",
      companyNumber: input.hiringManager.companyNumber || "",
    },
    aggregate,
    logoSrc: input.logoSrc,
    captureImages: input.captureImages,
  };
}

/** Capture ids the report embeds, in story order. */
export function collectAggregateCaptureIds(aggregate: AggregateAnalysis, limit = 12): string[] {
  const ids: string[] = [];
  for (const capture of aggregate.captures || []) {
    if (capture.captureId && !ids.includes(capture.captureId)) ids.push(capture.captureId);
    if (ids.length >= limit) return ids;
  }
  return ids;
}

const clockFormatter = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
const dayFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });

const clockLabel = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "--:--" : clockFormatter.format(date);
};
const shortDate = (key: string) => {
  const date = new Date(`${key}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? key : dayFormatter.format(date);
};

const activityLabel = (value: string) => (value ? value.replace(/_/g, " ") : "unknown");
const closureLabel = (value: string) =>
  value === "auto_closed" ? "Auto-closed" : value === "missed_shift" ? "Missed" : "Clock-out";

const styles = StyleSheet.create({
  page: { padding: 36, paddingBottom: 104, fontSize: 9.5, fontFamily: "Helvetica", color: black, backgroundColor: "#FFFFFF" },
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
  subHeading: { fontFamily: "Helvetica-Bold", fontSize: 9.5, color: darkTeal, marginTop: 6, marginBottom: 3 },
  chartTitle: { fontFamily: "Helvetica-Bold", fontSize: 9.2, color: darkTeal, marginTop: 8, marginBottom: 3 },
  tableHeader: { flexDirection: "row", backgroundColor: teal, color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 8.5, paddingVertical: 4.5, marginTop: 8 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: line, paddingVertical: 4 },
  cell: { fontSize: 8.5, paddingHorizontal: 4 },
  cellBold: { fontFamily: "Helvetica-Bold" },
  colWorker: { width: "28%" },
  colNumber: { width: "12%", textAlign: "center" },
  colWide: { width: "24%", textAlign: "center" },
  workerCard: { borderWidth: 1, borderColor: line, borderRadius: 4, padding: 9, marginBottom: 9 },
  workerHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  workerName: { fontFamily: "Helvetica-Bold", fontSize: 11, color: black },
  workerRange: { fontSize: 7.8, color: muted },
  workerKpis: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginBottom: 5 },
  workerKpi: { backgroundColor: "#F7FAF9", borderRadius: 3, paddingVertical: 3, paddingHorizontal: 6, borderWidth: 1, borderColor: line },
  workerKpiValue: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: darkTeal },
  workerKpiLabel: { fontSize: 6.8, color: muted },
  workerText: { fontSize: 9, lineHeight: 1.45, marginBottom: 3 },
  workerLabel: { fontFamily: "Helvetica-Bold", fontSize: 8.2, color: darkTeal, marginTop: 3, marginBottom: 1 },
  findingRow: { flexDirection: "row", marginBottom: 2, gap: 5, paddingRight: 10 },
  findingMarker: { fontFamily: "Helvetica-Bold", color: teal, fontSize: 9 },
  findingMarkerConcern: { fontFamily: "Helvetica-Bold", color: "#C2410C", fontSize: 9 },
  findingText: { flex: 1, fontSize: 8.8, lineHeight: 1.4 },
  storyCard: { borderLeftWidth: 2, borderLeftColor: teal, paddingLeft: 8, marginBottom: 8 },
  storyHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  storyWhen: { fontFamily: "Helvetica-Bold", fontSize: 8.6, color: darkTeal },
  storyWorker: { fontSize: 7.8, color: muted },
  storyText: { fontSize: 8.8, lineHeight: 1.42 },
  storyApps: { fontSize: 7.4, color: muted, marginTop: 2 },
  captureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  captureCard: { width: "48%", borderRadius: 4, borderWidth: 1, borderColor: line, padding: 5, marginBottom: 6 },
  captureImage: { width: "100%", height: 158, borderRadius: 2 },
  captureMissing: { width: "100%", height: 158, backgroundColor: grey, fontSize: 7.5, color: muted, textAlign: "center", paddingTop: 72 },
  captureHeader: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  captureTime: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: darkTeal },
  captureWorker: { fontSize: 7, color: muted },
  captureNote: { fontSize: 7.5, lineHeight: 1.35, color: "#333333", marginTop: 2 },
  recommendation: { borderWidth: 1, borderColor: line, borderRadius: 4, padding: 7, marginBottom: 5 },
  recommendationHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  recommendationTitle: { fontFamily: "Helvetica-Bold", fontSize: 9.2, color: black, flex: 1, paddingRight: 6 },
  priorityChip: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#FFFFFF", backgroundColor: teal, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  priorityHigh: { backgroundColor: "#E11D48" },
  priorityLow: { backgroundColor: "#0F766E" },
  recommendationText: { fontSize: 9, lineHeight: 1.4, color: "#333333" },
  footer: { position: "absolute", bottom: 28, left: 36, right: 200, alignItems: "center", gap: 3 },
  footerText: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#4D4D4D" },
  pageNumber: { fontSize: 8, color: muted },
  note: { fontSize: 8, color: muted, lineHeight: 1.4, marginTop: 4 },
  contentsBox: { marginTop: 14, padding: 10, borderWidth: 1, borderColor: line, borderRadius: 4, backgroundColor: "#FBFDFC" },
  contentsTitle: { fontFamily: "Helvetica-Bold", fontSize: 8.5, letterSpacing: 0.6, color: darkTeal, marginBottom: 5 },
  contentsGrid: { flexDirection: "row", flexWrap: "wrap" },
  contentsItem: { width: "33.33%", flexDirection: "row", gap: 5, marginBottom: 3, paddingRight: 8 },
  contentsIndex: { fontFamily: "Helvetica-Bold", fontSize: 7.8, color: teal, width: 11 },
  contentsText: { fontSize: 8.2, color: "#333333", flex: 1 },
});

function SectionHeading({ children }: { children: string }) {
  return (
    <View wrap={false} minPresenceAhead={80}>
      <View style={styles.sectionTitle}><Text>{children}</Text></View>
    </View>
  );
}

const priorityStyle = (priority: string) =>
  priority === "high" ? styles.priorityHigh : priority === "low" ? styles.priorityLow : {};

export function AggregateAnalysisPDF({ data }: { data: AggregatePdfData }) {
  const { aggregate } = data;
  const t = aggregate.totals;
  const period = aggregate.period;
  const narrativeDoc = aggregate.narrative;
  const narrative = narrativeDoc?.narrative;
  const sections = narrative?.sections || {};
  const workerNotes = narrative?.workerNotes || [];
  const story = aggregate.story || [];
  const captures = aggregate.captures || [];
  const rows = aggregate.rows || [];
  const shifts = aggregate.shifts || [];
  const derivedRecommendations = sections.recommendations || "";

  const kpis = [
    { label: "Workers", value: `${t.workers}` },
    { label: "Shifts analysed", value: `${t.analyses}` },
    { label: "Worked time", value: formatMinutes(t.workedMinutes) },
    { label: "Avg adherence", value: `${t.averageAdherence}%` },
    { label: "Absent shifts", value: `${t.absentCount}` },
    { label: "Avg shift score", value: t.analyses ? `${Math.round(t.averageScore)}%` : "—" },
  ];

  const metaItems = [
    { label: "REFERENCE", value: data.reference },
    { label: "PERIOD", value: data.periodLabel },
    { label: "GENERATED", value: data.generatedAtLabel },
    { label: "COVERAGE", value: data.coverageLabel },
  ];

  const attendanceRows = [
    { label: "On time", value: period.attendance.onTime },
    { label: "Late", value: period.attendance.late },
    { label: "Very late", value: period.attendance.veryLate },
    { label: "Absent", value: period.attendance.absent },
    { label: "Overtime", value: period.attendance.overtime },
  ];

  const weeklySeries = period.weeklyTrend.map((week) => ({
    label: shortDate(week.label),
    value: week.averageScore,
  }));

  const hourlySeries = period.hourlyActivity.map((bucket) => ({
    label: bucket.hour,
    value: bucket.activeMinutes,
  }));

  const workerNoteFor = (row: AggregateWorkerRow) =>
    workerNotes.find((note) => note.name.trim().toLowerCase() === row.name.trim().toLowerCase()) ||
    workerNotes.find((note) => note.name.includes(row.name.split(" ")[0])) ||
    null;

  const storyBeats = story.slice(0, 30);

  return (
    <Document title={`AI Period Analysis ${data.reference}`} author="Advanced Virtual Solutions Ltd">
      <Page size="LETTER" style={styles.page}>
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

          <Text style={styles.reportTitle}>AI PERIOD ANALYSIS</Text>
          <Text style={styles.reportSubtitle}>
            Detailed performance report for {data.hiringManager.organization} · {data.periodLabel}
          </Text>

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
            {data.worker ? (
              <View style={styles.party}>
                <Text style={styles.partyHeading}>Analysed worker</Text>
                <Text style={styles.partyName}>{data.worker.name}</Text>
                <Text style={styles.address}>
                  {data.worker.email}{"\n"}{t.analyses} concluded shift{t.analyses === 1 ? "" : "s"} analysed{"\n"}Period: {data.periodLabel}
                </Text>
              </View>
            ) : (
              <View style={styles.party}>
                <Text style={styles.partyHeading}>Analysis scope</Text>
                <Text style={styles.partyName}>{t.workers} worker{t.workers === 1 ? "" : "s"}</Text>
                <Text style={styles.address}>
                  {t.analyses} concluded shift{t.analyses === 1 ? "" : "s"} analysed{"\n"}Period: {data.periodLabel}
                </Text>
              </View>
            )}
            <View style={styles.party}>
              <Text style={styles.partyHeading}>Report prepared for</Text>
              <Text style={styles.partyName}>{data.hiringManager.organization}</Text>
              <Text style={styles.address}>
                {data.hiringManager.name} ({data.hiringManager.email}){data.hiringManager.address ? `\n${data.hiringManager.address}` : ""}{data.hiringManager.companyNumber ? `\nCompany no. ${data.hiringManager.companyNumber}` : ""}
              </Text>
            </View>
          </View>

          <View wrap={false}>
            <View style={styles.sectionTitle}><Text>PERFORMANCE SUMMARY</Text></View>
            <View style={styles.scoreSection}>
              <View style={styles.donutWrap}>
                <DonutChart score={t.averageScore} />
                <Text style={[styles.donutScore, { color: scoreColor(t.averageScore) }]}>{t.averageScore}%</Text>
                <Text style={styles.donutCaption}>Average performance</Text>
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
            <Text style={styles.verdictText}>
              {narrative?.verdict || narrative?.headline || "No narrative has been generated for this period yet."}
            </Text>
          </View>

          <View style={styles.contentsBox} wrap={false}>
            <Text style={styles.contentsTitle}>WHAT IS IN THIS REPORT</Text>
            <View style={styles.contentsGrid}>
              {[
                "Executive summary",
                "Period at a glance",
                "Performance across the period",
                "Individual worker profiles",
                "The working story from the screenshots",
                "Screenshot evidence",
                "Working patterns & productivity signals",
                "Risks, recommendations & outlook",
                "Shift log",
              ].map((item, index) => (
                <View key={item} style={styles.contentsItem}>
                  <Text style={styles.contentsIndex}>{String(index + 1).padStart(2, "0")}</Text>
                  <Text style={styles.contentsText}>{item}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.note}>
              Grounded in recorded telemetry and the per-window narration of periodic screenshots.
            </Text>
          </View>

          <SectionHeading>EXECUTIVE SUMMARY</SectionHeading>
          <Paragraphs value={narrative?.executiveSummary || narrative?.summary} />
          {(narrative?.executiveSummary || narrative?.summary) ? null : (
            <Text style={styles.note}>
              Use “Generate period summary” on the AI Analysis page to write this report. It is saved for the period and reused until it is regenerated.
            </Text>
          )}

          <View wrap={false}>
            <SectionHeading>PERIOD AT A GLANCE</SectionHeading>
            <View style={styles.parties}>
              <View style={{ width: "50%", paddingRight: 8 }}>
                <Text style={styles.subHeading}>Attendance &amp; time</Text>
                <View style={styles.tableHeader}>
                  <Text style={[styles.cell, { width: "60%", fontFamily: "Helvetica-Bold" }]}>Status</Text>
                  <Text style={[styles.cell, { width: "40%", textAlign: "right", fontFamily: "Helvetica-Bold" }]}>Shifts</Text>
                </View>
                {attendanceRows.map((row, index) => (
                  <View key={row.label} style={[styles.tableRow, index % 2 === 1 ? { backgroundColor: "#F7FAF9" } : {}]}>
                    <Text style={[styles.cell, { width: "60%" }]}>{row.label}</Text>
                    <Text style={[styles.cell, { width: "40%", textAlign: "right" }, styles.cellBold]}>{row.value}</Text>
                  </View>
                ))}
                <Text style={styles.note}>
                  Utilisation {period.utilisationPercent}% · presence {period.presencePercent}% ·{" "}
                  {period.recordedDays} working day{period.recordedDays === 1 ? "" : "s"} recorded across {period.dayCount} calendar days.
                </Text>
              </View>
              <View style={{ width: "50%", paddingLeft: 8 }}>
                <Text style={styles.subHeading}>Most used applications</Text>
                {period.topApps.length ? (
                  period.topApps.slice(0, 7).map((app) => (
                    <View key={app.name} style={styles.findingRow}>
                      <Text style={styles.findingMarker}>·</Text>
                      <Text style={styles.findingText}>{app.name} — {app.count} window{app.count === 1 ? "" : "s"}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.findingText}>No screen narration was available to identify applications.</Text>
                )}
                <Text style={styles.subHeading}>Screen evidence</Text>
                <Text style={styles.findingText}>
                  {period.screen.screenshots} screenshot{period.screen.screenshots === 1 ? "" : "s"} stored ·{" "}
                  {period.screen.narratedShifts} shift{period.screen.narratedShifts === 1 ? "" : "s"} narrated ·{" "}
                  {period.screen.blocks} window{period.screen.blocks === 1 ? "" : "s"} described.
                </Text>
              </View>
            </View>
          </View>
          {weeklySeries.length > 0 && (
            <View wrap={false} style={{ marginTop: 6 }}>
              <Text style={styles.chartTitle}>Average score by week</Text>
              <BarChartSvg series={weeklySeries} unit="%" />
            </View>
          )}
          <SectionHeading>PERFORMANCE ACROSS THE PERIOD</SectionHeading>
          <Paragraphs value={sections.performance || narrative?.summary} />

          {rows.length > 0 && (
            <View wrap={false}>
              <SectionHeading>WORKER SCORES</SectionHeading>
              <Text style={styles.chartTitle}>Average performance score per worker</Text>
              <BarChartSvg
                series={rows.map((row) => ({ label: row.name.split(" ")[0], value: row.averageScore }))}
                unit="%"
              />
              <View style={styles.tableHeader}>
                <Text style={[styles.cell, styles.colWorker, { fontFamily: "Helvetica-Bold" }]}>Worker</Text>
                <Text style={[styles.cell, styles.colNumber, { fontFamily: "Helvetica-Bold" }]}>Shifts</Text>
                <Text style={[styles.cell, styles.colNumber, { fontFamily: "Helvetica-Bold" }]}>Absent</Text>
                <Text style={[styles.cell, styles.colNumber, { fontFamily: "Helvetica-Bold" }]}>Avg score</Text>
                <Text style={[styles.cell, styles.colNumber, { fontFamily: "Helvetica-Bold" }]}>Adherence</Text>
                <Text style={[styles.cell, styles.colWide, { fontFamily: "Helvetica-Bold" }]}>Worked</Text>
              </View>
              {rows.map((row, index) => (
                <View key={row.userId} style={[styles.tableRow, index % 2 === 1 ? { backgroundColor: "#F7FAF9" } : {}]}>
                  <Text style={[styles.cell, styles.colWorker, styles.cellBold]}>{row.name}</Text>
                  <Text style={[styles.cell, styles.colNumber]}>{row.shiftCount}</Text>
                  <Text style={[styles.cell, styles.colNumber]}>{row.absentCount}</Text>
                  <Text style={[styles.cell, styles.colNumber]}>{row.averageScore}%</Text>
                  <Text style={[styles.cell, styles.colNumber]}>{row.averageAdherence}%</Text>
                  <Text style={[styles.cell, styles.colWide]}>{formatMinutes(row.workedMinutes)}</Text>
                </View>
              ))}
            </View>
          )}

          <SectionHeading>INDIVIDUAL WORKER PROFILES</SectionHeading>
          <Text style={styles.note}>
            Each profile summarises the worker's period: the numbers, what the screenshots recorded, and the recommended next step.
          </Text>
          {rows.map((row) => {
            const note = workerNoteFor(row);
            return (
              <View key={row.userId} style={styles.workerCard} wrap={false}>
                <View style={styles.workerHead}>
                  <Text style={styles.workerName}>{row.name}</Text>
                  <Text style={styles.workerRange}>{shortDate(row.firstDate)} – {shortDate(row.lastDate)}</Text>
                </View>
                <View style={styles.workerKpis}>
                  <View style={styles.workerKpi}><Text style={styles.workerKpiValue}>{row.averageScore}%</Text><Text style={styles.workerKpiLabel}>Avg score</Text></View>
                  <View style={styles.workerKpi}><Text style={styles.workerKpiValue}>{row.averageAdherence}%</Text><Text style={styles.workerKpiLabel}>Adherence</Text></View>
                  <View style={styles.workerKpi}><Text style={styles.workerKpiValue}>{row.shiftCount}</Text><Text style={styles.workerKpiLabel}>Shifts</Text></View>
                  <View style={styles.workerKpi}><Text style={styles.workerKpiValue}>{row.absentCount}</Text><Text style={styles.workerKpiLabel}>Absent</Text></View>
                  <View style={styles.workerKpi}><Text style={styles.workerKpiValue}>{formatMinutes(row.workedMinutes)}</Text><Text style={styles.workerKpiLabel}>Worked</Text></View>
                  <View style={styles.workerKpi}><Text style={styles.workerKpiValue}>{row.screenBlocks}</Text><Text style={styles.workerKpiLabel}>Screen windows</Text></View>
                </View>
                <Text style={styles.workerText}>
                  {note?.summary || `${row.name} averaged ${row.averageScore}% across ${row.shiftCount} analysed shift(s), with ${formatMinutes(row.workedMinutes)} of recorded work.`}
                </Text>
                {note?.strengths?.length ? (
                  <View>
                    <Text style={styles.workerLabel}>Strengths</Text>
                    {note.strengths.map((strength) => (
                      <View key={strength} style={styles.findingRow}>
                        <Text style={styles.findingMarker}>+</Text>
                        <Text style={styles.findingText}>{strength}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {note?.watchouts?.length ? (
                  <View>
                    <Text style={styles.workerLabel}>Watchouts</Text>
                    {note.watchouts.map((watchout) => (
                      <View key={watchout} style={styles.findingRow}>
                        <Text style={styles.findingMarkerConcern}>!</Text>
                        <Text style={styles.findingText}>{watchout}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {note?.recommendation ? (
                  <View>
                    <Text style={styles.workerLabel}>Next step</Text>
                    <Text style={styles.workerText}>{note.recommendation}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}

          {sections.attendance ? (
            <>
              <SectionHeading>ATTENDANCE, PUNCTUALITY &amp; TIME</SectionHeading>
              <Paragraphs value={sections.attendance} />
            </>
          ) : null}

          <SectionHeading>THE WORKING STORY: WHAT THE SCREENSHOTS RECORDED</SectionHeading>
          <Paragraphs value={sections.screenStory} />
          {storyBeats.length ? (
            <View style={{ marginTop: 4 }}>
              {storyBeats.map((beat, index) => (
                <View key={`${beat.shiftId}-${beat.at}-${index}`} style={styles.storyCard} wrap={false}>
                  <View style={styles.storyHead}>
                    <Text style={styles.storyWhen}>
                      {beat.date} · {beat.label || clockLabel(beat.at)}
                    </Text>
                    <Text style={styles.storyWorker}>{beat.worker} · {beat.activity}</Text>
                  </View>
                  <Text style={styles.storyText}>{beat.summary}</Text>
                  {beat.apps?.length ? <Text style={styles.storyApps}>{beat.apps.slice(0, 4).join(" · ")}</Text> : null}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.note}>
              No screen narration was available for the shifts in this period, so the report cannot describe on-screen work.
            </Text>
          )}

          {captures.length > 0 && (
            <>
              <SectionHeading>SCREENSHOT EVIDENCE</SectionHeading>
              <Text style={styles.note}>
                Periodic captures aligned to the windows described above. Images are stored securely and reproduced here only for the named hiring manager.
              </Text>
              <View style={styles.captureGrid}>
                {captures.map((capture) => (
                  <View key={capture.captureId} style={styles.captureCard} wrap={false}>
                    {data.captureImages[capture.captureId]
                      ? <Image src={data.captureImages[capture.captureId]} style={styles.captureImage} />
                      : <Text style={styles.captureMissing}>Screenshot unavailable</Text>}
                    <View style={styles.captureHeader}>
                      <Text style={styles.captureTime}>
                        {new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short" }).format(new Date(capture.capturedAt))}
                      </Text>
                      <Text style={styles.captureWorker}>{capture.worker}</Text>
                    </View>
                    {capture.note ? <Text style={styles.captureNote}>{capture.note.slice(0, 220)}{capture.note.length > 220 ? "…" : ""}</Text> : null}
                  </View>
                ))}
              </View>
            </>
          )}

          <View wrap={false}>
            <SectionHeading>WORKING PATTERNS &amp; PRODUCTIVITY SIGNALS</SectionHeading>
            <Paragraphs value={sections.patterns || narrative?.summary} />
            {hourlySeries.length > 0 && (
              <>
                <Text style={styles.chartTitle}>Active minutes by hour across the period</Text>
                <BarChartSvg series={hourlySeries} unit="min" />
              </>
            )}
          </View>

          {sections.risks ? (
            <>
              <SectionHeading>RISKS, INCONSISTENCIES &amp; COMPLIANCE</SectionHeading>
              <Paragraphs value={sections.risks} />
            </>
          ) : null}

          <SectionHeading>RECOMMENDATIONS FOR THE HIRING MANAGER</SectionHeading>
          <Paragraphs value={derivedRecommendations || narrative?.summary} />

          {(narrative?.highlights?.length || narrative?.concerns?.length) ? (
            <View style={styles.parties}>
              <View style={{ width: "50%", paddingRight: 8 }}>
                <Text style={styles.subHeading}>Highlights</Text>
                {(narrative?.highlights || []).map((highlight) => (
                  <View key={highlight} style={styles.findingRow}>
                    <Text style={styles.findingMarker}>+</Text>
                    <Text style={styles.findingText}>{highlight}</Text>
                  </View>
                ))}
              </View>
              <View style={{ width: "50%", paddingLeft: 8 }}>
                <Text style={styles.subHeading}>Points to watch</Text>
                {(narrative?.concerns || []).length ? (narrative?.concerns || []).map((concern) => (
                  <View key={concern} style={styles.findingRow}>
                    <Text style={styles.findingMarkerConcern}>!</Text>
                    <Text style={styles.findingText}>{concern}</Text>
                  </View>
                )) : <Text style={styles.findingText}>No material concerns were recorded.</Text>}
              </View>
            </View>
          ) : null}

          {sections.outlook ? (
            <>
              <SectionHeading>OUTLOOK</SectionHeading>
              <Paragraphs value={sections.outlook} />
            </>
          ) : null}

          {shifts.length > 0 && (
            <View break>
              <SectionHeading>SHIFT LOG</SectionHeading>
              <View style={styles.tableHeader}>
                <Text style={[styles.cell, { width: "14%" }, { fontFamily: "Helvetica-Bold" }]}>Date</Text>
                <Text style={[styles.cell, { width: "30%" }, { fontFamily: "Helvetica-Bold" }]}>Worker</Text>
                <Text style={[styles.cell, { width: "10%", textAlign: "center" }, { fontFamily: "Helvetica-Bold" }]}>Score</Text>
                <Text style={[styles.cell, { width: "18%", textAlign: "center" }, { fontFamily: "Helvetica-Bold" }]}>Worked</Text>
                <Text style={[styles.cell, { width: "14%", textAlign: "center" }, { fontFamily: "Helvetica-Bold" }]}>Starts</Text>
                <Text style={[styles.cell, { width: "14%", textAlign: "right" }, { fontFamily: "Helvetica-Bold" }]}>Close</Text>
              </View>
              {shifts.slice(0, 24).map((shift, index) => (
                <View key={shift.shiftId} style={[styles.tableRow, index % 2 === 1 ? { backgroundColor: "#F7FAF9" } : {}]}>
                  <Text style={[styles.cell, { width: "14%" }]}>{shortDate(shift.date)}</Text>
                  <Text style={[styles.cell, { width: "30%" }]}>{shift.worker}</Text>
                  <Text style={[styles.cell, { width: "10%", textAlign: "center" }, styles.cellBold]}>{shift.score}%</Text>
                  <Text style={[styles.cell, { width: "18%", textAlign: "center" }]}>{formatMinutes(shift.workedMinutes)}</Text>
                  <Text style={[styles.cell, { width: "14%", textAlign: "center" }]}>{activityLabel(shift.attendance)}</Text>
                  <Text style={[styles.cell, { width: "14%", textAlign: "right" }]}>{closureLabel(shift.closure)}</Text>
                </View>
              ))}
              {shifts.length > 24 && (
                <Text style={styles.note}>
                  Showing the 24 most recent shifts of {shifts.length} in range. The full log is available in the dashboard.
                </Text>
              )}
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
