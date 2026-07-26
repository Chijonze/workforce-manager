export type InvoiceLineItem = {
  date: string;
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
