"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  Download,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import type { AdminOverview, User } from "@/types/workforce";
import { formatDate } from "@/lib/api";
import { escapeExcelCell, formatRole, toDateKey } from "../shared";

export function AdminOverviewPanel({
  canDownload = false,
  loading,
  overview,
  selectedDate,
  onSelectDate,
  onRunMaintenance,
}: {
  canDownload?: boolean;
  loading: boolean;
  overview: AdminOverview;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onRunMaintenance?: () => void;
}) {
  const [view, setView] = useState<"summary" | "history">("summary");
  const [selectedUserId, setSelectedUserId] = useState("");
  const selectedUser = overview.users.find((item) => item.user._id === selectedUserId) || overview.users[0];

  useEffect(() => {
    if (!overview.users.some((item) => item.user._id === selectedUserId)) {
      setSelectedUserId(overview.users[0]?.user._id || "");
    }
  }, [overview.users, selectedUserId]);

  function downloadOverviewExcel() {
    const rows = overview.users.map((item) => {
      const adherence =
        item.performance.adherenceScore ??
        item.performance.breakdown.activityAdherenceScore ??
        item.performance.breakdown.breakScore;

      return `
        <tr>
          <td>${escapeExcelCell(item.user.name)}</td>
          <td>${escapeExcelCell(item.user.email)}</td>
          <td>${escapeExcelCell(formatRole(item.user.role))}</td>
          <td>${escapeExcelCell(item.performance.status)}</td>
          <td>${escapeExcelCell(item.performance.overallScore)}%</td>
          <td>${escapeExcelCell(adherence)}%</td>
          <td>${escapeExcelCell(item.performance.workedMinutes)}m</td>
          <td>${escapeExcelCell(item.performance.lateMinutes)}m</td>
          <td>${escapeExcelCell(item.performance.overtimeMinutes)}m</td>
        </tr>`;
    });
    const html = `
      <html>
        <head><meta charset="utf-8" /></head>
        <body>
          <table>
            <thead>
              <tr>
                <th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Overall</th>
                <th>Adherence</th><th>Worked</th><th>Late</th><th>Overtime</th>
              </tr>
            </thead>
            <tbody>${rows.join("")}</tbody>
          </table>
        </body>
      </html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `admin-execution-overview-${String(overview.date).slice(0, 10)}.xls`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <section className="panel admin-overview">
      <div className="panel-header">
        <div className="panel-title">
          <ShieldCheck size={20} />
          <div>
            <h2>Execution Overview</h2>
            <p className="panel-subtitle">
              Workforce analytics for {formatDate(overview.date)}
            </p>
          </div>
        </div>
        <div className="review-actions">
          {canDownload && (
            <button className="button secondary" type="button" onClick={downloadOverviewExcel}>
              <Download size={17} />
              Download Excel
            </button>
          )}
          {canDownload && (
            <Link className="button secondary" href="/execution-report">
              <BarChart3 size={17} />
              Detailed reports
            </Link>
          )}
          {onRunMaintenance && (
            <button className="button secondary" disabled={loading} type="button" onClick={onRunMaintenance}>
              <RefreshCw size={17} />
              Run maintenance
            </button>
          )}
        </div>
      </div>

      <div className="overview-tabs" role="tablist" aria-label="Execution overview views">
        <button className={`button ${view === "summary" ? "" : "secondary"}`} type="button" onClick={() => setView("summary")}>Summary</button>
        <button className={`button ${view === "history" ? "" : "secondary"}`} type="button" onClick={() => setView("history")}>Activity history</button>
      </div>

      {view === "history" ? (
        <div className="overview-history">
          <div className="overview-filters">
            <label>Activity date
              <input type="date" value={selectedDate} max={toDateKey(new Date())} onChange={(event) => onSelectDate(event.target.value)} />
            </label>
            <label>Team member
              <select value={selectedUser?.user._id || ""} onChange={(event) => setSelectedUserId(event.target.value)}>
                {overview.users.map((item) => <option key={item.user._id} value={item.user._id}>{item.user.name} ({item.user.email})</option>)}
              </select>
            </label>
          </div>
          {selectedUser ? (
            <div className="metrics admin-metrics history-metrics">
              <div className="metric"><span>Status</span><strong>{selectedUser.performance.status}</strong></div>
              <div className="metric"><span>Adherence</span><strong>{selectedUser.performance.adherenceScore ?? selectedUser.performance.breakdown.activityAdherenceScore ?? 0}%</strong></div>
              <div className="metric"><span>Work done</span><strong>{selectedUser.performance.workedMinutes}m</strong></div>
              <div className="metric"><span>Scheduled</span><strong>{selectedUser.performance.scheduledMinutes}m</strong></div>
              <div className="metric"><span>Overall</span><strong>{selectedUser.performance.overallScore}%</strong></div>
              <div className="metric"><span>Breaks</span><strong>{selectedUser.performance.breakMinutes}m</strong></div>
              <div className="metric"><span>Late</span><strong>{selectedUser.performance.lateMinutes}m</strong></div>
              <div className="metric"><span>Overtime</span><strong>{selectedUser.performance.overtimeMinutes}m</strong></div>
            </div>
          ) : <p className="empty-state">No team members are available for this view.</p>}
        </div>
      ) : <>

      <div className="metrics admin-metrics">
        <div className="metric">
          <span>Attendance rate</span>
          <strong>{overview.totals.attendanceRate}%</strong>
        </div>
        <div className="metric">
          <span>Avg performance</span>
          <strong>{overview.totals.averagePerformance}%</strong>
        </div>
        <div className="metric">
          <span>Avg adherence</span>
          <strong>{overview.totals.averageAdherence}%</strong>
        </div>
        <div className="metric">
          <span>Active shifts</span>
          <strong>{overview.totals.active}</strong>
        </div>
        <div className="metric">
          <span>Scheduled</span>
          <strong>{overview.totals.scheduled}</strong>
        </div>
        <div className="metric">
          <span>Present</span>
          <strong>{overview.totals.present}</strong>
        </div>
        <div className="metric">
          <span>Absent</span>
          <strong>{overview.totals.absent}</strong>
        </div>
        <div className="metric">
          <span>Late</span>
          <strong>{overview.totals.late}</strong>
        </div>
        <div className="metric">
          <span>Overtime</span>
          <strong>{overview.totals.overtime}</strong>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Overall</th>
              <th>Adherence</th>
              <th>Worked</th>
              <th>Late</th>
              <th>Overtime</th>
            </tr>
          </thead>
          <tbody>
            {overview.users.map((item) => (
              <tr key={item.user._id}>
                <td>
                  <strong>{item.user.name}</strong>
                  <span>{item.user.email}</span>
                </td>
                <td>{formatRole(item.user.role)}</td>
                <td>{item.performance.status}</td>
                <td>{item.performance.overallScore}%</td>
                <td>
                  {item.performance.adherenceScore ??
                    item.performance.breakdown.activityAdherenceScore ??
                    item.performance.breakdown.breakScore}
                  %
                </td>
                <td>{item.performance.workedMinutes}m</td>
                <td>{item.performance.lateMinutes}m</td>
                <td>{item.performance.overtimeMinutes}m</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>}
    </section>
  );
}

export function HiringManagerAgentAllocationPanel({
  loading,
  onAssignAgents,
  users,
}: {
  loading: boolean;
  users: User[];
  onAssignAgents: (user: User, agentIds: string[]) => void;
}) {
  const managers = useMemo(() => users.filter((member) => member.role === "supervisor"), [users]);
  const agents = useMemo(() => users.filter((member) => member.role === "agent"), [users]);
  const [managerId, setManagerId] = useState("");
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const manager = managers.find((item) => item._id === managerId) || null;
  const assignedKey = (manager?.assignedAgentIds || []).map(String).join("|");

  useEffect(() => {
    setManagerId((current) =>
      managers.some((item) => item._id === current) ? current : managers[0]?._id || ""
    );
  }, [managers]);

  useEffect(() => {
    setSelectedAgentIds((manager?.assignedAgentIds || []).map(String));
  }, [manager?._id, assignedKey]);

  function toggleAgent(agentId: string, checked: boolean) {
    setSelectedAgentIds((current) =>
      checked ? [...new Set([...current, agentId])] : current.filter((id) => id !== agentId)
    );
  }

  return (
    <section className="panel manager-allocation-panel">
      <div className="panel-header">
        <div className="panel-title">
          <UserRound size={20} />
          <div>
            <h2>Hiring Manager Agent Allocation</h2>
            <p className="panel-subtitle">Assigned agents appear in hiring manager chat, overview, and monitoring</p>
          </div>
        </div>
        <button
          className="button"
          disabled={loading || !manager}
          type="button"
          onClick={() => manager && onAssignAgents(manager, selectedAgentIds)}
        >
          <CheckCircle2 size={17} />
          Save allocation
        </button>
      </div>

      <div className="manager-allocation-grid">
        <div className="field">
          <label htmlFor="allocation-manager">Hiring manager</label>
          <select
            id="allocation-manager"
            disabled={loading || !managers.length}
            value={managerId}
            onChange={(event) => setManagerId(event.target.value)}
          >
            {managers.length ? (
              managers.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name} ({item.email})
                </option>
              ))
            ) : (
              <option value="">No hiring managers</option>
            )}
          </select>
          <span className="muted">
            {manager ? `${selectedAgentIds.length} of ${agents.length} agents assigned` : "Select a hiring manager"}
          </span>
        </div>

        <div className="agent-allocation-list">
          {agents.length ? (
            agents.map((agent) => (
              <label className="agent-check" key={agent._id}>
                <input
                  type="checkbox"
                  checked={selectedAgentIds.includes(agent._id)}
                  disabled={loading || !manager}
                  onChange={(event) => toggleAgent(agent._id, event.target.checked)}
                />
                <span>
                  <strong>{agent.name}</strong>
                  <small>{agent.email}</small>
                </span>
              </label>
            ))
          ) : (
            <p className="muted">No agents available to assign.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export function UserAccountsPanel({
  currentUserId,
  loading,
  onApproveUser,
  onDeleteUser,
  onUpdateAgentMonitorId,
  users,
}: {
  currentUserId: string;
  loading: boolean;
  onApproveUser: (user: User) => void;
  users: User[];
  onDeleteUser: (user: User) => void;
  onUpdateAgentMonitorId: (user: User, monitorId: string) => void;
}) {
  const agentMonitorKey = users
    .filter((member) => member.role === "agent")
    .map((member) => `${member._id}:${member.monitorId || ""}`)
    .join("|");
  const [monitorIds, setMonitorIds] = useState<Record<string, string>>({});

  useEffect(() => {
    setMonitorIds(
      Object.fromEntries(
        users
          .filter((member) => member.role === "agent")
          .map((member) => [member._id, member.monitorId || ""])
      )
    );
  }, [agentMonitorKey]);

  return (
    <section className="panel user-accounts-panel">
      <div className="panel-header">
        <div className="panel-title">
          <UserRound size={20} />
          <div>
            <h2>User Accounts</h2>
            <p className="panel-subtitle">Manage registered dashboard access</p>
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>MFA</th>
              <th>Screen Monitor ID</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((member) => {
              const isCurrentUser = member._id === currentUserId;
              const canDelete = !isCurrentUser && member.role !== "admin";
              const accountStatus = member.accountStatus || "approved";
              const canApprove = member.role === "supervisor" && accountStatus === "pending";

              return (
                <tr key={member._id}>
                  <td>
                    <strong>{member.name}</strong>
                    {isCurrentUser && <span>Signed-in account</span>}
                  </td>
                  <td>{member.email}</td>
                  <td>{formatRole(member.role)}</td>
                  <td>
                    <span className={`pill ${accountStatus === "pending" ? "warn" : ""}`}>
                      {accountStatus}
                    </span>
                  </td>
                  <td>{member.mfaEnabled ? "Enabled" : "Not enabled"}</td>
                  <td>
                    {member.role === "agent" ? (
                      <div className="account-monitor-id-field">
                        <input
                          aria-label={`Screen monitor ID for ${member.name}`}
                          placeholder="agent-id"
                          value={monitorIds[member._id] || ""}
                          onChange={(event) =>
                            setMonitorIds((current) => ({
                              ...current,
                              [member._id]: event.target.value,
                            }))
                          }
                        />
                        <button
                          aria-label={`Save screen monitor ID for ${member.name}`}
                          className="icon-button secondary"
                          disabled={loading || (monitorIds[member._id] || "") === (member.monitorId || "")}
                          title="Save monitor ID"
                          type="button"
                          onClick={() => onUpdateAgentMonitorId(member, monitorIds[member._id] || "")}
                        >
                          <CheckCircle2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td>
                    <div className="review-actions account-actions">
                      {canApprove && (
                        <button
                          className="button secondary"
                          disabled={loading}
                          type="button"
                          onClick={() => onApproveUser(member)}
                        >
                          <BadgeCheck size={16} />
                          Approve
                        </button>
                      )}
                      <button
                        className="button danger account-delete-button"
                        disabled={loading || !canDelete}
                        type="button"
                        onClick={() => onDeleteUser(member)}
                      >
                        <Trash2 size={16} />
                        {member.role === "admin" ? "Protected" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
