"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ExcelJS from "exceljs";
import { Download, Home, RefreshCw, ShieldCheck } from "lucide-react";
import { apiRequest, formatDate } from "@/lib/api";
import type { ExecutionReport, User } from "@/types/workforce";

const BUSINESS_TIME_ZONE = "Europe/London";
const DEFAULT_HOURLY_RATE = 4.5;
const INVOICE_TEAL = "FF0798B4";
const INVOICE_NAVY = "FF073B4C";
const INVOICE_LIGHT_TEAL = "FFEAF9FC";
const INVOICE_LIGHT_GREY = "FFF5F7F8";
const AVS_INVOICE_LOGO_FALLBACK =
  "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 900 160'%3E%3Crect width='900' height='160' fill='white'/%3E%3Ctext x='32' y='76' font-family='Arial,sans-serif' font-size='44' font-weight='700' fill='%231a9797'%3EADVANCED VIRTUAL%3C/text%3E%3Ctext x='32' y='124' font-family='Arial,sans-serif' font-size='44' font-weight='700' fill='%230f172a'%3ESOLUTIONS%3C/text%3E%3C/svg%3E";

function dateKey(value = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(value).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function escapeExcelCell(value: string | number | undefined | null) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function toExcelDate(value: string) {
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return dateOnly ? `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}` : value.slice(0, 10);
}

function invoiceHours(workedMinutes: number, invoiceWorkedMinutes?: number) {
  const billableMinutes = invoiceWorkedMinutes ?? (workedMinutes > 420 && workedMinutes <= 480 ? 480 : workedMinutes);
  return Number((billableMinutes / 60).toFixed(2));
}

function formatInvoiceDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
  }).format(value instanceof Date ? value : new Date(value)).toUpperCase();
}

function formatBillingPeriod(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: BUSINESS_TIME_ZONE,
  });
  return `${formatter.format(new Date(start))} - ${formatter.format(new Date(end))}`;
}

function formatWeekday(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE,
    weekday: "long",
  }).format(new Date(value));
}

function excelFormula(formula: string) {
  return `x:fmla="${formula}"`;
}

async function getInvoiceLogoDataUri() {
  try {
    const response = await fetch("/avs-invoice-logo.jpg");
    if (!response.ok) return AVS_INVOICE_LOGO_FALLBACK;
    const blob = await response.blob();

    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || AVS_INVOICE_LOGO_FALLBACK));
      reader.onerror = () => resolve(AVS_INVOICE_LOGO_FALLBACK);
      reader.readAsDataURL(blob);
    });
  } catch {
    return AVS_INVOICE_LOGO_FALLBACK;
  }
}

function buildInvoiceWorkbookHtml(
  report: ExecutionReport,
  rows: ExecutionReport["rows"],
  billedTo: User,
  logoDataUri: string
) {
  const invoiceDate = formatInvoiceDate(new Date());
  const invoiceNumber = `AVS-${toExcelDate(report.endDate).replace(/-/g, "")}-${String(rows.length).padStart(4, "0")}`;
  const billingPeriod = formatBillingPeriod(report.startDate, report.endDate);
  const sortedRows = [...rows].sort((left, right) => {
    const byDate = String(left.date).localeCompare(String(right.date));
    return byDate || left.user.name.localeCompare(right.user.name);
  });
  const firstDataRow = 10;
  const periodStart = new Date(toExcelDate(report.startDate)).getTime();
  const dataRows = sortedRows.map((row, index) => {
    const sheetRow = firstDataRow + index;
    const rowDate = toExcelDate(row.date);
    const previousDate = sortedRows[index - 1] ? toExcelDate(sortedRows[index - 1].date) : "";
    const week = Math.floor((new Date(rowDate).getTime() - periodStart) / 604800000) + 1;
    const previousWeek = previousDate
      ? Math.floor((new Date(previousDate).getTime() - periodStart) / 604800000) + 1
      : 0;
    const hours = invoiceHours(row.performance.workedMinutes);
    const dateLabel = rowDate !== previousDate ? formatBillingPeriod(rowDate, rowDate) : "";

    return `
      <tr>
        <td class="week-label" colspan="2">${week !== previousWeek ? `WEEK ${week}` : dateLabel}</td>
        <td></td>
        <td class="day">${escapeExcelCell(`${formatWeekday(row.date)} - ${row.user.name}`)}</td>
        <td class="number" x:num="${hours}">${hours}</td>
        <td></td>
        <td class="currency" x:num="${DEFAULT_HOURLY_RATE}">${DEFAULT_HOURLY_RATE.toFixed(2)}</td>
        <td></td>
        <td class="currency" colspan="2" ${excelFormula(`=E${sheetRow}*G${sheetRow}`)}>0</td>
      </tr>`;
  });
  const totalRow = firstDataRow + dataRows.length;
  const taxRow = totalRow + 5;
  const hoursFormula = sortedRows.map((_, index) => `E${firstDataRow + index}`).join(",");
  const amountFormula = sortedRows.map((_, index) => `I${firstDataRow + index}`).join(",");
  const recipientLabel = billedTo.organizationName || billedTo.name;
  const recipientAddress = billedTo.organizationAddress || "";
  const recipientCompanyNumber = billedTo.companyNumber || "";

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="utf-8" />
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Invoice</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <style>
          table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11pt; width: 980px; }
          td, th { padding: 4px 6px; vertical-align: middle; }
          .logo { height: 86px; text-align: center; }
          .logo img { max-height: 66px; max-width: 460px; }
          .label { font-weight: 700; text-align: right; }
          .section { background: #1a9797; color: #000; font-weight: 700; text-align: center; }
          .left-title { font-weight: 700; }
          .week-label { font-weight: 700; text-align: center; }
          .day { text-align: left; }
          .number { mso-number-format:"0.00"; text-align: center; }
          .currency { mso-number-format:"£#,##0.00"; text-align: center; }
          .total { font-weight: 700; border-top: 2px solid #000; }
          .summary-label { font-size: 9pt; font-weight: 700; text-align: left; }
          .summary-value { text-align: center; }
          .small { font-size: 9pt; }
          col.c1 { width: 70px; } col.c2 { width: 90px; } col.c3 { width: 24px; } col.c4 { width: 220px; }
          col.c5 { width: 90px; } col.c6 { width: 24px; } col.c7 { width: 90px; } col.c8 { width: 24px; }
          col.c9 { width: 95px; } col.c10 { width: 95px; }
        </style>
      </head>
      <body>
        <table>
          <colgroup><col class="c1" /><col class="c2" /><col class="c3" /><col class="c4" /><col class="c5" /><col class="c6" /><col class="c7" /><col class="c8" /><col class="c9" /><col class="c10" /></colgroup>
          <tr><td class="logo" colspan="10"><img alt="Advanced Virtual Solutions" src="${logoDataUri}" /></td></tr>
          <tr><td class="label" colspan="2">INVOICE NUMBER:</td><td colspan="4">${escapeExcelCell(invoiceNumber)}</td><td class="label" colspan="2">DATE:</td><td colspan="2">${escapeExcelCell(invoiceDate)}</td></tr>
          <tr><td class="left-title" colspan="4">Billed to:</td><td></td><td class="left-title" colspan="5">Issued by:</td></tr>
          <tr><td colspan="4">${escapeExcelCell(recipientLabel)}</td><td></td><td colspan="5">Advanced Virtual Solutions Ltd</td></tr>
          <tr><td colspan="4">${escapeExcelCell(recipientAddress)}</td><td></td><td colspan="5">31 Northfield Road</td></tr>
          <tr><td colspan="4"></td><td></td><td colspan="5">London</td></tr>
          <tr><td colspan="4"></td><td></td><td colspan="5">N16 5RL</td></tr>
          <tr><td colspan="4">${escapeExcelCell(recipientCompanyNumber ? `Company No: ${recipientCompanyNumber}` : "")}</td><td></td><td colspan="5">Company No: 17232919</td></tr>
          <tr><td class="section" colspan="4">WEEK/DAYS</td><td class="section" colspan="2">HOURS WORKED</td><td class="section" colspan="2">HOURLY RATE</td><td class="section" colspan="2">AMOUNT (&pound;)</td></tr>
          ${dataRows.join("")}
          <tr><td class="total" colspan="4">TOTAL</td><td class="total number" colspan="2" ${excelFormula(hoursFormula ? `=SUM(${hoursFormula})` : "=0")}>0</td><td class="total currency" colspan="2" x:num="${DEFAULT_HOURLY_RATE}">${DEFAULT_HOURLY_RATE.toFixed(2)}</td><td class="total currency" colspan="2" ${excelFormula(amountFormula ? `=SUM(${amountFormula})` : "=0")}>0</td></tr>
          <tr><td colspan="7"></td><td class="section" colspan="3">INVOICE SUMMARY</td></tr>
          <tr><td class="small" colspan="6">Kindly make payment to Advanced Virtual Solutions Ltd using the details below.</td><td class="summary-label" colspan="2">Billing Period</td><td class="summary-value" colspan="2">${escapeExcelCell(billingPeriod)}</td></tr>
          <tr><td colspan="7"></td><td class="summary-label">Total Hours</td><td class="number" colspan="2" ${excelFormula(`=E${totalRow}`)}>0</td></tr>
          <tr><td colspan="7"></td><td class="summary-label">Hourly Rate</td><td class="currency" colspan="2" ${excelFormula(`=G${totalRow}`)}>0</td></tr>
          <tr><td colspan="7"></td><td class="summary-label">Tax</td><td class="currency" colspan="2" x:num="0">0</td></tr>
          <tr><td class="left-title">Name:</td><td colspan="5">Advanced Virtual Solutions Ltd</td><td></td><td class="summary-label">Total Due</td><td class="currency" colspan="2" ${excelFormula(`=I${totalRow}-I${taxRow}`)}>0</td></tr>
          <tr><td class="left-title">Acc No:</td><td colspan="5">82440452</td><td colspan="4"></td></tr>
          <tr><td class="left-title">Sort Code:</td><td colspan="5">60-84-64</td><td colspan="4"></td></tr>
          <tr><td></td><td colspan="5"></td><td colspan="4"></td></tr>
          <tr><td class="left-title">IBAN:</td><td colspan="4">GB22 TRWI 6084 6482 4404 52</td><td></td><td class="left-title" colspan="4">TERMS AND CONDITIONS</td></tr>
          <tr><td class="left-title">Swift/BIC:</td><td colspan="4">TRWIGB2LXXX</td><td></td><td colspan="4">Payment is due within 15 days from the invoice date.</td></tr>
          <tr><td class="left-title">Bank name:</td><td colspan="4">Wise Payments Limited</td><td></td><td colspan="4">Kindly quote the invoice number with your payment.</td></tr>
          <tr><td></td><td colspan="4">Worship Square, 65 Clifton Street</td><td></td><td colspan="4">Please contact us within 5 business days if you have any</td></tr>
          <tr><td></td><td colspan="4">London, EC2A 4JE</td><td></td><td colspan="4">questions regarding this invoice.</td></tr>
          <tr><td></td><td colspan="4">United Kingdom</td><td></td><td colspan="4">Thank you for choosing Advanced Virtual Solutions Ltd</td></tr>
        </table>
      </body>
    </html>`;
}

async function buildNativeInvoiceWorkbook(
  report: ExecutionReport,
  rows: ExecutionReport["rows"],
  billedTo: User
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Advanced Virtual Solutions Ltd";
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  const worksheet = workbook.addWorksheet("Invoice", {
    pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: "portrait" },
    views: [{ showGridLines: false }],
  });
  worksheet.columns = [
    { width: 11 }, { width: 11 }, { width: 11 }, { width: 29 }, { width: 13 },
    { width: 4 }, { width: 13 }, { width: 4 }, { width: 15 }, { width: 7 },
  ];
  worksheet.properties.defaultRowHeight = 21;

  const border = { style: "thin" as const, color: { argb: "FF9BB2BA" } };
  const strongBorder = { style: "medium" as const, color: { argb: INVOICE_NAVY } };
  const cellStyle = (fill?: string): Partial<ExcelJS.Style> => ({
    alignment: { vertical: "middle", horizontal: "center" },
    border: { top: border, left: border, bottom: border, right: border },
    ...(fill ? { fill: { type: "pattern", pattern: "solid", fgColor: { argb: fill } } } : {}),
  });
  const invoiceDate = formatInvoiceDate(new Date());
  const invoiceNumber = `AVS-${toExcelDate(report.endDate).replace(/-/g, "")}-${String(rows.length).padStart(4, "0")}`;
  const billingPeriod = formatBillingPeriod(report.startDate, report.endDate);
  const recipient = billedTo.organizationName || billedTo.name;
  const recipientAddress = billedTo.organizationAddress || "";
  const recipientCompanyNumber = billedTo.companyNumber ? `Company No: ${billedTo.companyNumber}` : "";
  const sortedRows = [...rows].sort((left, right) => String(left.date).localeCompare(String(right.date)) || left.user.name.localeCompare(right.user.name));

  worksheet.mergeCells("A1:J3");
  worksheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getCell("A1").value = "ADVANCED VIRTUAL SOLUTIONS";
  worksheet.getCell("A1").font = { bold: true, size: 20, color: { argb: INVOICE_NAVY } };
  [1, 2, 3].forEach((row) => { worksheet.getRow(row).height = 30; });
  try {
    const response = await fetch("/avs-invoice-logo.jpg");
    if (response.ok) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
      const logoId = workbook.addImage({ base64: window.btoa(binary), extension: "jpeg" });
      worksheet.getCell("A1").value = "";
      worksheet.addImage(logoId, { tl: { col: 1.7, row: 0.18 }, ext: { width: 290, height: 108 } });
    }
  } catch {}

  const details: Array<[string, string, string, string]> = [
    ["INVOICE NUMBER:", invoiceNumber, "DATE:", invoiceDate],
    ["Billed to:", "Issued by:", "", ""],
    [recipient, "Advanced Virtual Solutions Ltd", "", ""],
    [recipientAddress, "31 Northfield Road", "", ""],
    ["", "London, N16 5RL", "", ""],
    [recipientCompanyNumber, "Company No: 17232919", "", ""],
  ];
  worksheet.mergeCells("A4:B4"); worksheet.getCell("A4").value = details[0][0];
  worksheet.mergeCells("C4:F4"); worksheet.getCell("C4").value = details[0][1];
  worksheet.mergeCells("G4:H4"); worksheet.getCell("G4").value = details[0][2];
  worksheet.mergeCells("I4:J4"); worksheet.getCell("I4").value = details[0][3];
  ["A4", "C4", "G4", "I4"].forEach((cell) => { worksheet.getCell(cell).style = cellStyle(INVOICE_LIGHT_GREY); });
  ["A4", "G4"].forEach((cell) => { worksheet.getCell(cell).font = { bold: true, color: { argb: INVOICE_NAVY } }; worksheet.getCell(cell).alignment = { horizontal: "right", vertical: "middle" }; });
  ["C4", "I4"].forEach((cell) => { worksheet.getCell(cell).font = { bold: true }; });
  [[5, details[1]], [6, details[2]], [7, details[3]], [8, details[4]], [9, details[5]]].forEach(([row, values]) => {
    const rowNumber = Number(row);
    const content = values as [string, string, string, string];
    worksheet.mergeCells(`A${rowNumber}:D${rowNumber}`); worksheet.getCell(`A${rowNumber}`).value = content[0];
    worksheet.mergeCells(`F${rowNumber}:J${rowNumber}`); worksheet.getCell(`F${rowNumber}`).value = content[1];
  });
  ["A5", "F5"].forEach((cell) => { worksheet.getCell(cell).font = { bold: true, color: { argb: INVOICE_NAVY } }; worksheet.getCell(cell).fill = { type: "pattern", pattern: "solid", fgColor: { argb: INVOICE_LIGHT_TEAL } }; });
  [5, 6, 8, 9].forEach((row) => { worksheet.getRow(row).height = 20; });
  worksheet.getRow(7).height = recipientAddress ? 40 : 20;

  [["A10:D10", "WEEK/DAYS"], ["E10:F10", "HOURS WORKED"], ["G10:H10", "HOURLY RATE"], ["I10:J10", "AMOUNT (£)"]].forEach(([range, value]) => {
    worksheet.mergeCells(range); const cell = worksheet.getCell(range.split(":")[0]); cell.value = value; cell.style = { ...cellStyle(INVOICE_NAVY), border: { top: strongBorder, left: border, bottom: strongBorder, right: border } }; cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  });
  worksheet.getRow(10).height = 25;

  const firstDataRow = 11;
  const periodStart = new Date(toExcelDate(report.startDate)).getTime();
  sortedRows.forEach((row, index) => {
    const excelRow = firstDataRow + index;
    const rowDate = toExcelDate(row.date);
    const previousDate = index ? toExcelDate(sortedRows[index - 1].date) : "";
    const week = Math.floor((new Date(rowDate).getTime() - periodStart) / 604800000) + 1;
    const previousWeek = previousDate ? Math.floor((new Date(previousDate).getTime() - periodStart) / 604800000) + 1 : 0;
    const hours = invoiceHours(row.performance.workedMinutes, row.performance.invoiceWorkedMinutes);
    worksheet.mergeCells(`A${excelRow}:D${excelRow}`); worksheet.getCell(`A${excelRow}`).value = `${week !== previousWeek ? `WEEK ${week} — ` : ""}${formatWeekday(row.date)} - ${row.user.name}`;
    worksheet.mergeCells(`E${excelRow}:F${excelRow}`); worksheet.getCell(`E${excelRow}`).value = hours;
    worksheet.mergeCells(`G${excelRow}:H${excelRow}`); worksheet.getCell(`G${excelRow}`).value = DEFAULT_HOURLY_RATE;
    worksheet.mergeCells(`I${excelRow}:J${excelRow}`); worksheet.getCell(`I${excelRow}`).value = { formula: `E${excelRow}*G${excelRow}`, result: Number((hours * DEFAULT_HOURLY_RATE).toFixed(2)) };
    const fill = index % 2 === 0 ? INVOICE_LIGHT_GREY : undefined;
    ["A", "E", "G", "I"].forEach((column) => { worksheet.getCell(`${column}${excelRow}`).style = cellStyle(fill); });
    worksheet.getCell(`A${excelRow}`).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    ["E", "G", "I"].forEach((column) => { worksheet.getCell(`${column}${excelRow}`).alignment = { vertical: "middle", horizontal: "center" }; });
    worksheet.getCell(`E${excelRow}`).numFmt = "0.00"; worksheet.getCell(`G${excelRow}`).numFmt = "£#,##0.00"; worksheet.getCell(`I${excelRow}`).numFmt = "£#,##0.00";
    worksheet.getRow(excelRow).height = 24;
  });

  const totalRow = firstDataRow + sortedRows.length;
  const totalHours = Number((sortedRows.reduce((total, row) => total + invoiceHours(row.performance.workedMinutes, row.performance.invoiceWorkedMinutes), 0)).toFixed(2));
  const totalAmount = Number((totalHours * DEFAULT_HOURLY_RATE).toFixed(2));
  worksheet.mergeCells(`A${totalRow}:D${totalRow}`); worksheet.getCell(`A${totalRow}`).value = "TOTAL";
  worksheet.mergeCells(`E${totalRow}:F${totalRow}`); worksheet.getCell(`E${totalRow}`).value = { formula: sortedRows.length ? `SUM(E${firstDataRow}:E${totalRow - 1})` : "0", result: totalHours };
  worksheet.mergeCells(`G${totalRow}:H${totalRow}`); worksheet.getCell(`G${totalRow}`).value = DEFAULT_HOURLY_RATE;
  worksheet.mergeCells(`I${totalRow}:J${totalRow}`); worksheet.getCell(`I${totalRow}`).value = { formula: sortedRows.length ? `SUM(I${firstDataRow}:I${totalRow - 1})` : "0", result: totalAmount };
  ["A", "E", "G", "I"].forEach((column) => { worksheet.getCell(`${column}${totalRow}`).style = { ...cellStyle(INVOICE_LIGHT_TEAL), border: { top: strongBorder, left: border, bottom: strongBorder, right: border } }; worksheet.getCell(`${column}${totalRow}`).font = { bold: true, color: { argb: INVOICE_NAVY } }; });
  worksheet.getCell(`E${totalRow}`).numFmt = "0.00"; worksheet.getCell(`G${totalRow}`).numFmt = "£#,##0.00"; worksheet.getCell(`I${totalRow}`).numFmt = "£#,##0.00";

  worksheet.getRow(totalRow).height = 26;
  const summaryRow = totalRow + 2;
  worksheet.mergeCells(`H${summaryRow}:J${summaryRow}`); worksheet.getCell(`H${summaryRow}`).value = "INVOICE SUMMARY"; worksheet.getCell(`H${summaryRow}`).style = cellStyle(INVOICE_NAVY); worksheet.getCell(`H${summaryRow}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.mergeCells(`A${summaryRow + 1}:F${summaryRow + 1}`); worksheet.getCell(`A${summaryRow + 1}`).value = "Kindly make payment to Advanced Virtual Solutions Ltd using the details below."; worksheet.getCell(`A${summaryRow + 1}`).font = { italic: true, color: { argb: INVOICE_NAVY } };
  worksheet.getCell(`H${summaryRow + 1}`).value = "Billing Period"; worksheet.getCell(`H${summaryRow + 1}`).style = cellStyle(); worksheet.getCell(`H${summaryRow + 1}`).font = { bold: true }; worksheet.mergeCells(`I${summaryRow + 1}:J${summaryRow + 1}`); worksheet.getCell(`I${summaryRow + 1}`).value = billingPeriod; worksheet.getCell(`I${summaryRow + 1}`).style = cellStyle();
  const summaryValues: Array<[string, ExcelJS.CellValue, string]> = [["Total Hours", { formula: `E${totalRow}`, result: totalHours }, "0.00"], ["Hourly Rate", { formula: `G${totalRow}`, result: DEFAULT_HOURLY_RATE }, "£#,##0.00"], ["Tax", 0, "£#,##0.00"], ["Total Due", { formula: `I${totalRow}-I${summaryRow + 4}`, result: totalAmount }, "£#,##0.00"]];
  summaryValues.forEach(([label, value, numFmt], index) => { const row = summaryRow + 2 + index; const emphasis = index === 3; worksheet.getCell(`H${row}`).value = label; worksheet.getCell(`H${row}`).style = cellStyle(emphasis ? INVOICE_LIGHT_TEAL : undefined); worksheet.getCell(`H${row}`).font = { bold: true, color: emphasis ? { argb: INVOICE_NAVY } : undefined }; worksheet.mergeCells(`I${row}:J${row}`); worksheet.getCell(`I${row}`).value = value; worksheet.getCell(`I${row}`).style = cellStyle(emphasis ? INVOICE_LIGHT_TEAL : undefined); worksheet.getCell(`I${row}`).numFmt = numFmt; if (emphasis) worksheet.getCell(`I${row}`).font = { bold: true, color: { argb: INVOICE_NAVY } }; });

  const paymentRow = summaryRow + 7;
  [["Name:", "Advanced Virtual Solutions Ltd"], ["Acc No:", "82440452"], ["Sort Code:", "60-84-64"], ["IBAN:", "GB22 TRWI 6084 6482 4404 52"], ["Swift/BIC:", "TRWIGB2LXXX"], ["Bank name:", "Wise Payments Limited"]].forEach(([label, value], index) => { const row = paymentRow + index + (index >= 3 ? 1 : 0); worksheet.getCell(`A${row}`).value = label; worksheet.getCell(`A${row}`).style = cellStyle(INVOICE_LIGHT_TEAL); worksheet.getCell(`A${row}`).font = { bold: true, color: { argb: INVOICE_NAVY } }; worksheet.mergeCells(`B${row}:F${row}`); worksheet.getCell(`B${row}`).value = value; worksheet.getCell(`B${row}`).style = cellStyle(); worksheet.getCell(`B${row}`).alignment = { vertical: "middle", horizontal: "left" }; });
  worksheet.mergeCells(`G${paymentRow + 4}:J${paymentRow + 4}`); worksheet.getCell(`G${paymentRow + 4}`).value = "TERMS AND CONDITIONS"; worksheet.getCell(`G${paymentRow + 4}`).style = cellStyle(INVOICE_NAVY); worksheet.getCell(`G${paymentRow + 4}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.mergeCells(`G${paymentRow + 5}:J${paymentRow + 8}`); worksheet.getCell(`G${paymentRow + 5}`).value = "Payment is due within 15 days from the invoice date.\nKindly quote the invoice number with your payment.\nPlease contact us within 5 business days if you have any questions regarding this invoice.\nThank you for choosing Advanced Virtual Solutions Ltd."; worksheet.getCell(`G${paymentRow + 5}`).style = cellStyle(INVOICE_LIGHT_GREY); worksheet.getCell(`G${paymentRow + 5}`).alignment = { wrapText: true, vertical: "top", horizontal: "left" }; worksheet.getRow(paymentRow + 5).height = 70;
  worksheet.mergeCells(`A${paymentRow + 10}:J${paymentRow + 10}`); worksheet.getCell(`A${paymentRow + 10}`).value = "ADVANCED VIRTUAL SOLUTIONS LTD  •  Thank you for your business"; worksheet.getCell(`A${paymentRow + 10}`).style = cellStyle(INVOICE_TEAL); worksheet.getCell(`A${paymentRow + 10}`).font = { bold: true, color: { argb: "FFFFFFFF" } }; worksheet.getRow(paymentRow + 10).height = 24;
  return workbook.xlsx.writeBuffer();
}

export default function ExecutionReportPage() {
  const today = dateKey();
  const [token, setToken] = useState<string | null>(null);
  const [report, setReport] = useState<ExecutionReport | null>(null);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [userId, setUserId] = useState("");
  const [hiringManagerId, setHiringManagerId] = useState("");
  const [hiringManagers, setHiringManagers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function setReportDates(start: string, end: string) {
    setStartDate(start);
    setEndDate(end);
  }

  useEffect(() => {
    const savedToken = window.localStorage.getItem("workforce_token");
    if (!savedToken) {
      setError("Sign in as an admin to view execution reports.");
      setLoading(false);
      return;
    }
    setToken(savedToken);
    void loadReport(savedToken, today, today);
  }, []);

  async function loadReport(authToken = token, start = startDate, end = endDate) {
    if (!authToken) return;
    if (end < start) {
      setError("The end date must be on or after the start date.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const currentUser = await apiRequest<User>("/api/auth/me", { token: authToken });
      if (currentUser.role !== "admin") throw new Error("Only admins can view execution reports.");
      const [data, allUsers] = await Promise.all([
        apiRequest<ExecutionReport>(`/api/execution/admin/report?startDate=${start}&endDate=${end}`, { token: authToken }),
        apiRequest<User[]>("/api/auth/users", { token: authToken }),
      ]);
      setReport(data);
      setHiringManagers(
        allUsers
          .filter((user) => user.role === "supervisor" && user.accountStatus !== "pending")
          .sort((left, right) => left.name.localeCompare(right.name))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load execution report.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  const users = useMemo(() => {
    const byId = new Map<string, User>();
    report?.rows.forEach((row) => byId.set(row.user._id, row.user));
    return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [report]);
  const rows = useMemo(() => report?.rows.filter((row) => !userId || row.user._id === userId) || [], [report, userId]);
  const selectedHiringManager = hiringManagers.find((manager) => manager._id === hiringManagerId);

  async function downloadExcel() {
    if (!report || !selectedHiringManager) return;
    const buffer = await buildNativeInvoiceWorkbook(report, rows, selectedHiringManager);
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `avs-invoice-${startDate}-to-${endDate}.xlsx`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return <main className="app-shell execution-report-page">
    <section className="panel">
      <div className="panel-header">
        <div className="panel-title"><ShieldCheck size={20} /><div><h1>Execution Reports</h1><p className="panel-subtitle">Flexible historical adherence and workforce execution reporting</p></div></div>
        <div className="review-actions"><Link className="button secondary" href="/"><Home size={17} />Dashboard</Link><button className="button secondary" type="button" disabled={loading || !token} onClick={() => loadReport()}><RefreshCw size={17} />Refresh</button><button className="button secondary" type="button" disabled={loading || !token} onClick={() => { setReportDates(today, today); void loadReport(token, today, today); }}>Today</button><button className="button" type="button" disabled={!rows.length || !selectedHiringManager} onClick={downloadExcel} title={selectedHiringManager ? "Download invoice" : "Select a hiring manager to bill before downloading"}><Download size={17} />Download Excel</button></div>
      </div>
      <div className="form-grid execution-report-filters">
        <div className="field"><label htmlFor="execution-start">From date</label><input id="execution-start" type="date" value={startDate} onChange={(event) => { const next = event.target.value; setReportDates(next, next > endDate ? next : endDate); }} /></div>
        <div className="field"><label htmlFor="execution-end">To date</label><input id="execution-end" type="date" value={endDate} onChange={(event) => { const next = event.target.value; setReportDates(next < startDate ? next : startDate, next); }} /></div>
        <div className="field"><label htmlFor="execution-user">Team member</label><select id="execution-user" value={userId} onChange={(event) => setUserId(event.target.value)}><option value="">All team members</option>{users.map((user) => <option key={user._id} value={user._id}>{user.name} ({user.email})</option>)}</select></div>
        <div className="field"><label htmlFor="invoice-hiring-manager">Invoice billed to</label><select id="invoice-hiring-manager" value={hiringManagerId} onChange={(event) => setHiringManagerId(event.target.value)} disabled={loading || !hiringManagers.length}><option value="">Select hiring manager</option>{hiringManagers.map((manager) => <option key={manager._id} value={manager._id}>{manager.name} ({manager.email})</option>)}</select></div>
        <button className="button" type="button" disabled={loading} onClick={() => loadReport()}>Apply period</button>
      </div>
    </section>
    {error && <section className="panel"><p className="muted">{error}</p></section>}
    {report && <>
      <section className="metrics admin-metrics report-metrics"><div className="metric"><span>Records</span><strong>{rows.length}</strong></div><div className="metric"><span>Period</span><strong>{formatDate(report.startDate)} - {formatDate(report.endDate)}</strong></div><div className="metric"><span>Avg adherence</span><strong>{report.totals.averageAdherence}%</strong></div><div className="metric"><span>Avg performance</span><strong>{report.totals.averagePerformance}%</strong></div><div className="metric"><span>Work done</span><strong>{report.totals.workedMinutes}m</strong></div><div className="metric"><span>Scheduled</span><strong>{report.totals.scheduledMinutes}m</strong></div></section>
      <section className="panel"><div className="panel-header"><div className="panel-title"><ShieldCheck size={20} /><div><h2>Execution records</h2><p className="panel-subtitle">One row per team member and scheduled activity date</p></div></div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>User</th><th>Status</th><th>Overall</th><th>Adherence</th><th>Worked</th><th>Scheduled</th><th>Breaks</th><th>Late</th><th>Overtime</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.date}-${row.user._id}`}><td>{formatDate(row.date)}</td><td><strong>{row.user.name}</strong><span>{row.user.email}</span></td><td>{row.performance.status}</td><td>{row.performance.overallScore}%</td><td>{row.performance.adherenceScore ?? row.performance.breakdown.activityAdherenceScore ?? 0}%</td><td>{row.performance.workedMinutes}m</td><td>{row.performance.scheduledMinutes}m</td><td>{row.performance.breakMinutes}m</td><td>{row.performance.lateMinutes}m</td><td>{row.performance.overtimeMinutes}m</td></tr>)}</tbody></table>{!loading && !rows.length && <p className="muted">No execution records match this period.</p>}</div></section>
    </>}
  </main>;
}
