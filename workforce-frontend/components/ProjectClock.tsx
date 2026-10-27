"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { BUSINESS_TIME_ZONE } from "./shared";

// Live clock for the zone the whole project runs on (Europe/London by
// default, configurable via NEXT_PUBLIC_BUSINESS_TIME_ZONE). It sits in the
// dashboard topbar so admins, supervisors and workers always see the exact
// time shift templates and clock-in windows are evaluated against.
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const zoneFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  timeZoneName: "short",
});

export function ProjectClock() {
  // Starts null so the server-rendered markup and the first client render
  // match; the real time appears the moment the component mounts.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const zoneName = now
    ? zoneFormatter.format(now).replace(/^.*?,\s?/, "")
    : "—";

  return (
    <div
      className="project-clock"
      title={`Project time — ${BUSINESS_TIME_ZONE}. Shift templates and clock-in windows run on this zone.`}
    >
      <Clock3 size={16} />
      <span className="project-clock-time">
        {now ? timeFormatter.format(now) : "--:--:--"}
      </span>
      <span className="project-clock-meta">
        <span>
          {zoneName} · {BUSINESS_TIME_ZONE}
        </span>
        <span>{now ? dateFormatter.format(now) : "…"}</span>
      </span>
    </div>
  );
}
