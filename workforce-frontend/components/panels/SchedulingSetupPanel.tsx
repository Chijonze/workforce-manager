"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, Infinity as InfinityIcon, Plus, Trash2, Waves } from "lucide-react";
import { apiRequest, formatDate } from "@/lib/api";
import { formatTimeRange } from "../shared";
import type { LeaveRequest, Schedule, ScheduleType, ShiftTemplate, User } from "@/types/workforce";
import {
  getScheduleTemplateId,
  minutesBetweenTimes,
  toDateKey,
} from "../shared";
import { WorkDateMultiPicker } from "./SchedulePanels";

type BreakForm = {
  label: string;
  type: "break" | "lunch";
  mode: "static" | "dynamic";
  startTime: string;
  endTime: string;
  durationMinutes: number;
};

type TemplateActivityForm = {
  label: string;
  type: "meeting" | "training" | "after_call_work";
  startTime: string;
  endTime: string;
  durationMinutes: number;
  enabled: boolean;
};

const defaultBreaks: BreakForm[] = [
  { label: "Morning break", type: "break", mode: "static", startTime: "10:00", endTime: "10:15", durationMinutes: 15 },
  { label: "Lunch", type: "lunch", mode: "static", startTime: "14:00", endTime: "15:00", durationMinutes: 45 },
];

const optionalTemplateActivities: TemplateActivityForm[] = [
  { label: "Meeting", type: "meeting", startTime: "11:00", endTime: "11:30", durationMinutes: 30, enabled: false },
  { label: "Training", type: "training", startTime: "15:00", endTime: "15:30", durationMinutes: 30, enabled: false },
  { label: "After call work", type: "after_call_work", startTime: "16:00", endTime: "16:15", durationMinutes: 15, enabled: false },
];

const dynamicBreakDurations = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 60, 75, 90];

const breakDurationLabel = (minutes: number) =>
  minutes === 0 ? "0 min (no break)" : `${minutes} min`;

// 0 is a real allowance ("work through"); only absent values fall back.
const safeBreakDuration = (value: unknown, fallback: number) => {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? Math.min(480, Math.max(0, parsed)) : fallback;
};

export default function SchedulingSetupPanel({
  leaveRequests,
  loading,
  notify,
  onRefresh,
  schedules,
  templates,
  token,
  users,
}: {
  leaveRequests: LeaveRequest[];
  loading: boolean;
  notify: (type: "success" | "error", message: string) => void;
  onRefresh: () => Promise<void>;
  schedules: Schedule[];
  templates: ShiftTemplate[];
  token: string;
  users: User[];
}) {
  const [scheduleType, setScheduleType] = useState<ScheduleType>("time_managed");
  const [templateForm, setTemplateForm] = useState({
    name: "Day Operations",
    startTime: "08:00",
    endTime: "17:00",
    breakCount: 1,
    breaks: defaultBreaks.slice(0, 1),
    activities: optionalTemplateActivities,
  });
  const [scheduleForm, setScheduleForm] = useState({
    userId: "",
    shiftTemplateId: "",
    workDates: [new Date().toISOString().slice(0, 10)],
  });
  const [scheduleDeleteForm, setScheduleDeleteForm] = useState({
    userId: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
  });
  const [assignmentMonth, setAssignmentMonth] = useState(toDateKey(new Date()).slice(0, 7));

  useEffect(() => {
    if (scheduleForm.userId || !users.length) return;
    setScheduleForm((current) => ({ ...current, userId: users[0]._id }));
    setScheduleDeleteForm((current) => ({ ...current, userId: current.userId || users[0]._id }));
  }, [scheduleForm.userId, users]);

  useEffect(() => {
    if (scheduleForm.shiftTemplateId || !templates.length) return;
    setScheduleForm((current) => ({ ...current, shiftTemplateId: templates[0]._id }));
  }, [scheduleForm.shiftTemplateId, templates]);

  const approvedLeaveRequests = leaveRequests.filter((request) => request.status === "approved");
  const selectedTemplateBreaks = templateForm.breaks.slice(0, templateForm.breakCount);
  const selectedTemplateActivities = templateForm.activities.filter((activity) => activity.enabled);

  const templateIssues = useMemo(() => {
    const issues: string[] = [];

    if (!templateForm.name.trim()) issues.push("Template name is required");

    if (scheduleType === "time_managed") {
      if (!templateForm.startTime || !templateForm.endTime) {
        issues.push("Shift start and end times are required");
      } else if (templateForm.startTime === templateForm.endTime) {
        issues.push("Shift end time must differ from its start time");
      }
    }

    selectedTemplateBreaks.forEach((breakItem, index) => {
      if (scheduleType === "time_managed" && breakItem.mode === "static") {
        const duration = minutesBetweenTimes(breakItem.startTime, breakItem.endTime);
        if (!duration) {
          issues.push(
            `${breakItem.label || `Break ${index + 1}`}: end time must be after start time`
          );
        }
      }
    });

    if (scheduleType === "time_managed") {
      templateForm.activities.forEach((activity) => {
        if (!activity.enabled) return;
        if (!minutesBetweenTimes(activity.startTime, activity.endTime)) {
          issues.push(`${activity.label}: end time must be after start time`);
        }
      });
    }

    return issues;
  }, [scheduleType, selectedTemplateBreaks, templateForm.activities, templateForm.endTime, templateForm.name, templateForm.startTime]);

  function setBreakCount(count: number) {
    const nextCount = Math.min(4, Math.max(1, count));
    setTemplateForm((current) => {
      const nextBreaks = [...current.breaks];
      while (nextBreaks.length < nextCount) {
        const isLunch = nextBreaks.length === 1;
        nextBreaks.push({
          label: isLunch ? "Lunch" : `Break ${nextBreaks.length + 1}`,
          type: isLunch ? "lunch" : "break",
          mode: scheduleType === "fluid" ? "dynamic" : "static",
          startTime: isLunch ? "14:00" : "10:00",
          endTime: isLunch ? "14:45" : "10:15",
          durationMinutes: isLunch ? 45 : 15,
        });
      }

      return {
        ...current,
        breakCount: nextCount,
        breaks: nextBreaks.slice(0, nextCount),
      };
    });
  }

  function updateBreak(index: number, key: keyof BreakForm, value: string | number) {
    setTemplateForm((current) => ({
      ...current,
      breaks: current.breaks.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        const updated = { ...item, [key]: value };

        if (scheduleType === "fluid" || updated.mode === "dynamic") {
          return {
            ...updated,
            mode: "dynamic",
            durationMinutes: safeBreakDuration(updated.durationMinutes, 15),
          };
        }

        return updated;
      }),
    }));
  }

  function updateTemplateActivity(
    type: TemplateActivityForm["type"],
    key: keyof TemplateActivityForm,
    value: string | number | boolean
  ) {
    setTemplateForm((current) => ({
      ...current,
      activities: current.activities.map((item) => {
        if (item.type !== type) return item;
        return { ...item, [key]: value };
      }),
    }));
  }

  function toggleScheduleDate(date: string) {
    setScheduleForm((current) => {
      const selected = new Set(current.workDates);

      if (selected.has(date)) {
        selected.delete(date);
      } else {
        selected.add(date);
      }

      return {
        ...current,
        workDates: Array.from(selected).sort(),
      };
    });
  }

  async function createTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (templateIssues.length) {
      notify("error", templateIssues[0]);
      return;
    }

    const isFluid = scheduleType === "fluid";
    const selectedBreaks = templateForm.breaks.slice(0, templateForm.breakCount);
    const selectedActivities = templateForm.activities.filter((item) => item.enabled);

    try {
      await apiRequest<ShiftTemplate>("/api/scheduling/templates", {
        method: "POST",
        token,
        body: {
          name: templateForm.name,
          scheduleType,
          // Fluid shifts carry no clock times at all.
          startTime: isFluid ? undefined : templateForm.startTime,
          endTime: isFluid ? undefined : templateForm.endTime,
          breaks: selectedBreaks.map((item, index) => ({
            label: item.label || `Break ${index + 1}`,
            type: item.type,
            mode: isFluid ? "dynamic" : item.mode,
            startTime: !isFluid && item.mode === "static" ? item.startTime : undefined,
            endTime: !isFluid && item.mode === "static" ? item.endTime : undefined,
            durationMinutes: isFluid || item.mode === "dynamic"
              ? safeBreakDuration(item.durationMinutes, 15)
              : minutesBetweenTimes(item.startTime, item.endTime),
          })),
          activities: selectedActivities.map((item) => ({
            label: item.label,
            type: item.type,
            startTime: isFluid ? undefined : item.startTime,
            endTime: isFluid ? undefined : item.endTime,
            durationMinutes: isFluid
              ? Number(item.durationMinutes) || 30
              : minutesBetweenTimes(item.startTime, item.endTime) || Number(item.durationMinutes) || 30,
          })),
        },
      });
      notify("success", "Template created");
      await onRefresh();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Template creation failed");
    }
  }

  async function deleteTemplate(template: ShiftTemplate) {
    const assignedCount = schedules.filter((schedule) => {
      return getScheduleTemplateId(schedule) === template._id;
    }).length;

    const actionLabel = assignedCount ? "Archive" : "Delete";
    const detail = assignedCount
      ? `This template is attached to ${assignedCount} schedule${
          assignedCount === 1 ? "" : "s"
        }. It will be hidden from admin setup but kept for historical shift records.`
      : "This template is not attached to any schedules and will be deleted.";

    if (!window.confirm(`${actionLabel} ${template.name} template?\n\n${detail}`)) {
      return;
    }

    try {
      await apiRequest(`/api/scheduling/templates/${template._id}`, {
        method: "DELETE",
        token,
      });

      setScheduleForm((current) => ({
        ...current,
        shiftTemplateId: current.shiftTemplateId === template._id ? "" : current.shiftTemplateId,
      }));
      notify("success", assignedCount ? "Template archived" : "Template deleted");
      await onRefresh();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Template delete failed");
    }
  }

  async function assignSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!scheduleForm.workDates.length) {
      notify("error", "Select at least one work date");
      return;
    }

    try {
      await apiRequest<Schedule[]>("/api/scheduling/schedule", {
        method: "POST",
        token,
        body: scheduleForm,
      });
      notify("success", "Schedule assigned");
      await onRefresh();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Schedule assignment failed");
    }
  }

  async function deleteSchedules(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (scheduleDeleteForm.endDate < scheduleDeleteForm.startDate) {
      notify("error", "End date cannot be before start date");
      return;
    }

    const member = users.find((item) => item._id === scheduleDeleteForm.userId);
    const dateLabel =
      scheduleDeleteForm.startDate === scheduleDeleteForm.endDate
        ? formatDate(scheduleDeleteForm.startDate)
        : `${formatDate(scheduleDeleteForm.startDate)} to ${formatDate(scheduleDeleteForm.endDate)}`;

    if (!window.confirm(`Delete schedules for ${member?.name || "this user"} from ${dateLabel}?`)) {
      return;
    }

    try {
      const response = await apiRequest<{ deletedCount: number }>("/api/scheduling/schedule", {
        method: "DELETE",
        token,
        body: scheduleDeleteForm,
      });
      await onRefresh();
      notify(
        "success",
        response.deletedCount
          ? `${response.deletedCount} schedule${response.deletedCount === 1 ? "" : "s"} deleted`
          : "No matching schedules found"
      );
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Schedule delete failed");
    }
  }

  return (
    <section className="panel scheduling-setup-panel">
      <div className="panel-header">
        <div className="panel-title">
          <CalendarDays size={20} />
          <div>
            <h2>Scheduling Setup</h2>
            <p className="panel-subtitle">Create a shift template, then assign it to work dates</p>
          </div>
        </div>
      </div>

      <div className="stack">
        <form className="stack" onSubmit={createTemplate}>
          <div className="schedule-type-cards" role="radiogroup" aria-label="Schedule type">
            <button
              aria-checked={scheduleType === "time_managed"}
              className={`schedule-type-card ${scheduleType === "time_managed" ? "active" : ""}`}
              type="button"
              role="radio"
              onClick={() => setScheduleType("time_managed")}
            >
              <span className="schedule-type-icon"><Clock3 size={18} /></span>
              <span className="schedule-type-copy">
                <strong>Time Managed</strong>
                <span>Fixed start and end times. Breaks can be static windows or dynamic allowances. Classic rigid scheduling.</span>
              </span>
            </button>
            <button
              aria-checked={scheduleType === "fluid"}
              className={`schedule-type-card ${scheduleType === "fluid" ? "active" : ""}`}
              type="button"
              role="radio"
              onClick={() => setScheduleType("fluid")}
            >
              <span className="schedule-type-icon"><Waves size={18} /></span>
              <span className="schedule-type-copy">
                <strong>Fluid</strong>
                <span>No fixed hours. Workers run Available to End shift; everything except breaks counts as work time and KPI tracks it live.</span>
              </span>
            </button>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="template-name">Template name</label>
              <input
                id="template-name"
                value={templateForm.name}
                onChange={(event) =>
                  setTemplateForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="break-count">Breaks</label>
              <select
                id="break-count"
                value={templateForm.breakCount}
                onChange={(event) => setBreakCount(Number(event.target.value))}
              >
                <option value={1}>1 break</option>
                <option value={2}>2 breaks</option>
                <option value={3}>3 breaks</option>
                <option value={4}>4 breaks</option>
              </select>
            </div>
            {scheduleType === "time_managed" ? (
              <>
                <div className="field">
                  <label htmlFor="start-time">Shift start</label>
                  <input
                    id="start-time"
                    type="time"
                    value={templateForm.startTime}
                    onChange={(event) =>
                      setTemplateForm((current) => ({ ...current, startTime: event.target.value }))
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="end-time">Shift end</label>
                  <input
                    id="end-time"
                    type="time"
                    value={templateForm.endTime}
                    onChange={(event) =>
                      setTemplateForm((current) => ({ ...current, endTime: event.target.value }))
                    }
                  />
                </div>
              </>
            ) : (
              <div className="field full fluid-note">
                <InfinityIcon size={15} />
                Fluid templates define no clock window. Agents check in with Available and end freely; KPI runs across that whole span.
              </div>
            )}
          </div>

          <div className="break-editor">
            {selectedTemplateBreaks.map((breakItem, index) => {
              const isDynamic = scheduleType === "fluid" || breakItem.mode === "dynamic";
              const staticDuration = minutesBetweenTimes(breakItem.startTime, breakItem.endTime);

              return (
                <div className="break-row" key={index}>
                  <div className="field">
                    <label htmlFor={`break-label-${index}`}>Name</label>
                    <input
                      id={`break-label-${index}`}
                      value={breakItem.label}
                      onChange={(event) => updateBreak(index, "label", event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`break-type-${index}`}>Type</label>
                    <select
                      id={`break-type-${index}`}
                      value={breakItem.type}
                      onChange={(event) => updateBreak(index, "type", event.target.value)}
                    >
                      <option value="break">Break</option>
                      <option value="lunch">Lunch</option>
                    </select>
                  </div>
                  {scheduleType === "time_managed" && (
                    <div className="field">
                      <label htmlFor={`break-mode-${index}`}>Rule</label>
                      <select
                        id={`break-mode-${index}`}
                        value={breakItem.mode}
                        onChange={(event) => updateBreak(index, "mode", event.target.value)}
                      >
                        <option value="static">Static</option>
                        <option value="dynamic">Dynamic</option>
                      </select>
                    </div>
                  )}
                  {isDynamic ? (
                    <div className="field break-duration-field">
                      <label htmlFor={`break-duration-${index}`}>Duration</label>
                      <select
                        id={`break-duration-${index}`}
                        value={breakItem.durationMinutes}
                        onChange={(event) =>
                          updateBreak(index, "durationMinutes", Number(event.target.value))
                        }
                      >
                        {dynamicBreakDurations.map((minutes) => (
                          <option key={minutes} value={minutes}>
                            {breakDurationLabel(minutes)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div className="field">
                        <label htmlFor={`break-start-${index}`}>From</label>
                        <input
                          id={`break-start-${index}`}
                          type="time"
                          value={breakItem.startTime}
                          onChange={(event) => updateBreak(index, "startTime", event.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`break-end-${index}`}>To</label>
                        <input
                          id={`break-end-${index}`}
                          type="time"
                          value={breakItem.endTime}
                          onChange={(event) => updateBreak(index, "endTime", event.target.value)}
                        />
                      </div>
                    </>
                  )}
                  <div className={`break-duration-pill ${scheduleType === "time_managed" && !isDynamic && !staticDuration ? "invalid" : ""}`}>
                    {isDynamic
                      ? `${breakItem.durationMinutes}m flex`
                      : staticDuration
                        ? `${staticDuration}m`
                        : "Set times"}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="template-activity-editor">
            <div className="template-activity-heading">
              <strong>Optional activities</strong>
              <span>{selectedTemplateActivities.length} selected</span>
            </div>
            {templateForm.activities.map((activity) => (
              <div className="template-activity-row" key={activity.type}>
                <label className="template-activity-toggle" htmlFor={`activity-${activity.type}`}>
                  <input
                    checked={activity.enabled}
                    id={`activity-${activity.type}`}
                    type="checkbox"
                    onChange={(event) =>
                      updateTemplateActivity(activity.type, "enabled", event.target.checked)
                    }
                  />
                  <span>{activity.label}</span>
                </label>
                {scheduleType === "time_managed" ? (
                  <>
                    <div className="field">
                      <label htmlFor={`activity-start-${activity.type}`}>From</label>
                      <input
                        disabled={!activity.enabled}
                        id={`activity-start-${activity.type}`}
                        type="time"
                        value={activity.startTime}
                        onChange={(event) =>
                          updateTemplateActivity(activity.type, "startTime", event.target.value)
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`activity-end-${activity.type}`}>To</label>
                      <input
                        disabled={!activity.enabled}
                        id={`activity-end-${activity.type}`}
                        type="time"
                        value={activity.endTime}
                        onChange={(event) =>
                          updateTemplateActivity(activity.type, "endTime", event.target.value)
                        }
                      />
                    </div>
                    <div className="break-duration-pill">
                      {minutesBetweenTimes(activity.startTime, activity.endTime) || activity.durationMinutes}m
                    </div>
                  </>
                ) : (
                  <div className="field">
                    <label htmlFor={`activity-duration-${activity.type}`}>Allowance</label>
                    <select
                      disabled={!activity.enabled}
                      id={`activity-duration-${activity.type}`}
                      value={activity.durationMinutes}
                      onChange={(event) =>
                        updateTemplateActivity(activity.type, "durationMinutes", Number(event.target.value))
                      }
                    >
                      {[5, 10, 15, 20, 25, 30, 45, 60, 90, 120].map((minutes) => (
                        <option key={minutes} value={minutes}>
                          {minutes} min
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>

          {templateIssues.length > 0 && (
            <div className="validation-copy template-issues">
              {templateIssues.map((issue) => (
                <span key={issue}>{issue}</span>
              ))}
            </div>
          )}

          <div>
            <button className="button" disabled={loading || templateIssues.length > 0} type="submit">
              <Plus size={17} />
              Create {scheduleType === "fluid" ? "fluid" : "time-managed"} template
            </button>
          </div>
        </form>

        <div className="record-list">
          {templates.length ? (
            templates.map((template) => {
              const assignedCount = schedules.filter((schedule) => {
                return getScheduleTemplateId(schedule) === template._id;
              }).length;
              const type = template.scheduleType || "time_managed";

              return (
                <article className="record" key={template._id}>
                  <div>
                    <div className="record-row">
                      <strong>{template.name}</strong>
                      <span className={`pill ${type === "fluid" ? "accent-pill" : "muted-pill"}`}>
                        {type === "fluid" ? "Fluid" : "Time managed"}
                      </span>
                    </div>
                    <p>
                      {type === "fluid"
                        ? "No fixed hours"
                        : formatTimeRange(template.startTime, template.endTime)}{" "}
                      · {template.breaks.length} break{template.breaks.length === 1 ? "" : "s"} ·{" "}
                      {template.activities?.length || 0} optional activit
                      {(template.activities?.length || 0) === 1 ? "y" : "ies"} · {assignedCount} schedule
                      {assignedCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <button
                    className="button danger schedule-delete-button"
                    disabled={loading}
                    title={
                      assignedCount
                        ? "Archive template and keep historical schedule records intact"
                        : "Delete template"
                    }
                    type="button"
                    onClick={() => deleteTemplate(template)}
                  >
                    <Trash2 size={16} />
                    {assignedCount ? "Archive" : "Delete"}
                  </button>
                </article>
              );
            })
          ) : (
            <p className="muted">No templates created yet.</p>
          )}
        </div>

        <form className="form-grid" onSubmit={assignSchedule}>
          <div className="field">
            <label htmlFor="assignee">Team member</label>
            <select
              id="assignee"
              value={scheduleForm.userId}
              onChange={(event) =>
                setScheduleForm((current) => ({ ...current, userId: event.target.value }))
              }
              required
            >
              <option value="">Select user</option>
              {users.map((member) => (
                <option key={member._id} value={member._id}>
                  {member.name} ({member.email})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="template">Template</label>
            <select
              id="template"
              value={scheduleForm.shiftTemplateId}
              onChange={(event) =>
                setScheduleForm((current) => ({ ...current, shiftTemplateId: event.target.value }))
              }
              required
            >
              <option value="">Select template</option>
              {templates.map((template) => (
                <option key={template._id} value={template._id}>
                  {template.name}
                  {template.scheduleType === "fluid" ? " (Fluid)" : ""}
                </option>
              ))}
            </select>
          </div>
          <WorkDateMultiPicker
            leaveRequests={approvedLeaveRequests}
            month={assignmentMonth}
            selectedDates={scheduleForm.workDates}
            onChangeMonth={setAssignmentMonth}
            onToggleDate={toggleScheduleDate}
          />
          <button className="button secondary" disabled={loading} type="submit">
            <CalendarDays size={17} />
            Assign {scheduleForm.workDates.length || ""} schedule
            {scheduleForm.workDates.length === 1 ? "" : "s"}
          </button>
        </form>

        <div className="record-head-row">
          <h2>Delete Schedules</h2>
          <p className="muted">Remove assignments that have no recorded shift activity yet.</p>
        </div>
        <form className="form-grid" onSubmit={deleteSchedules}>
          <div className="field">
            <label htmlFor="delete-assignee">Team member</label>
            <select
              id="delete-assignee"
              value={scheduleDeleteForm.userId}
              onChange={(event) =>
                setScheduleDeleteForm((current) => ({ ...current, userId: event.target.value }))
              }
              required
            >
              <option value="">Select user</option>
              {users.map((member) => (
                <option key={member._id} value={member._id}>
                  {member.name} ({member.email})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="delete-start-date">From date</label>
            <input
              id="delete-start-date"
              type="date"
              value={scheduleDeleteForm.startDate}
              onChange={(event) =>
                setScheduleDeleteForm((current) => ({
                  ...current,
                  startDate: event.target.value,
                  endDate: current.endDate < event.target.value ? event.target.value : current.endDate,
                }))
              }
              required
            />
          </div>
          <div className="field">
            <label htmlFor="delete-end-date">To date</label>
            <input
              id="delete-end-date"
              type="date"
              value={scheduleDeleteForm.endDate}
              onChange={(event) =>
                setScheduleDeleteForm((current) => ({ ...current, endDate: event.target.value }))
              }
              required
            />
          </div>
          <button className="button danger" disabled={loading} type="submit">
            <Trash2 size={17} />
            Delete schedules
          </button>
        </form>
      </div>
    </section>
  );
}
