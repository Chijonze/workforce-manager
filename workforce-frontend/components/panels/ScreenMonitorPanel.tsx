"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Maximize2, Minimize2, Monitor, X } from "lucide-react";
import type { ScreenMonitorActivity, ScreenMonitorEmployee } from "@/types/workforce";

function getMonitorOptionValue(employee: ScreenMonitorEmployee) {
  return employee.activeMonitorId || employee.email || employee.id;
}

function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  return initials || "?";
}

function formatActivitySince(since?: string) {
  if (!since) return "";

  const date = new Date(since);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const activityChipClass: Record<string, string> = {
  available: "is-available",
  break: "is-break",
  lunch: "is-break",
  meeting: "is-meeting",
  training: "is-meeting",
  after_call_work: "is-acw",
  ended_shift: "is-ended",
  not_clocked_in: "is-unclocked",
};

function getActivityChipClass(activity: ScreenMonitorActivity) {
  return activityChipClass[activity.state] || "is-unclocked";
}

function ActivityChip({ activity }: { activity: ScreenMonitorActivity | null | undefined }) {
  if (!activity) return null;

  return (
    <span className={`status-chip ${getActivityChipClass(activity)}`}>
      <i aria-hidden="true" className="chip-dot" />
      {activity.label}
    </span>
  );
}

type StatusSummary = {
  tone: "online" | "available" | "break" | "offline";
  label: string;
  count: number;
};

function buildStatusSummary(employees: ScreenMonitorEmployee[]): StatusSummary[] {
  const online = employees.filter((employee) => employee.isOnline);
  const onBreak = online.filter(
    (employee) =>
      employee.activity &&
      (employee.activity.state === "break" || employee.activity.state === "lunch")
  );
  const available = online.filter(
    (employee) =>
      !employee.activity ||
      employee.activity.state === "available" ||
      employee.activity.state === "after_call_work"
  );

  return [
    { tone: "online", label: "Online", count: online.length },
    { tone: "available", label: "Available", count: available.length },
    { tone: "break", label: "On break", count: onBreak.length },
    { tone: "offline", label: "Offline", count: employees.length - online.length },
  ];
}

export default function ScreenMonitorPanel({
  canvasRef,
  employees,
  isMonitoring,
  onChangeEmployee,
  onStart,
  onStop,
  selectedEmployeeId,
  status,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  employees: ScreenMonitorEmployee[];
  isMonitoring: boolean;
  selectedEmployeeId: string;
  status: string;
  onChangeEmployee: (employeeId: string) => void;
  onStart: () => void;
  onStop: () => void;
}) {
  const selectedEmployee = employees.find(
    (employee) => getMonitorOptionValue(employee) === selectedEmployeeId
  );
  const canMonitor = Boolean(selectedEmployee?.isOnline && selectedEmployee.activeMonitorId);
  const sectionRef = useRef<HTMLElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const optionListRef = useRef<HTMLUListElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const statusSummary = useMemo(() => buildStatusSummary(employees), [employees]);
  const selectedActivity = selectedEmployee?.activity ?? null;
  const pickerDisabled = isMonitoring || employees.length === 0;

  useEffect(() => {
    function syncFullscreenState() {
      setIsFullscreen(document.fullscreenElement === sectionRef.current);
    }

    function closeFallbackFullscreen(event: KeyboardEvent) {
      if (event.key === "Escape" && !document.fullscreenElement) {
        setIsFullscreen(false);
      }
    }

    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("keydown", closeFallbackFullscreen);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("keydown", closeFallbackFullscreen);
    };
  }, []);

  // The picker is only for choosing a new stream target; never mid-stream.
  useEffect(() => {
    if (isMonitoring) setDropdownOpen(false);
  }, [isMonitoring]);

  // Close the picker on any interaction outside of it.
  useEffect(() => {
    if (!dropdownOpen) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [dropdownOpen]);

  useEffect(() => {
    if (!dropdownOpen || highlightedIndex < 0) return;

    optionListRef.current?.children[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [dropdownOpen, highlightedIndex]);

  function openDropdown() {
    const currentIndex = employees.findIndex(
      (employee) => getMonitorOptionValue(employee) === selectedEmployeeId
    );
    setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
    setDropdownOpen(true);
  }

  function moveHighlight(from: number, step: number) {
    if (!employees.length) return -1;

    let index = from;
    for (let visited = 0; visited < employees.length; visited += 1) {
      index = (index + step + employees.length) % employees.length;
      if (employees[index].isOnline) return index;
    }

    return from;
  }

  function selectEmployee(employee: ScreenMonitorEmployee) {
    if (!employee.isOnline) return;

    onChangeEmployee(getMonitorOptionValue(employee));
    setDropdownOpen(false);
  }

  function onTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (pickerDisabled) return;

    if (!dropdownOpen) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openDropdown();
      }
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) => moveHighlight(current, event.key === "ArrowDown" ? 1 : -1));
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (highlightedIndex >= 0) selectEmployee(employees[highlightedIndex]);
      return;
    }

    if (event.key === "Escape") {
      setDropdownOpen(false);
    }
  }

  async function toggleFullscreen() {
    const section = sectionRef.current;
    if (!section) return;

    try {
      if (document.fullscreenElement === section) {
        await document.exitFullscreen();
        return;
      }

      if (section.requestFullscreen) {
        await section.requestFullscreen();
        return;
      }
    } catch {
      setIsFullscreen((current) => !current);
      return;
    }

    setIsFullscreen((current) => !current);
  }

  return (
    <section ref={sectionRef} className={`panel screen-monitor-panel ${isFullscreen ? "fullscreen" : ""}`}>
      <div className="panel-header">
        <div className="panel-title">
          <Monitor size={20} />
          <div>
            <h2>Live Screen Monitor</h2>
            <p className="panel-subtitle">On-demand live view of an agent&apos;s screen</p>
          </div>
        </div>
        <div className="screen-monitor-header-actions">
          <span className={`pill ${isMonitoring ? "success-pill" : status === "Connecting" ? "warn" : "muted-pill"}`}>
            {status}
          </span>
          <button
            aria-label={isFullscreen ? "Exit fullscreen monitor" : "Open fullscreen monitor"}
            className="icon-button secondary"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            type="button"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
      </div>

      <div className="screen-monitor-grid">
        <div className="screen-monitor-controls">
          <div className="field agent-select-field">
            <label htmlFor="screen-monitor-employee">Agent</label>
            <div className={`agent-select ${dropdownOpen ? "open" : ""}`} ref={dropdownRef}>
              <button
                aria-activedescendant={
                  dropdownOpen && highlightedIndex >= 0
                    ? `screen-monitor-option-${highlightedIndex}`
                    : undefined
                }
                aria-expanded={dropdownOpen}
                aria-haspopup="listbox"
                aria-labelledby="screen-monitor-employee"
                className="agent-select-trigger"
                disabled={pickerDisabled}
                id="screen-monitor-employee"
                type="button"
                onClick={() => (dropdownOpen ? setDropdownOpen(false) : openDropdown())}
                onKeyDown={onTriggerKeyDown}
              >
                {selectedEmployee ? (
                  <>
                    <span aria-hidden="true" className="agent-avatar">
                      {getInitials(selectedEmployee.name)}
                    </span>
                    <span className="agent-select-text">
                      <span className="agent-select-name">{selectedEmployee.name}</span>
                      <span className="agent-select-email">
                        {selectedEmployee.email || selectedEmployee.id}
                      </span>
                    </span>
                    <ActivityChip activity={selectedActivity} />
                  </>
                ) : (
                  <span className="agent-select-name muted">No agents available</span>
                )}
                <ChevronDown aria-hidden="true" className="agent-select-chevron" size={16} />
              </button>

              {dropdownOpen && (
                <ul className="agent-select-menu" aria-label="Agents" ref={optionListRef} role="listbox">
                  {employees.map((employee, index) => {
                    const value = getMonitorOptionValue(employee);
                    const optionClass = [
                      "agent-select-option",
                      index === highlightedIndex ? "highlighted" : "",
                      value === selectedEmployeeId ? "selected" : "",
                      employee.isOnline ? "" : "disabled",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <li
                        aria-disabled={!employee.isOnline}
                        aria-selected={value === selectedEmployeeId}
                        className={optionClass}
                        id={`screen-monitor-option-${index}`}
                        key={`${employee.id}-${value}`}
                        role="option"
                        onMouseEnter={() => setHighlightedIndex(index)}
                        onClick={() => selectEmployee(employee)}
                      >
                        <span aria-hidden="true" className="agent-avatar small">
                          {getInitials(employee.name)}
                        </span>
                        <span className="agent-select-text">
                          <span className="agent-select-name">{employee.name}</span>
                          <span className="agent-select-email">{employee.email || employee.id}</span>
                        </span>
                        <span className="agent-presence">
                          <i
                            aria-hidden="true"
                            className={`presence-dot ${employee.isOnline ? "online" : "offline"}`}
                          />
                          {employee.isOnline ? "Online" : "Offline"}
                        </span>
                        <ActivityChip activity={employee.activity} />
                      </li>
                    );
                  })}
                  {!employees.length && <li className="agent-select-empty">No agents found</li>}
                </ul>
              )}
            </div>
          </div>

          {selectedEmployee && (
            <div className="selected-agent-status">
              <span aria-hidden="true" className="agent-avatar">
                {getInitials(selectedEmployee.name)}
              </span>
              <div className="selected-agent-text">
                <strong>{selectedEmployee.name}</strong>
                <span className="selected-agent-meta">
                  <i
                    aria-hidden="true"
                    className={`presence-dot ${selectedEmployee.isOnline ? "online" : "offline"}`}
                  />
                  {selectedEmployee.isOnline ? "Online" : "Offline"}
                  {selectedActivity?.since
                    ? ` · since ${formatActivitySince(selectedActivity.since)}`
                    : ""}
                </span>
              </div>
              <ActivityChip activity={selectedActivity} />
            </div>
          )}

          <button className="button" disabled={!canMonitor || isMonitoring} type="button" onClick={onStart}>
            <Monitor size={17} />
            Monitor Screen
          </button>

          <div aria-label="Team status summary" className="screen-monitor-status-strip">
            {statusSummary.map((item) => (
              <span className={`status-strip-chip tone-${item.tone}`} key={item.tone}>
                <i aria-hidden="true" className={`presence-dot ${item.tone === "available" || item.tone === "online" ? "online" : item.tone === "break" ? "break" : "offline"}`} />
                {item.label}
                <strong>{item.count}</strong>
              </span>
            ))}
          </div>
        </div>

        <div className={`screen-frame ${isMonitoring ? "live" : ""}`}>
          <canvas ref={canvasRef} aria-label="Live agent screen feed" />
          {!isMonitoring && <span className="screen-placeholder">No active stream</span>}
          {isMonitoring && (
            <button
              aria-label="Close stream"
              className="screen-close-button"
              type="button"
              onClick={onStop}
            >
              <X size={17} />
              Close Stream
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
