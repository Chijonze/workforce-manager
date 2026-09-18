"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Clock3,
  ExternalLink,
  Gauge,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Monitor,
  MousePointer2,
  RefreshCw,
  ScanEye,
  UserRound,
  Users,
} from "lucide-react";
import type { User } from "@/types/workforce";
import { formatRole } from "./shared";

export type SectionKey =
  | "overview"
  | "scheduling"
  | "my-shift"
  | "screen-monitor"
  | "activity-monitoring"
  | "leave"
  | "chat"
  | "accounts"
  | "profile";

export type NavItem = {
  key: SectionKey | "link:assignments" | "link:execution-report";
  label: string;
  icon: React.ComponentType<{ size?: number | string }>;
  description?: string;
  href?: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export function navGroupsForRole(role: User["role"]): NavGroup[] {
  if (role === "admin") {
    return [
      {
        label: "Overview",
        items: [
          { key: "overview", label: "Execution Overview", icon: LayoutDashboard, description: "Team performance today" },
          { key: "my-shift", label: "My Shift", icon: Clock3, description: "Personal attendance" },
        ],
      },
      {
        label: "Scheduling",
        items: [
          { key: "scheduling", label: "Scheduling Setup", icon: CalendarDays, description: "Templates and assignment" },
          { key: "link:assignments", label: "Assignments", icon: CalendarRange, href: "/assignments" },
          { key: "link:execution-report", label: "Execution Reports", icon: BarChart3, href: "/execution-report" },
        ],
      },
      {
        label: "Monitoring",
        items: [
          { key: "screen-monitor", label: "Live Screen Monitor", icon: Monitor, description: "On-demand live view" },
          { key: "activity-monitoring", label: "Activity Monitoring", icon: MousePointer2, description: "Mouse data and screenshots" },
        ],
      },
      {
        label: "Administration",
        items: [
          { key: "accounts", label: "Users & Access", icon: Users, description: "Accounts and allocation" },
          { key: "leave", label: "Leave Management", icon: ClipboardList, description: "Approvals" },
          { key: "chat", label: "Team Chat", icon: MessageSquare },
        ],
      },
    ];
  }

  if (role === "supervisor") {
    return [
      {
        label: "Overview",
        items: [
          { key: "overview", label: "Team Overview", icon: LayoutDashboard, description: "Assigned agents today" },
        ],
      },
      {
        label: "Monitoring",
        items: [
          { key: "screen-monitor", label: "Live Screen Monitor", icon: Monitor, description: "On-demand live view" },
          { key: "activity-monitoring", label: "Activity Monitoring", icon: MousePointer2, description: "Mouse data and screenshots" },
        ],
      },
      {
        label: "Workspace",
        items: [
          { key: "chat", label: "Team Chat", icon: MessageSquare },
          { key: "profile", label: "My Profile", icon: UserRound, description: "Billing details" },
        ],
      },
    ];
  }

  return [
    {
      label: "My Work",
      items: [
        { key: "my-shift", label: "My Shift", icon: Clock3, description: "Clock in and track activity" },
      ],
    },
    {
      label: "Schedule",
      items: [
        { key: "overview", label: "My Schedule", icon: CalendarDays, description: "Calendar and assignments" },
      ],
    },
    {
      label: "Workspace",
      items: [
        { key: "leave", label: "Leave Requests", icon: ClipboardList },
        { key: "chat", label: "Team Chat", icon: MessageSquare },
      ],
    },
  ];
}

type ShellProps = {
  user: User;
  activeSection: SectionKey;
  onNavigate: (section: SectionKey) => void;
  onRefresh: () => void;
  onLogout: () => void;
  onRequestMfa: () => void;
  children: React.ReactNode;
};

export function DashboardShell({ user, activeSection, onNavigate, onRefresh, onLogout, onRequestMfa, children }: ShellProps) {
  const groups = navGroupsForRole(user.role);
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeGroup = groups.find((group) => group.items.some((item) => item.key === activeSection));
  const activeItem = activeGroup?.items.find((item) => item.key === activeSection);

  const handleNavigate = (key: NavItem["key"]) => {
    setMobileOpen(false);
    if (key.startsWith("link:")) return;
    onNavigate(key as SectionKey);
  };

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">
            <Activity size={20} />
          </div>
          <div>
            <h1>ShiftSync</h1>
            <p>Workforce Manager</p>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Dashboard sections">
          {groups.map((group) => (
            <div className="sidebar-group" key={group.label}>
              <span className="sidebar-group-label">{group.label}</span>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.key === activeSection;

                if (item.href) {
                  return (
                    <Link className="sidebar-item" href={item.href} key={item.key} onClick={() => setMobileOpen(false)}>
                      <Icon size={17} />
                      <span className="sidebar-item-text">
                        <strong>{item.label}</strong>
                        <span>Opens in a new page <ExternalLink size={11} /></span>
                      </span>
                    </Link>
                  );
                }

                return (
                  <button
                    aria-current={isActive ? "page" : undefined}
                    className={`sidebar-item ${isActive ? "active" : ""}`}
                    key={item.key}
                    type="button"
                    onClick={() => handleNavigate(item.key)}
                  >
                    <Icon size={17} />
                    <span className="sidebar-item-text">
                      <strong>{item.label}</strong>
                      {item.description && <span>{item.description}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="sidebar-user-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
            <span className="sidebar-user-text">
              <strong>{user.name}</strong>
              <span className={`pill ${user.role === "admin" ? "" : ""}`}>{formatRole(user.role)}</span>
            </span>
          </div>
          <div className="sidebar-footer-actions">
            {user.role !== "supervisor" && (
              <button className="button secondary compact" type="button" onClick={onRequestMfa}>
                <KeyRound size={15} />
                {user.mfaEnabled ? "Reset MFA" : "Set up MFA"}
              </button>
            )}
            <button className="button secondary compact" type="button" onClick={onLogout}>
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}

      <div className="app-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              aria-label="Toggle navigation"
              className="icon-button secondary sidebar-toggle"
              type="button"
              onClick={() => setMobileOpen((current) => !current)}
            >
              <ScanEye size={17} />
            </button>
            <div className="topbar-heading">
              <h2>{activeItem?.label || "Dashboard"}</h2>
              <p>{activeGroup?.label || "Workforce"} · {formatRole(user.role)} workspace</p>
            </div>
          </div>

          <div className="user-strip">
            <span className="pill success-pill">
              <Gauge size={13} />
              {user.name}
            </span>
            <button aria-label="Refresh data" className="icon-button secondary" title="Refresh" type="button" onClick={onRefresh}>
              <RefreshCw size={16} />
            </button>
          </div>
        </header>

        <div className="page">{children}</div>
      </div>
    </main>
  );
}
