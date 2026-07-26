import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { InvoiceData } from "@/types/invoice";

const teal = "#0798B4";
const navy = "#073B4C";
const paleTeal = "#EAF9FC";
const paleGrey = "#F5F7F8";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: navy },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 3, borderBottomColor: teal, paddingBottom: 14, marginBottom: 18 },
  logo: { width: 185, height: 55, objectFit: "contain" },
  logoFallback: { fontSize: 18, fontFamily: "Helvetica-Bold", color: teal },
  invoiceTitle: { fontSize: 24, fontFamily: "Helvetica-Bold", color: navy, textTransform: "uppercase", textAlign: "right" },
  invoiceMeta: { marginTop: 4, color: "#52666d", textAlign: "right" },
  parties: { flexDirection: "row", gap: 14, marginBottom: 16 },
  party: { flexGrow: 1, flexBasis: 0, padding: 10, backgroundColor: paleGrey, borderLeftWidth: 3, borderLeftColor: teal },
  partyLabel: { marginBottom: 5, fontSize: 8, fontFamily: "Helvetica-Bold", color: teal },
  partyName: { marginBottom: 3, fontFamily: "Helvetica-Bold", fontSize: 10 },
  address: { color: "#52666d", lineHeight: 1.4 },
  table: { borderWidth: 1, borderColor: "#9BB2BA" },
  tableHeader: { flexDirection: "row", backgroundColor: navy, color: "#FFFFFF", fontFamily: "Helvetica-Bold", paddingVertical: 7 },
  row: { flexDirection: "row", minHeight: 23, paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#D7E1E4" },
  alternateRow: { backgroundColor: paleGrey },
  date: { width: "15%", paddingHorizontal: 6 },
  description: { width: "43%", paddingHorizontal: 6 },
  hours: { width: "12%", paddingHorizontal: 6, textAlign: "center" },
  rate: { width: "15%", paddingHorizontal: 6, textAlign: "right" },
  amount: { width: "15%", paddingHorizontal: 6, textAlign: "right" },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", padding: 10, backgroundColor: paleTeal, borderTopWidth: 2, borderTopColor: navy },
  totalLabel: { marginRight: 18, fontSize: 11, fontFamily: "Helvetica-Bold" },
  totalValue: { minWidth: 80, textAlign: "right", fontSize: 11, fontFamily: "Helvetica-Bold", color: teal },
  lower: { flexDirection: "row", gap: 16, marginTop: 18 },
  payment: { width: "54%" },
  summary: { width: "46%" },
  sectionTitle: { padding: 7, backgroundColor: navy, color: "#FFFFFF", fontFamily: "Helvetica-Bold" },
  paymentBody: { padding: 9, backgroundColor: paleGrey, lineHeight: 1.45 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#D7E1E4" },
  due: { backgroundColor: paleTeal, paddingHorizontal: 7, marginHorizontal: -7, fontFamily: "Helvetica-Bold" },
  footer: { marginTop: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#D7E1E4", color: "#52666d", fontSize: 8, lineHeight: 1.4 },
});

const money = (value: number) => `£${value.toFixed(2)}`;

export function InvoicePDF({ data }: { data: InvoiceData }) {
  const totalHours = data.items.reduce((sum, item) => sum + item.hours, 0);
  const total = data.items.reduce((sum, item) => sum + item.hours * item.rate, 0);

  return (
    <Document title={`Invoice ${data.invoiceNumber}`} author="Advanced Virtual Solutions Ltd">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {data.logoSrc ? <Image src={data.logoSrc} style={styles.logo} /> : <Text style={styles.logoFallback}>{data.logoText}</Text>}
          <View>
            <Text style={styles.invoiceTitle}>Invoice</Text>
            <Text style={styles.invoiceMeta}>Invoice #: {data.invoiceNumber}</Text>
            <Text style={styles.invoiceMeta}>Date: {data.invoiceDate}</Text>
          </View>
        </View>

        <View style={styles.parties}>
          <View style={styles.party}><Text style={styles.partyLabel}>ISSUED BY</Text><Text style={styles.partyName}>{data.fromName}</Text><Text style={styles.address}>{data.fromAddress}</Text></View>
          <View style={styles.party}><Text style={styles.partyLabel}>BILLED TO</Text><Text style={styles.partyName}>{data.toName}</Text><Text style={styles.address}>{data.toAddress}</Text></View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}><Text style={styles.date}>DATE</Text><Text style={styles.description}>DESCRIPTION</Text><Text style={styles.hours}>HOURS</Text><Text style={styles.rate}>RATE</Text><Text style={styles.amount}>AMOUNT</Text></View>
          {data.items.map((item, index) => <View key={`${item.date}-${index}`} style={[styles.row, index % 2 === 0 ? styles.alternateRow : {}]} wrap={false}>
            <Text style={styles.date}>{item.date}</Text><Text style={styles.description}>{item.description}</Text><Text style={styles.hours}>{item.hours.toFixed(2)}</Text><Text style={styles.rate}>{money(item.rate)}</Text><Text style={styles.amount}>{money(item.hours * item.rate)}</Text>
          </View>)}
        </View>
        <View style={styles.totalRow}><Text style={styles.totalLabel}>TOTAL DUE</Text><Text style={styles.totalValue}>{money(total)}</Text></View>

        <View style={styles.lower}>
          <View style={styles.payment}><Text style={styles.sectionTitle}>PAYMENT DETAILS</Text><Text style={styles.paymentBody}>Advanced Virtual Solutions Ltd{`\n`}Account no: 82440452{`\n`}Sort code: 60-84-64{`\n`}IBAN: GB22 TRWI 6084 6482 4404 52{`\n`}Swift/BIC: TRWIGB2LXXX{`\n`}Wise Payments Limited</Text></View>
          <View style={styles.summary}><Text style={styles.sectionTitle}>INVOICE SUMMARY</Text><View style={styles.paymentBody}><View style={styles.summaryRow}><Text>Billing period</Text><Text>{data.billingPeriod}</Text></View><View style={styles.summaryRow}><Text>Total hours</Text><Text>{totalHours.toFixed(2)}</Text></View><View style={styles.summaryRow}><Text>Tax</Text><Text>£0.00</Text></View><View style={[styles.summaryRow, styles.due]}><Text>Total due</Text><Text>{money(total)}</Text></View></View></View>
        </View>
        <View style={styles.footer}><Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 3 }}>TERMS AND CONDITIONS</Text><Text>{data.terms}</Text></View>
      </Page>
    </Document>
  );
}
