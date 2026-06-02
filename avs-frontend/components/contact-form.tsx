"use client";

import { useForm, ValidationError } from "@formspree/react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ContactForm() {
  const [state, handleSubmit] = useForm("xlgvqqre", {
    data: {
      form_type: "Contact inquiry",
    },
  });

  if (state.succeeded) {
    return (
      <div className="mt-6 flex items-start gap-3 rounded-2xl bg-blue-50 p-4 text-blue-800">
        <CheckCircle2 className="mt-0.5 shrink-0" size={20} />
        <div>
          <h3 className="font-heading text-xl font-bold text-slate-950">Thanks for reaching out!</h3>
          <p className="mt-2 text-sm text-slate-700">We received your message and will follow up by email.</p>
        </div>
      </div>
    );
  }

  return (
    <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
      <input name="full_name" placeholder="Full name" />
      <input name="email" placeholder="Work email" required type="email" />
      <input name="company" placeholder="Company" />
      <input name="service_interest" placeholder="Service interest" />
      <textarea className="sm:col-span-2" name="message" placeholder="Tell us what you need help with" required rows={5} />
      <ValidationError className="text-sm font-semibold text-red-600 sm:col-span-2" prefix="Email" field="email" errors={state.errors} />
      <ValidationError className="text-sm font-semibold text-red-600 sm:col-span-2" prefix="Message" field="message" errors={state.errors} />
      <ValidationError className="text-sm font-semibold text-red-600 sm:col-span-2" errors={state.errors} />
      <Button className="sm:col-span-2" type="submit" disabled={state.submitting}>
        {state.submitting ? "Submitting..." : "Submit inquiry"}
      </Button>
    </form>
  );
}
