"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { faqs } from "@/lib/site-content";

export function FAQAccordion({ items = faqs }: { items?: typeof faqs }) {
  return (
    <Accordion.Root className="grid gap-3" type="single" collapsible>
      {items.map((item, index) => (
        <Accordion.Item
          className="rounded-2xl border border-slate-200 bg-white px-5 shadow-sm transition data-[state=open]:border-brand-blue/30 data-[state=open]:shadow-card"
          value={`item-${index}`}
          key={item.question}
        >
          <Accordion.Header>
            <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 py-5 text-left font-heading text-base font-semibold text-navy">
              {item.question}
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cloud transition group-data-[state=open]:bg-brand-blue group-data-[state=open]:text-white">
                <ChevronDown className="transition duration-200 group-data-[state=open]:rotate-180" size={16} />
              </span>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden pb-5 text-sm leading-6 text-slate-600 data-[state=closed]:animate-none">
            {item.answer}
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
