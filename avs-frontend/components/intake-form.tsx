"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { services } from "@/lib/site-content";

const budgets = ["$299 Starter", "$599 Growth", "$999 Executive", "Custom enterprise"];
const timelines = ["This week", "Within 2 weeks", "This month", "Still exploring"];

export function IntakeForm({ mode = "client" }: { mode?: "client" | "career" }) {
  const [step, setStep] = useState(0);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const steps = useMemo(
    () =>
      mode === "career"
        ? ["Profile", "Skills", "Availability", "Submit"]
        : ["Business", "Support Needs", "Budget", "Book"],
    [mode]
  );

  function toggleService(service: string) {
    setSelectedServices((current) =>
      current.includes(service) ? current.filter((item) => item !== service) : [...current, service]
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="mb-6 grid grid-cols-4 gap-2">
        {steps.map((item, index) => (
          <div
            className={`h-2 rounded-full ${index <= step ? "bg-blue-600" : "bg-slate-200"}`}
            key={item}
            aria-label={item}
          />
        ))}
      </div>

      {mode === "career" ? (
        <CareerStep step={step} selectedServices={selectedServices} onToggle={toggleService} />
      ) : (
        <ClientStep step={step} selectedServices={selectedServices} onToggle={toggleService} />
      )}

      <div className="mt-6 flex flex-wrap justify-between gap-3">
        <Button variant="secondary" type="button" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          <ArrowLeft size={16} />
          Back
        </Button>
        <Button type="button" onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}>
          {step === steps.length - 1 ? (
            <>
              <CheckCircle2 size={16} />
              Submit
            </>
          ) : (
            <>
              Continue
              <ArrowRight size={16} />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function ClientStep({
  onToggle,
  selectedServices,
  step,
}: {
  step: number;
  selectedServices: string[];
  onToggle: (service: string) => void;
}) {
  if (step === 1) {
    return (
      <div>
        <h2 className="font-heading text-2xl font-bold text-slate-950">Which support do you need?</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {services.slice(0, 8).map((service) => (
            <button
              className={`rounded-2xl border p-4 text-left text-sm font-semibold transition ${
                selectedServices.includes(service.title)
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-200"
              }`}
              key={service.title}
              type="button"
              onClick={() => onToggle(service.title)}
            >
              {service.title}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <FormGrid title="Choose a starting budget">
        <SelectLike items={budgets} />
        <SelectLike items={timelines} />
      </FormGrid>
    );
  }

  if (step === 3) {
    return (
      <FormGrid title="Book your discovery call">
        <input placeholder="Preferred date" type="date" />
        <input placeholder="Best email" type="email" />
        <textarea className="sm:col-span-2" placeholder="Anything else we should know?" rows={4} />
      </FormGrid>
    );
  }

  return (
    <FormGrid title="Tell us about your business">
      <input placeholder="Full name" />
      <input placeholder="Work email" type="email" />
      <input placeholder="Company or brand" />
      <input placeholder="Website" />
    </FormGrid>
  );
}

function CareerStep({
  onToggle,
  selectedServices,
  step,
}: {
  step: number;
  selectedServices: string[];
  onToggle: (service: string) => void;
}) {
  if (step === 1) {
    return (
      <div>
        <h2 className="font-heading text-2xl font-bold text-slate-950">Select your strongest skills</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {services.slice(0, 8).map((service) => (
            <button
              className={`rounded-2xl border p-4 text-left text-sm font-semibold transition ${
                selectedServices.includes(service.title)
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-200"
              }`}
              key={service.title}
              type="button"
              onClick={() => onToggle(service.title)}
            >
              {service.title}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <FormGrid title="Availability and experience">
        <input placeholder="Years of experience" />
        <input placeholder="Weekly available hours" />
        <textarea className="sm:col-span-2" placeholder="Tools you use confidently" rows={4} />
      </FormGrid>
    );
  }

  if (step === 3) {
    return (
      <FormGrid title="Submit your application">
        <input placeholder="Portfolio or LinkedIn URL" />
        <input placeholder="Expected hourly rate" />
        <textarea className="sm:col-span-2" placeholder="Why would clients trust you with their operations?" rows={4} />
      </FormGrid>
    );
  }

  return (
    <FormGrid title="Start your VA application">
      <input placeholder="Full name" />
      <input placeholder="Email address" type="email" />
      <input placeholder="Country" />
      <input placeholder="Primary role" />
    </FormGrid>
  );
}

function FormGrid({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div>
      <h2 className="font-heading text-2xl font-bold text-slate-950">{title}</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function SelectLike({ items }: { items: string[] }) {
  return (
    <select>
      {items.map((item) => (
        <option key={item}>{item}</option>
      ))}
    </select>
  );
}
