"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { faqs } from "@/lib/site-content";

export function FAQAccordion() {
  return (
    <Accordion.Root className="grid gap-3" type="single" collapsible>
      {faqs.map((item, index) => (
        <Accordion.Item
          className="rounded-2xl border border-slate-200 bg-white px-5 shadow-sm"
          value={`item-${index}`}
          key={item.question}
        >
          <Accordion.Header>
            <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 py-5 text-left font-heading text-base font-semibold text-slate-950">
              {item.question}
              <ChevronDown className="shrink-0 transition group-data-[state=open]:rotate-180" size={18} />
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
