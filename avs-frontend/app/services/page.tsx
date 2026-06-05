import Link from "next/link";
import { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { PageFrame } from "@/components/page-frame";
import { MotionSection } from "@/components/motion-section";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { services, assistantProfiles, qualitySignals, faqs } from "@/lib/site-content";
import { FAQAccordion } from "@/components/faq-accordion";

export const metadata: Metadata = {
  title: "Services",
  description: "Explore comprehensive virtual assistant services for admin, executive support, customer support, social media, CRM, lead generation, and operations.",
};

export default function ServicesPage() {
  return (
    <PageFrame
      eyebrow="Services"
      title="Comprehensive virtual assistant services tailored to your business."
      summary="From daily operations to growth initiatives, we provide specialized support across eight key service areas. Each role is handled by trained professionals with proven expertise."
    >
      {/* Service Categories Overview */}
      <section className="section-shell py-20">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-2">
          <div className="space-y-4">
            <h3 className="font-heading text-2xl font-bold text-slate-950">Operations & Support</h3>
            <p className="text-slate-600">Keep your business running smoothly with dedicated support for daily operations, administrative tasks, and customer interactions.</p>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span><strong>Administrative Support:</strong> Inbox management, scheduling, documentation, research</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span><strong>Customer Support:</strong> Email, chat, and CRM management for faster response times</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span><strong>Project Coordination:</strong> Task tracking, status updates, and workflow management</span>
              </li>
            </ul>
          </div>
          <div className="space-y-4">
            <h3 className="font-heading text-2xl font-bold text-slate-950">Growth & Content</h3>
            <p className="text-slate-600">Scale your business with support for marketing, sales, and content initiatives handled by dedicated professionals.</p>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span><strong>Lead Generation:</strong> Prospecting, outreach, CRM hygiene, and pipeline management</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span><strong>Social Media Management:</strong> Scheduling, engagement, community support</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span><strong>Content Creation:</strong> Blog drafts, captions, newsletters, and design support</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* All Services Grid */}
      <MotionSection className="section-shell py-20 border-t border-slate-200">
        <div className="mb-12 text-center">
          <h2 className="font-heading text-3xl font-bold text-slate-950">All Available Services</h2>
          <p className="mt-3 text-slate-600">Complete list of specialized support we offer</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <Card key={service.title} className="group transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-soft">
                <Icon className="text-blue-600" size={28} />
                <h3 className="mt-5 font-heading text-lg font-bold text-slate-950">{service.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{service.description}</p>
              </Card>
            );
          })}
        </div>
      </MotionSection>

      {/* VA Profiles */}
      <section className="section-shell border-t border-slate-200 py-20">
        <div className="mb-12">
          <h2 className="font-heading text-3xl font-bold text-slate-950">Virtual Assistant Profiles</h2>
          <p className="mt-3 text-slate-600">We match you with specialists based on your specific needs and workflow requirements.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {assistantProfiles.map((profile) => {
            const Icon = profile.icon;
            return (
              <div key={profile.name} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <Icon className="text-blue-600" size={32} />
                <h3 className="mt-4 font-heading text-xl font-bold text-slate-950">{profile.name}</h3>
                <p className="mt-2 text-sm text-slate-600">Focus: {profile.focus}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Quality Signals */}
      <section className="section-shell border-t border-slate-200 py-20">
        <div className="mb-12">
          <h2 className="font-heading text-3xl font-bold text-slate-950">Why Our Services Stand Out</h2>
          <p className="mt-3 text-slate-600">Professional quality and dedicated support across every service we provide.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {qualitySignals.map((signal) => {
            const Icon = signal.icon;
            return (
              <div key={signal.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <Icon className="text-blue-600" size={24} />
                <strong className="mt-4 block font-heading text-base text-slate-950">{signal.label}</strong>
              </div>
            );
          })}
        </div>
      </section>

      {/* Service Use Cases */}
      <section className="section-shell border-t border-slate-200 py-20">
        <div className="mb-12">
          <h2 className="font-heading text-3xl font-bold text-slate-950">Common Service Combinations</h2>
          <p className="mt-3 text-slate-600">Most clients use multiple services based on their business needs.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h3 className="font-heading text-lg font-bold text-slate-950">For Founders & Executives</h3>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p>• Executive Assistance</p>
              <p>• Administrative Support</p>
              <p>• Lead Generation</p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h3 className="font-heading text-lg font-bold text-slate-950">For eCommerce & Agencies</h3>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p>• Customer Support</p>
              <p>• Content Creation</p>
              <p>• Social Media Management</p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h3 className="font-heading text-lg font-bold text-slate-950">For Growth Teams</h3>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p>• Lead Generation</p>
              <p>• Project Coordination</p>
              <p>• Website Management</p>
            </div>
          </div>
        </div>
      </section>

      {/* Service Benefits */}
      <section className="section-shell border-t border-slate-200 py-20">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="font-heading text-3xl font-bold text-slate-950">What You Get With Every Service</h2>
            <p className="mt-4 text-slate-600">Beyond task completion, you receive structured support and ongoing optimization.</p>
            <div className="mt-8 space-y-4">
              <div>
                <h4 className="font-semibold text-slate-950">Dedicated Point of Contact</h4>
                <p className="mt-1 text-sm text-slate-600">Your VA becomes familiar with your business, processes, and preferences for seamless execution.</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-950">Clear Communication Protocols</h4>
                <p className="mt-1 text-sm text-slate-600">We establish agreed channels (Slack, email, Zoom) and frequency to keep everything aligned.</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-950">Weekly Reporting & Tracking</h4>
                <p className="mt-1 text-sm text-slate-600">You always know what's being handled and what's completed with transparent task documentation.</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-950">Continuous Optimization</h4>
                <p className="mt-1 text-sm text-slate-600">We refine processes based on results and feedback to maximize your team's productivity.</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8">
            <h3 className="font-heading text-xl font-bold text-slate-950">Service Specifications</h3>
            <div className="mt-6 space-y-4 text-sm text-slate-600">
              <div>
                <span className="font-semibold text-slate-950">Hours:</span> <br />
                UK/EU business hours with flexibility for urgent tasks
              </div>
              <div>
                <span className="font-semibold text-slate-950">Tools:</span> <br />
                We work with your existing tools: Slack, HubSpot, Shopify, Notion, Asana, Trello, Google Workspace, and more
              </div>
              <div>
                <span className="font-semibold text-slate-950">Flexibility:</span> <br />
                Single service or mixed support across multiple categories
              </div>
              <div>
                <span className="font-semibold text-slate-950">Training:</span> <br />
                5-day typical onboarding with clear handover documentation
              </div>
              <div>
                <span className="font-semibold text-slate-950">Billing:</span> <br />
                Hourly rates with transparent tracking and reporting
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ About Services */}
      <section className="section-shell border-t border-slate-200 py-20">
        <div className="mb-12">
          <h2 className="font-heading text-3xl font-bold text-slate-950">Service FAQs</h2>
        </div>
        <div className="max-w-3xl">
          <FAQAccordion items={faqs} />
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-shell border-t border-slate-200 py-20">
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-blue-50 to-slate-50 p-8 text-center md:p-12">
          <h2 className="font-heading text-3xl font-bold text-slate-950">Ready to get started?</h2>
          <p className="mt-3 text-slate-600">Tell us about your business and let's find the right VA support for your needs.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button asChild size="lg">
              <Link href="/hire">
                Get Started
                <ArrowRight size={18} />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/contact">Book Free Consultation</Link>
            </Button>
          </div>
        </div>
      </section>
    </PageFrame>
  );
}
