export type InvoiceLineItem = {
  date: string;
  week: number;
  weekRange: string;
  dayLabel: string;
  description: string;
  hours: number;
  rate: number;
};

export type InvoiceData = {
  logoText: string;
  logoSrc?: string;
  invoiceNumber: string;
  invoiceDate: string;
  billingPeriod: string;
  fromName: string;
  fromAddress: string;
  toName: string;
  toAddress: string;
  items: InvoiceLineItem[];
  terms: string;
};
