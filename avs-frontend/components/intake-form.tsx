"use client";

import type { ChangeEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import { useForm, ValidationError } from "@formspree/react";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { services } from "@/lib/site-content";

const budgets = ["4.50/hr", "Custom enterprise"];
const timelines = ["This week", "Within 2 weeks", "This month", "Still exploring"];
type FormFieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type FieldBinding = {
  name: string;
  value: string;
  onChange: (event: ChangeEvent<FormFieldElement>) => void;
};

export function IntakeForm({ mode = "client" }: { mode?: "client" | "career" }) {
  const [step, setStep] = useState(0);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [state, handleSubmit] = useForm("xlgvqqre");

  const steps = useMemo(
    () =>
      mode === "career"
        ? ["Profile", "Skills", "Availability", "Submit"]
        : ["Business", "Support Needs", "Budget", "Book"],
    [mode]
  );
  const isLastStep = step === steps.length - 1;

  function bindField(name: string): FieldBinding {
    return {
      name,
      value: formValues[name] ?? "",
      onChange: (event) => setFormValues((current) => ({ ...current, [name]: event.target.value })),
    };
  }

  function toggleService(service: string) {
    setSelectedServices((current) =>
      current.includes(service) ? current.filter((item) => item !== service) : [...current, service]
    );
  }

  async function submitToFormspree(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isLastStep) {
      setStep((s) => Math.min(steps.length - 1, s + 1));
      return;
    }

    await handleSubmit({
      ...formValues,
      form_type: mode === "career" ? "VA application" : "Client hire inquiry",
      selected_services: selectedServices.join(", "),
    });
  }

  if (state.succeeded) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex items-start gap-3 rounded-2xl bg-blue-50 p-4 text-blue-800">
          <CheckCircle2 className="mt-0.5 shrink-0" size={20} />
          <div>
            <h2 className="font-heading text-2xl font-bold text-slate-950">Thanks for joining!</h2>
            <p className="mt-2 text-sm text-slate-700">We received your details and will follow up by email.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft" onSubmit={submitToFormspree}>
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
        <CareerStep step={step} selectedServices={selectedServices} onToggle={toggleService} bindField={bindField} />
      ) : (
        <ClientStep step={step} selectedServices={selectedServices} onToggle={toggleService} bindField={bindField} />
      )}

      <ValidationError className="mt-4 text-sm font-semibold text-red-600" prefix="Email" field="email" errors={state.errors} />
      <ValidationError className="mt-4 text-sm font-semibold text-red-600" prefix="Message" field="message" errors={state.errors} />
      <ValidationError className="mt-4 text-sm font-semibold text-red-600" errors={state.errors} />

      <div className="mt-6 flex flex-wrap justify-between gap-3">
        <Button variant="secondary" type="button" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          <ArrowLeft size={16} />
          Back
        </Button>
        <Button type={isLastStep ? "submit" : "button"} disabled={state.submitting} onClick={() => !isLastStep && setStep((s) => Math.min(steps.length - 1, s + 1))}>
          {isLastStep ? (
            <>
              <CheckCircle2 size={16} />
              {state.submitting ? "Submitting..." : "Submit"}
            </>
          ) : (
            <>
              Continue
              <ArrowRight size={16} />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function ClientStep({
  bindField,
  onToggle,
  selectedServices,
  step,
}: {
  step: number;
  selectedServices: string[];
  onToggle: (service: string) => void;
  bindField: (name: string) => FieldBinding;
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
        <SelectLike placeholder="Starting budget" items={budgets} {...bindField("budget")} />
        <SelectLike placeholder="Timeline" items={timelines} {...bindField("timeline")} />
      </FormGrid>
    );
  }

  if (step === 3) {
    return (
      <FormGrid title="Book your discovery call">
        <input placeholder="Preferred date" type="date" {...bindField("preferred_date")} />
        <input placeholder="Best email" type="email" required {...bindField("email")} />
        <textarea className="sm:col-span-2" placeholder="Anything else we should know?" rows={4} {...bindField("message")} />
      </FormGrid>
    );
  }

  return (
    <FormGrid title="Tell us about your business">
      <input placeholder="Full name" {...bindField("full_name")} />
      <input placeholder="Work email" type="email" required {...bindField("email")} />
      <input placeholder="Company or brand" {...bindField("company")} />
      <input placeholder="Website" {...bindField("website")} />
    </FormGrid>
  );
}

function CareerStep({
  bindField,
  onToggle,
  selectedServices,
  step,
}: {
  step: number;
  selectedServices: string[];
  onToggle: (service: string) => void;
  bindField: (name: string) => FieldBinding;
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
        <input placeholder="Years of experience" {...bindField("years_of_experience")} />
        <input placeholder="Weekly available hours" {...bindField("weekly_available_hours")} />
        <textarea className="sm:col-span-2" placeholder="Tools you use confidently" rows={4} {...bindField("tools")} />
      </FormGrid>
    );
  }

  if (step === 3) {
    return (
      <FormGrid title="Submit your application">
        <input placeholder="Portfolio or LinkedIn URL" {...bindField("portfolio_url")} />
        <input placeholder="Expected hourly rate" {...bindField("expected_hourly_rate")} />
        <textarea className="sm:col-span-2" placeholder="Why would clients trust you with their operations?" rows={4} {...bindField("message")} />
      </FormGrid>
    );
  }

  return (
    <FormGrid title="Start your VA application">
      <input placeholder="Full name" {...bindField("full_name")} />
      <input placeholder="Email address" type="email" required {...bindField("email")} />
      <input placeholder="Country" {...bindField("country")} />
      <input placeholder="Primary role" {...bindField("primary_role")} />
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

function SelectLike({ items, placeholder, ...fieldProps }: { items: string[]; placeholder: string } & FieldBinding) {
  return (
    <select {...fieldProps}>
      <option value="" disabled>
        {placeholder}
      </option>
      {items.map((item) => (
        <option key={item}>{item}</option>
      ))}
    </select>
  );
}
