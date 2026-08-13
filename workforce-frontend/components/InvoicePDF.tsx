import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { InvoiceData, InvoiceLineItem } from "@/types/invoice";

const teal = "#1A9797";
const darkTeal = "#006F7F";
const black = "#111111";
const grey = "#F1F1F1";
const totalGreen = "#D9EAD1";
const line = "#1F1F1F";

const money = (value: number) => `\u00A3${value.toFixed(2)}`;
const hours = (value: number) => `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2)}hrs`;

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: black, backgroundColor: "#FFFFFF" },
  topWave: { position: "absolute", top: 28, left: 36, right: 36, height: 54, backgroundColor: teal },
  topMask: { position: "absolute", top: 58, left: 36, right: 36, height: 56, backgroundColor: "#FFFFFF" },
  bottomWave: { position: "absolute", bottom: 28, right: 36, width: 145, height: 64, backgroundColor: teal },
  bottomDarkWave: { position: "absolute", bottom: 28, right: 36, width: 88, height: 64, backgroundColor: darkTeal },
  content: { position: "relative" },
  logoWrap: { alignItems: "center", minHeight: 96, justifyContent: "flex-end", marginBottom: 5 },
  logo: { width: 150, height: 78, objectFit: "contain" },
  logoFallback: { fontSize: 28, fontFamily: "Helvetica-Bold", color: teal },
  invoiceTitle: { textAlign: "center", fontSize: 20, fontFamily: "Helvetica-Bold", color: teal, marginBottom: 4 },
  metaRow: { flexDirection: "row", backgroundColor: grey, paddingVertical: 5, paddingHorizontal: 12, marginBottom: 4 },
  metaLeft: { width: "50%", flexDirection: "row", gap: 5 },
  metaRight: { width: "50%", flexDirection: "row", justifyContent: "flex-end", gap: 5 },
  metaLabel: { fontFamily: "Helvetica-Bold", color: "#555555" },
  parties: { flexDirection: "row", marginBottom: 4 },
  party: { width: "50%", paddingHorizontal: 3, minHeight: 88 },
  partyHeading: { fontFamily: "Helvetica-Bold", color: darkTeal, fontSize: 11, marginBottom: 6 },
  partyName: { fontSize: 11, marginBottom: 5 },
  address: { fontSize: 10.5, lineHeight: 1.35 },
  table: { marginTop: 1 },
  tableHeader: { flexDirection: "row", backgroundColor: teal, minHeight: 18, alignItems: "center" },
  th: { color: "#FFFFFF", fontFamily: "Helvetica-Bold", textAlign: "center", fontSize: 10.5 },
  weekCol: { width: "29%" },
  dayCol: { width: "25%" },
  hoursCol: { width: "16%" },
  rateCol: { width: "15%" },
  amountCol: { width: "15%" },
  weekBlock: { borderBottomWidth: 2, borderBottomColor: line },
  weekBlockLast: { borderBottomWidth: 0 },
  weekBody: { flexDirection: "row" },
  weekLabelCol: { width: "29%", alignItems: "center", paddingTop: 6 },
  weekTitle: { fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 22 },
  weekRange: { fontSize: 10.5 },
  weekRows: { width: "71%" },
  itemRow: { flexDirection: "row", minHeight: 18, alignItems: "center" },
  itemText: { fontSize: 10.5 },
  itemCenter: { fontSize: 10.5, textAlign: "center" },
  totalRow: { flexDirection: "row", backgroundColor: totalGreen, minHeight: 19, alignItems: "center", marginTop: 0 },
  totalLabel: { width: "54%", paddingLeft: 3, fontFamily: "Helvetica-Bold", color: teal, fontSize: 11 },
  totalHours: { width: "16%", textAlign: "center", fontFamily: "Helvetica-Bold" },
  totalRate: { width: "15%", textAlign: "center", fontFamily: "Helvetica-Bold" },
  totalAmount: { width: "15%", textAlign: "center", fontFamily: "Helvetica-Bold" },
  lower: { flexDirection: "row", marginTop: 18 },
  payment: { width: "45%", paddingRight: 10 },
  terms: { width: "30%", paddingHorizontal: 8 },
  summary: { width: "25%" },
  note: { fontSize: 8.8, marginBottom: 8, lineHeight: 1.25 },
  detailRow: { flexDirection: "row", marginBottom: 4 },
  detailLabel: { width: 52, color: darkTeal, fontFamily: "Helvetica-Bold", fontSize: 10.5 },
  detailValue: { flex: 1, fontSize: 10.5, lineHeight: 1.3 },
  spacer: { height: 14 },
  sectionTitle: { backgroundColor: teal, color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 10, textAlign: "center", paddingVertical: 5 },
  termsTitle: { color: darkTeal, fontFamily: "Helvetica-Bold", fontSize: 11, textAlign: "center", marginBottom: 7 },
  termsText: { fontSize: 10, lineHeight: 1.35 },
  summaryRow: { flexDirection: "row", minHeight: 18, alignItems: "center", backgroundColor: "#F7F7F7" },
  summaryRowPlain: { backgroundColor: "#FFFFFF" },
  summaryDue: { backgroundColor: totalGreen },
  summaryLabel: { width: "48%", paddingLeft: 3, fontFamily: "Helvetica-Bold", fontSize: 8.5 },
  summaryValue: { width: "52%", textAlign: "center", fontSize: 9.2 },
  summaryValueStrong: { fontFamily: "Helvetica-Bold" },
  contactFooter: { marginTop: 18, alignItems: "center", gap: 4 },
  footerLine: { flexDirection: "row", gap: 18 },
  footerText: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#4D4D4D" },
  thankYou: { marginTop: 6, marginLeft: 330, color: "#E34C4C", fontSize: 14, fontFamily: "Helvetica-Oblique" },
});

function groupItems(items: InvoiceLineItem[]) {
  return items.reduce<Array<{ week: number; weekRange: string; items: InvoiceLineItem[] }>>((groups, item) => {
    const last = groups[groups.length - 1];

    if (!last || last.week !== item.week) {
      groups.push({ week: item.week, weekRange: item.weekRange, items: [item] });
      return groups;
    }

    last.items.push(item);
    return groups;
  }, []);
}

export function InvoicePDF({ data }: { data: InvoiceData }) {
  const groupedItems = groupItems(data.items);
  const totalHours = data.items.reduce((sum, item) => sum + item.hours, 0);
  const total = data.items.reduce((sum, item) => sum + item.hours * item.rate, 0);
  const hourlyRate = data.items[0]?.rate ?? 0;

  return (
    <Document title={`Invoice ${data.invoiceNumber}`} author="Advanced Virtual Solutions Ltd">
      <Page size="LETTER" style={styles.page}>
        <View fixed style={styles.topWave} />
        <View fixed style={styles.topMask} />
        <View fixed style={styles.bottomWave} />
        <View fixed style={styles.bottomDarkWave} />
        <View style={styles.content}>
          <View style={styles.logoWrap}>
            {data.logoSrc ? <Image src={data.logoSrc} style={styles.logo} /> : <Text style={styles.logoFallback}>{data.logoText}</Text>}
          </View>

          <Text style={styles.invoiceTitle}>INVOICE</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaLeft}>
              <Text style={styles.metaLabel}>INVOICE NUMBER:</Text>
              <Text>{data.invoiceNumber}</Text>
            </View>
            <View style={styles.metaRight}>
              <Text style={styles.metaLabel}>DATE:</Text>
              <Text>{data.invoiceDate}</Text>
            </View>
          </View>

          <View style={styles.parties}>
            <View style={styles.party}>
              <Text style={styles.partyHeading}>Billed to:</Text>
              <Text style={styles.partyName}>{data.toName}</Text>
              <Text style={styles.address}>{data.toAddress}</Text>
            </View>
            <View style={styles.party}>
              <Text style={styles.partyHeading}>Issued by:</Text>
              <Text style={styles.partyName}>{data.fromName}</Text>
              <Text style={styles.address}>{data.fromAddress}</Text>
            </View>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.weekCol]}>WEEK/DAYS</Text>
              <Text style={[styles.th, styles.dayCol]} />
              <Text style={[styles.th, styles.hoursCol]}>HOURS WORKED</Text>
              <Text style={[styles.th, styles.rateCol]}>HOURLY RATE</Text>
              <Text style={[styles.th, styles.amountCol]}>AMOUNT (\u00A3)</Text>
            </View>

            {groupedItems.map((group, groupIndex) => (
              <View
                key={`week-${group.week}`}
                style={[styles.weekBlock, groupIndex === groupedItems.length - 1 ? styles.weekBlockLast : {}]}
                wrap={false}
              >
                <View style={styles.weekBody}>
                  <View style={styles.weekLabelCol}>
                    <Text style={styles.weekTitle}>WEEK {group.week}</Text>
                    <Text style={styles.weekRange}>{group.weekRange}</Text>
                  </View>
                  <View style={styles.weekRows}>
                    {group.items.map((item, index) => (
                      <View key={`${item.date}-${item.description}-${index}`} style={styles.itemRow}>
                        <Text style={[styles.itemText, styles.dayCol]}>{item.description || item.dayLabel}</Text>
                        <Text style={[styles.itemCenter, styles.hoursCol]}>{item.hours.toFixed(2)}</Text>
                        <Text style={[styles.itemCenter, styles.rateCol]}>{money(item.rate)}</Text>
                        <Text style={[styles.itemCenter, styles.amountCol]}>{money(item.hours * item.rate)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ))}

            <View style={styles.totalRow} wrap={false}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalHours}>{hours(totalHours)}</Text>
              <Text style={styles.totalRate}>{money(hourlyRate)}</Text>
              <Text style={styles.totalAmount}>{money(total)}</Text>
            </View>
          </View>

          <View style={styles.lower}>
            <View style={styles.payment}>
              <Text style={styles.note}>Kindly make payment to Advanced Virtual Solutions Ltd using the details below.</Text>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Name:</Text><Text style={styles.detailValue}>Advanced Virtual Solutions Ltd</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Acc No:</Text><Text style={styles.detailValue}>82440452</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Sort Code:</Text><Text style={styles.detailValue}>60-84-64</Text></View>
              <View style={styles.spacer} />
              <View style={styles.detailRow}><Text style={styles.detailLabel}>IBAN:</Text><Text style={styles.detailValue}>GB22 TRWI 6084 6482 4404 52</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Swift/BIC:</Text><Text style={styles.detailValue}>TRWIGB2LXXX</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Bank name:</Text><Text style={styles.detailValue}>Wise Payments Limited{"\n"}Worship Square, 65 Clifton Street{"\n"}London, EC2A 4JE{"\n"}United Kingdom</Text></View>
            </View>

            <View style={styles.terms}>
              <Text style={styles.termsTitle}>TERMS AND CONDITIONS</Text>
              <Text style={styles.termsText}>{data.terms} Thank you for choosing Advanced Virtual Solutions Ltd</Text>
            </View>

            <View style={styles.summary}>
              <Text style={styles.sectionTitle}>INVOICE SUMMARY</Text>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Billing Period</Text><Text style={styles.summaryValue}>{data.billingPeriod}</Text></View>
              <View style={[styles.summaryRow, styles.summaryRowPlain]}><Text style={styles.summaryLabel}>Total Hours</Text><Text style={styles.summaryValue}>{hours(totalHours)}</Text></View>
              <View style={[styles.summaryRow, styles.summaryRowPlain]}><Text style={styles.summaryLabel}>Hourly Rate</Text><Text style={styles.summaryValue}>{money(hourlyRate)}</Text></View>
              <View style={[styles.summaryRow, styles.summaryRowPlain]}><Text style={styles.summaryLabel}>Tax</Text><Text style={styles.summaryValue}>{money(0)}</Text></View>
              <View style={[styles.summaryRow, styles.summaryDue]}><Text style={styles.summaryLabel}>Total Due</Text><Text style={[styles.summaryValue, styles.summaryValueStrong]}>{money(total)}</Text></View>
            </View>
          </View>

          <View style={styles.contactFooter}>
            <View style={styles.footerLine}>
              <Text style={styles.footerText}>www.advancedvirtualsolutions.com</Text>
              <Text style={styles.footerText}>+447882615046</Text>
            </View>
            <View style={styles.footerLine}>
              <Text style={styles.footerText}>+447312649526</Text>
              <Text style={styles.footerText}>admin@advancedvirtualsolutions.com</Text>
            </View>
          </View>
          <Text style={styles.thankYou}>Thank You</Text>
        </View>
      </Page>
    </Document>
  );
}
