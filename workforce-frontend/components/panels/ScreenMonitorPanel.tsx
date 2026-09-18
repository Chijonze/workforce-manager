"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, Monitor, X } from "lucide-react";
import type { ScreenMonitorEmployee } from "@/types/workforce";

function getMonitorOptionValue(employee: ScreenMonitorEmployee) {
  return employee.activeMonitorId || employee.email || employee.id;
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
  const [isFullscreen, setIsFullscreen] = useState(false);

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
          <div className="field">
            <label htmlFor="screen-monitor-employee">Agent</label>
            <select
              id="screen-monitor-employee"
              value={selectedEmployeeId}
              onChange={(event) => onChangeEmployee(event.target.value)}
              disabled={isMonitoring || employees.length === 0}
            >
              {employees.length ? (
                employees.map((employee) => (
                  <option
                    key={employee.id || employee.email}
                    value={getMonitorOptionValue(employee)}
                    disabled={!employee.isOnline}
                  >
                    {employee.name} ({employee.email || employee.id}) - {employee.isOnline ? "Online" : "Offline"}
                  </option>
                ))
              ) : (
                <option value="">No agents available</option>
              )}
            </select>
          </div>

          <button className="button" disabled={!canMonitor || isMonitoring} type="button" onClick={onStart}>
            <Monitor size={17} />
            Monitor Screen
          </button>
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
