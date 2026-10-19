import { Document, Image, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { BarChartSvg, DonutChart } from "@/components/AIAnalysisPDF";
import { formatMinutes } from "@/lib/charts";
import type { AggregateAnalysis } from "@/types/workforce";

// Branded PDF export for the aggregate period report — same teal/navy
// language as InvoicePDF and the per-shift AIAnalysisPDF.

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
  modelLabel: string;
  periodLabel: string;
  worker?: { name: string; email: string } | null;
  hiringManager: { name: string; email: string; organization: string; address: string; companyNumber: string };
  aggregate: AggregateAnalysis;
  logoSrc?: string;
};

export function buildAggregatePdfData(input: {
  aggregate: AggregateAnalysis;
  worker?: { name: string; email: string } | null;
  hiringManager: import("@/types/workforce").User;
  logoSrc?: string;
}): AggregatePdfData {
  const generatedAt = new Date();
  const { aggregate } = input;

  return {
    reference: `AVS-AIP-${generatedAt.toISOString().slice(0, 10).replace(/-/g, "")}-${aggregate.endDate.replace(/-/g, "").slice(2)}`,
    generatedAtLabel: new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(generatedAt),
    modelLabel: aggregate.narrative
      ? aggregate.narrative.source === "gemini"
        ? aggregate.narrative.aiModel || "Google Gemini"
        : "ShiftSync offline summary"
      : "No narrative generated",
    periodLabel: `${aggregate.startDate} to ${aggregate.endDate}`,
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
  };
}

const styles = StyleSheet.create({
  page: { padding: 36, paddingBottom: 72, fontSize: 10, fontFamily: "Helvetica", color: black, backgroundColor: "#FFFFFF" },
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
  tableHeader: { flexDirection: "row", backgroundColor: teal, color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 9.5, paddingVertical: 5, marginTop: 10 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: line, paddingVertical: 5 },
  tableRowAlt: { backgroundColor: "#F7FAF9" },
  cell: { fontSize: 9.5, paddingHorizontal: 4 },
  cellBold: { fontFamily: "Helvetica-Bold" },
  colWorker: { width: "34%" },
  colShifts: { width: "12%", textAlign: "center" },
  colScore: { width: "18%", textAlign: "center" },
  colAdherence: { width: "18%", textAlign: "center" },
  colWorked: { width: "18%", textAlign: "right" },
  narrativeBlock: { marginBottom: 8 },
  narrativeHeading: { fontFamily: "Helvetica-Bold", color: darkTeal, fontSize: 10.5, marginBottom: 3 },
  narrativeText: { fontSize: 10, lineHeight: 1.4 },
  findingRow: { flexDirection: "row", marginBottom: 3, gap: 5, paddingRight: 12 },
  findingMarker: { fontFamily: "Helvetica-Bold", color: teal, fontSize: 10 },
  findingMarkerConcern: { fontFamily: "Helvetica-Bold", color: "#C2410C", fontSize: 10 },
  findingText: { flex: 1, fontSize: 10, lineHeight: 1.35 },
  footer: { position: "absolute", bottom: 28, left: 36, right: 200, alignItems: "center", gap: 3 },
  footerText: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#4D4D4D" },
  pageNumber: { fontSize: 8, color: muted },
});

export function AggregateAnalysisPDF({ data }: { data: AggregatePdfData }) {
  const { aggregate } = data;
  const t = aggregate.totals;
  const narrative = aggregate.narrative?.narrative;

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
    { label: "MODEL", value: data.modelLabel },
  ];

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
              <Text style={styles.partyHeading}>Report billed to</Text>
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

          {aggregate.rows.length > 0 && (
            <View wrap={false}>
              <View style={styles.sectionTitle}><Text>WORKER SCORES</Text></View>
              <Text style={styles.chartTitle}>Average performance score per worker</Text>
              <BarChartSvg
                series={aggregate.rows.map((row) => ({
                  label: row.name.split(" ")[0],
                  value: row.averageScore,
                }))}
                unit="%"
              />
            </View>
          )}

          <View wrap={false}>
            <View style={styles.sectionTitle}><Text>WORKER BREAKDOWN</Text></View>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.colWorker]}>Worker</Text>
              <Text style={[styles.cell, styles.colShifts]}>Shifts</Text>
              <Text style={[styles.cell, styles.colScore]}>Avg score</Text>
              <Text style={[styles.cell, styles.colAdherence]}>Adherence</Text>
              <Text style={[styles.cell, styles.colWorked]}>Worked</Text>
            </View>
            {aggregate.rows.map((row, index) => (
              <View
                key={row.userId}
                style={index % 2 === 1 ? { ...styles.tableRow, backgroundColor: "#F7FAF9" } : styles.tableRow}
              >
                <Text style={[styles.cell, styles.cellBold, styles.colWorker]}>{row.name}</Text>
                <Text style={[styles.cell, styles.colShifts]}>{row.shiftCount}</Text>
                <Text style={[styles.cell, styles.colScore]}>{row.averageScore}%</Text>
                <Text style={[styles.cell, styles.colAdherence]}>{row.averageAdherence}%</Text>
                <Text style={[styles.cell, styles.colWorked]}>{formatMinutes(row.workedMinutes)}</Text>
              </View>
            ))}
          </View>

          <View wrap={false}>
            <View style={styles.sectionTitle}><Text>AI NARRATIVE SUMMARY</Text></View>
            {narrative ? (
              <>
                <View style={styles.narrativeBlock}>
                  <Text style={styles.narrativeHeading}>{narrative.headline || "Period summary"}</Text>
                  <Text style={styles.narrativeText}>{narrative.summary}</Text>
                </View>
                {narrative.highlights.length > 0 && (
                  <View style={styles.narrativeBlock}>
                    <Text style={styles.narrativeHeading}>Highlights</Text>
                    {narrative.highlights.map((highlight) => (
                      <View key={highlight} style={styles.findingRow}>
                        <Text style={styles.findingMarker}>+</Text>
                        <Text style={styles.findingText}>{highlight}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {narrative.concerns.length > 0 && (
                  <View style={styles.narrativeBlock}>
                    <Text style={styles.narrativeHeading}>Points to watch</Text>
                    {narrative.concerns.map((concern) => (
                      <View key={concern} style={styles.findingRow}>
                        <Text style={styles.findingMarkerConcern}>!</Text>
                        <Text style={styles.findingText}>{concern}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <View style={styles.narrativeBlock}>
                <Text style={styles.narrativeText}>
                  No narrative was generated for this period yet. Use “Generate period summary” on the dashboard to add an AI-written overview.
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated by ShiftSync · Advanced Virtual Solutions Ltd</Text>
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
