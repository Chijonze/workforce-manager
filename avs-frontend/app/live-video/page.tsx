import { Suspense } from "react";
import { AgentVideoPanel } from "@/components/agent-video-panel";

export const metadata = {
  title: "AVS Live Video",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LiveVideoPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-950" />}>
      <AgentVideoPanel />
    </Suspense>
  );
}
