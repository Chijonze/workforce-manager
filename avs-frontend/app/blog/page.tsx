import { Metadata } from "next";
import { PageFrame } from "@/components/page-frame";
import { Card } from "@/components/ui/card";
import { blogPosts } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Blog",
  description: "Productivity tips, delegation strategies, remote work insights, automation guides, and virtual assistant resources.",
};

export default function BlogPage() {
  return (
    <PageFrame
      eyebrow="Blog"
      title="Practical ideas for delegation, automation, and remote team productivity."
      summary="A growing resource library for entrepreneurs and operators who want to scale without operational chaos."
    >
      <section className="section-shell grid gap-5 py-20 md:grid-cols-3">
        {blogPosts.map((post) => (
          <Card key={post.title}>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">{post.category}</span>
            <h2 className="mt-4 font-heading text-xl font-bold text-slate-950">{post.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{post.excerpt}</p>
          </Card>
        ))}
      </section>
    </PageFrame>
  );
}
