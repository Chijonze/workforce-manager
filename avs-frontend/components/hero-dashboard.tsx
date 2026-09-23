"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  CalendarCheck2,
  CheckCheck,
  Clock3,
  TrendingUp,
  Video,
} from "lucide-react";

const weekDays = ["M", "T", "W", "T", "F", "S", "S"];
const calendarDays = [
  { day: 12, state: "past" },
  { day: 13, state: "past" },
  { day: 14, state: "past" },
  { day: 15, state: "today" },
  { day: 16, state: "meeting" },
  { day: 17, state: "future" },
  { day: 18, state: "future" },
];

const tasks = [
  { label: "Inbox triage", progress: 92, tag: "Done daily" },
  { label: "Client report draft", progress: 68, tag: "Due 4pm" },
  { label: "Lead list build", progress: 45, tag: "In progress" },
];

const notifications = [
  { icon: CheckCheck, title: "12 emails answered", detail: "Inbox zero reached", tone: "bg-brand-green" },
  { icon: CalendarCheck2, title: "Meeting scheduled", detail: "Client sync — Thu 10:30", tone: "bg-brand-blue" },
  { icon: Video, title: "Interview confirmed", detail: "Candidate pack prepared", tone: "bg-navy" },
  { icon: Bell, title: "Follow-up sent", detail: "3 leads contacted", tone: "bg-brand-green" },
];

export function HeroDashboard() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % notifications.length);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  const notification = notifications[index];
  const NotificationIcon = notification.icon;

  return (
    <div className="relative mx-auto w-full max-w-[540px]" aria-hidden="true">
      <div className="dashboard-glow absolute -inset-6 rounded-[2.5rem] opacity-70 blur-2xl" />

      <div className="relative rounded-[1.75rem] border border-white/10 bg-white p-4 shadow-soft sm:p-5">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <p className="font-heading text-sm font-bold text-navy">This week at a glance</p>
            <p className="text-xs font-medium text-slate-500">Managed by your dedicated AVS assistant</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-brand-green-dark">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-green opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-green" />
            </span>
            Assistant online
          </span>
        </div>

        <div className="grid gap-4 pt-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-cloud p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">October</p>
              <CalendarCheck2 className="text-brand-blue" size={16} />
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400">
              {weekDays.map((day, i) => (
                <span key={`${day}-${i}`}>{day}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-600">
              {calendarDays.map(({ day, state }) => (
                <span
                  className={
                    state === "today"
                      ? "grid aspect-square place-items-center rounded-lg bg-brand-blue text-white"
                      : state === "meeting"
                        ? "grid aspect-square place-items-center rounded-lg bg-brand-blue/15 text-brand-blue-dark"
                        : "grid aspect-square place-items-center rounded-lg"
                  }
                  key={day}
                >
                  {day}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Task progress</p>
              <TrendingUp className="text-brand-green" size={16} />
            </div>
            <ul className="mt-3 grid gap-3">
              {tasks.map((task) => (
                <li key={task.label}>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                    <span>{task.label}</span>
                    <span className="text-slate-400">{task.tag}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-green"
                      initial={{ width: 0 }}
                      animate={{ width: `${task.progress}%` }}
                      transition={{ duration: 1.1, ease: "easeOut", delay: 0.3 }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[1.2fr_1fr]">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-cloud p-4">
            <div className="relative">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-navy font-heading text-sm font-bold text-white">
                SO
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-brand-green" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-heading text-sm font-bold text-navy">Sarah O. — Dedicated VA</p>
              <p className="text-xs font-medium text-slate-500">Executive assistance · UK/EU hours</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-3 text-center">
              <Clock3 className="mx-auto text-brand-blue" size={16} />
              <p className="mt-1 font-heading text-lg font-extrabold text-navy">22.5</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Hrs saved</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-3 text-center">
              <CheckCheck className="mx-auto text-brand-green" size={16} />
              <p className="mt-1 font-heading text-lg font-extrabold text-navy">46</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Tasks done</p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -right-4 -top-10 w-64 sm:-right-10">
        <AnimatePresence mode="wait">
          <motion.div
            animate={{ y: [0, -6, 0] }}
            key={index}
            transition={{ duration: 3.2, ease: "easeInOut" }}
            className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-card"
          >
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white ${notification.tone}`}>
              <NotificationIcon size={16} />
            </span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35 }}
                className="min-w-0"
              >
                <p className="truncate text-xs font-bold text-navy">{notification.title}</p>
                <p className="truncate text-[11px] font-medium text-slate-500">{notification.detail}</p>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>

      <motion.div
        animate={{ y: [0, 7, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-8 -left-4 hidden w-60 rounded-2xl border border-slate-100 bg-white p-3 shadow-card sm:block lg:-left-12"
      >
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Weekly report</p>
        <p className="mt-1 text-xs font-semibold text-navy">
          Client approved this week&apos;s deliverables ✅
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-[86%] rounded-full bg-brand-green" />
        </div>
      </motion.div>
    </div>
  );
}
