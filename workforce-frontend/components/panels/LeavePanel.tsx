"use client";

import { FormEvent } from "react";
import { CheckCircle2, ClipboardList, Send, XCircle } from "lucide-react";
import type { LeaveRequest, User } from "@/types/workforce";
import { formatDate } from "@/lib/api";

export default function LeavePanel({
  isAdmin,
  leaveForm,
  leaveRequests,
  loading,
  onChangeLeaveForm,
  onChangeReviewComment,
  onReview,
  onSubmitLeave,
  reviewComments,
  users,
}: {
  isAdmin: boolean;
  leaveForm: {
    leaveType: LeaveRequest["leaveType"];
    startDate: string;
    endDate: string;
    reason: string;
  };
  leaveRequests: LeaveRequest[];
  loading: boolean;
  reviewComments: Record<string, string>;
  users: User[];
  onChangeLeaveForm: (next: typeof leaveForm | ((current: typeof leaveForm) => typeof leaveForm)) => void;
  onChangeReviewComment: (
    next: Record<string, string> | ((current: Record<string, string>) => Record<string, string>)
  ) => void;
  onReview: (requestId: string, status: "approved" | "rejected") => void;
  onSubmitLeave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const pending = leaveRequests.filter((request) => request.status === "pending");

  return (
    <section className="panel leave-panel">
      <div className="panel-header">
        <div className="panel-title">
          <ClipboardList size={20} />
          <div>
            <h2>{isAdmin ? "Leave Management" : "Leave Requests"}</h2>
            <p className="panel-subtitle">
              {isAdmin ? `${pending.length} pending approvals` : "Request and track time away"}
            </p>
          </div>
        </div>
      </div>

      {!isAdmin && (
        <form className="leave-form" onSubmit={onSubmitLeave}>
          <div className="field">
            <label htmlFor="leave-type">Leave type</label>
            <select
              id="leave-type"
              value={leaveForm.leaveType}
              onChange={(event) =>
                onChangeLeaveForm((current) => ({
                  ...current,
                  leaveType: event.target.value as LeaveRequest["leaveType"],
                }))
              }
            >
              <option value="annual">Annual</option>
              <option value="sick">Sick</option>
              <option value="personal">Personal</option>
              <option value="unpaid">Unpaid</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="leave-start">Start date</label>
            <input
              id="leave-start"
              type="date"
              value={leaveForm.startDate}
              onChange={(event) =>
                onChangeLeaveForm((current) => ({ ...current, startDate: event.target.value }))
              }
              required
            />
          </div>
          <div className="field">
            <label htmlFor="leave-end">End date</label>
            <input
              id="leave-end"
              type="date"
              value={leaveForm.endDate}
              onChange={(event) =>
                onChangeLeaveForm((current) => ({ ...current, endDate: event.target.value }))
              }
              required
            />
          </div>
          <div className="field full">
            <label htmlFor="leave-reason">Reason</label>
            <input
              id="leave-reason"
              value={leaveForm.reason}
              onChange={(event) =>
                onChangeLeaveForm((current) => ({ ...current, reason: event.target.value }))
              }
              required
            />
          </div>
          <button className="button" disabled={loading} type="submit">
            <Send size={17} />
            Submit request
          </button>
        </form>
      )}

      <div className="record-list leave-list">
        {leaveRequests.length ? (
          leaveRequests.map((request) => {
            const member = users.find((item) => item._id === request.userId);
            return (
              <article className="record" key={request._id}>
                <div className="record-row">
                  <span className="record-title">
                    {member ? member.name : request.leaveType.replace("_", " ")}
                  </span>
                  <span
                    className={`pill ${
                      request.status === "rejected"
                        ? "danger"
                        : request.status === "pending"
                          ? "warn"
                          : "success-pill"
                    }`}
                  >
                    {request.status}
                  </span>
                </div>
                <span className="muted">
                  {formatDate(request.startDate)} to {formatDate(request.endDate)}
                </span>
                <span>{request.reason}</span>
                {request.managerComment && (
                  <span className="muted">Manager: {request.managerComment}</span>
                )}

                {isAdmin && request.status === "pending" && (
                  <div className="review-box">
                    <input
                      aria-label="Manager comment"
                      placeholder="Manager comment"
                      value={reviewComments[request._id] || ""}
                      onChange={(event) =>
                        onChangeReviewComment((current) => ({
                          ...current,
                          [request._id]: event.target.value,
                        }))
                      }
                    />
                    <div className="review-actions">
                      <button
                        className="button"
                        disabled={loading}
                        type="button"
                        onClick={() => onReview(request._id, "approved")}
                      >
                        <CheckCircle2 size={17} />
                        Approve
                      </button>
                      <button
                        className="button danger"
                        disabled={loading}
                        type="button"
                        onClick={() => onReview(request._id, "rejected")}
                      >
                        <XCircle size={17} />
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        ) : (
          <p className="muted">No leave requests yet.</p>
        )}
      </div>
    </section>
  );
}
