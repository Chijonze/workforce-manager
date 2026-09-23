import { CheckCircle2 } from "lucide-react";
import { announcementPoints } from "@/lib/site-content";

export function AnnouncementBar() {
  return (
    <div className="bg-navy text-white">
      <div className="section-shell flex flex-wrap items-center justify-center gap-x-8 gap-y-1 py-2 text-xs font-semibold sm:text-sm">
        {announcementPoints.map((point) => (
          <span className="inline-flex items-center gap-2" key={point}>
            <CheckCircle2 className="text-brand-green" size={15} aria-hidden="true" />
            {point}
          </span>
        ))}
      </div>
    </div>
  );
}
