import { useEffect, useRef, useState } from "react";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import "survey-core/survey-core.min.css";
import base      from "../json-schema/base.json";
import pathSqli  from "../json-schema/path_sqli.json";
import pathOscmd from "../json-schema/path_oscmd.json";
import pathCsrf  from "../json-schema/path_csrf.json";
import pathXss   from "../json-schema/path_xss.json";
import questions from "../json-schema/questions.json";

const surveyJson = {
  ...base,
  pages: [
    ...base.pages,
    ...pathSqli.pages,
    ...pathOscmd.pages,
    ...pathCsrf.pages,
    ...pathXss.pages,
    ...questions.pages,
  ],
};

// Time costs in seconds
const TIME_COSTS = {
  recon_tool:    { nmap: 180, netdiscover: 60, wireshark: 240, manual: 120 },
  recon_target:  { db_server: 60, ssh_server: 60, mail_server: 60, web_server: 60 },
  chosen_path:   { sqli: 120, oscmd: 120, csrf: 120, xss: 120 },

  sqli_fingerprint:     { manual_quote: 60, sqlmap_detect: 120, burp_intercept: 180, source_view: 60 },
  sqli_exploit:         { auth_bypass: 60, union_select: 180, sqlmap_full: 240, blind_sqli: 300 },
  sqli_account:         { admin: 120, jsmith: 120, svc_transfer_xk9: 0, root: 300 },
  sqli_dead_end_choice: { retry_svc: 180, switch_path: 300 },
  sqli_final:           { immediate_transfer: 60, recon_more: 180, cover_tracks: 240 },

  oscmd_discover:    { semicolon_id: 60, burp_scan: 180, pipe_whoami: 60, commix_auto: 120 },
  oscmd_shell:       { bash_reverse: 120, python_reverse: 120, nc_mkfifo: 180, web_shell: 240 },
  oscmd_privesc:     { read_config: 60, suid_abuse: 180, sudo_check: 60, cron_hijack: 120 },
  oscmd_suid_choice: { fall_config: 120, fall_cron: 120 },
  oscmd_final:       { insert_transfer: 60, steal_session: 120, update_balance: 180 },

  csrf_recon:      { burp_csrf: 120, manual_review: 60, check_cookies: 60, owasp_zap: 180 },
  csrf_payload:    { auto_form: 60, img_tag: 120, fetch_api: 120, xmlhttprequest: 120 },
  csrf_img_choice: { fix_form: 120, fix_fetch: 120 },
  csrf_delivery:   { phish_cfo: 120, phish_ops: 120, internal_post: 180, wait_and_monitor: 300 },
  csrf_final:      { second_csrf: 120, session_hijack: 180, wait_auto: 300 },

  xss_discover:         { basic_alert: 60, dom_inspect: 120, burp_xss: 180, event_handler: 60 },
  xss_payload:          { cookie_steal: 60, keylogger: 240, beef_hook: 180, localstorage: 120 },
  xss_keylogger_choice: { switch_cookie: 120, switch_storage: 120 },
  xss_trigger:          { urgent_title: 60, email_notify: 120, mass_ticket: 180, wait_organic: 240 },
  xss_final:            { cookie_inject: 60, curl_api: 120, burp_replay: 120 },
};

const TOTAL_SECONDS = 20 * 60;
const SUCCESS_PAGES = new Set(["sqli_fail", "oscmd_fail", "csrf_success", "xss_fail"]);
const NO_SWITCH_PAGES = new Set(["start", "recon", "path_selection", "sqli_fail", "oscmd_fail", "csrf_success", "xss_fail"]);

function fmt(secs) {
  const s = Math.max(0, secs);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

let toastId = 0;

export default function SurveyWrapper() {
  const [timeLeft, setTimeLeft] = useState(TOTAL_SECONDS);
  const [running, setRunning]   = useState(false);
  const [done, setDone]         = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [toasts, setToasts]     = useState([]);
  const [history, setHistory]   = useState([]);
  const intervalRef  = useRef(null);
  const timeLeftRef  = useRef(TOTAL_SECONDS);
  const deductRef    = useRef(null);
  const surveyRef    = useRef(null);

  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  function stopTimer() {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRunning(false);
  }

  function deduct(seconds, label) {
    if (seconds <= 0) return;
    setTimeLeft(prev => Math.max(0, prev - seconds));
    const id = ++toastId;
    const mins = Math.round(seconds / 60);
    setToasts(prev => [...prev, { id, text: `-${mins} min — ${label}` }]);
    setHistory(prev => [{ id, text: label, secs: seconds }, ...prev].slice(0, 20));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500);
  }

  deductRef.current = deduct;

  // Countdown tick
  useEffect(() => {
    if (!running) return;
    if (intervalRef.current) return;

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setRunning(false);
          setDone(true);
          setTimedOut(true);
          surveyRef.current?.doComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [running]);

  const [survey] = useState(() => {
    const s = new Model(surveyJson);
    surveyRef.current = s;

    s.onCurrentPageChanged.add((_, { newCurrentPage }) => {
      const name = newCurrentPage?.name;

      if (name === "recon") setRunning(true);

      if (SUCCESS_PAGES.has(name)) {
        stopTimer();
        setDone(true);
      }
    });

    s.onValueChanged.add((_, { name, value }) => {
      const cost = TIME_COSTS[name]?.[value];
      if (cost > 0) deductRef.current(cost, `${name}: ${value}`);
    });

    s.onAfterRenderPage.add((_, { htmlElement, page }) => {
      // Only show switch button once a path has been chosen
      if (!s.getValue("chosen_path")) return;
      if (NO_SWITCH_PAGES.has(page.name)) return;
      // Avoid duplicate buttons if page re-renders
      if (htmlElement.querySelector(".orc-switch-btn")) return;

      const btn = document.createElement("button");
      btn.className = "orc-switch-btn";
      btn.textContent = "⚠ Switch Path [costs 5 min]";
      btn.onclick = () => {
        btn.remove();
        deductRef.current(300, "switch_path_penalty");

        // Clear all path-specific answers so the new path starts clean
        const pathKeys = Object.keys(TIME_COSTS).filter(k =>
          k !== "recon_tool" && k !== "recon_target" && k !== "chosen_path"
        );
        pathKeys.forEach(k => s.setValue(k, null));
        s.setValue("chosen_path", null);

        s.currentPage = s.getPageByName("path_selection");
      };

      htmlElement.insertBefore(btn, htmlElement.firstChild);
    });

    s.onComplete.add((sender) => {
      stopTimer();

      const results = {
        answers:       sender.data,
        timeRemaining: timeLeftRef.current,
        timeUsed:      TOTAL_SECONDS - timeLeftRef.current,
        timedOut:      timeLeftRef.current === 0,
        completedPath: sender.data.chosen_path ?? null,
      };

      console.log("ORC Results:", results);

      // Drop results wherever your backend/collection endpoint expects them.
      // e.g. fetch("/api/results", { method: "POST", body: JSON.stringify(results) });
    });

    return s;
  });

  const pct   = (timeLeft / TOTAL_SECONDS) * 100;
  const color = timeLeft > 300 ? "#22c55e" : timeLeft > 120 ? "#eab308" : "#ef4444";
  const pulse = timeLeft <= 60 && running;

  return (
    <div style={{ position: "relative" }}>

      {/* Timer HUD */}
      <div style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 9999,
        width: 220,
        background: "#16171d",
        border: `2px solid ${color}`,
        borderRadius: 10,
        padding: "12px 16px 14px",
        boxShadow: `0 0 24px ${color}55`,
        fontFamily: "ui-monospace, Consolas, monospace",
        animation: pulse ? "hud-pulse 0.8s ease-in-out infinite" : "none",
        transition: "border-color 0.4s, box-shadow 0.4s",
      }}>
        <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>
          {timedOut ? "⛔ TIME EXPIRED" : done ? "✅ COMPLETE" : running ? "⏱ TIME REMAINING" : "STANDBY"}
        </div>

        <div style={{ fontSize: 42, fontWeight: 800, color, lineHeight: 1, letterSpacing: 3, transition: "color 0.4s" }}>
          {fmt(timeLeft)}
        </div>

        <div style={{ marginTop: 10, background: "#2e303a", borderRadius: 4, height: 5, overflow: "hidden" }}>
          <div style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: 4,
            transition: "width 1s linear, background 0.4s",
          }} />
        </div>

        {history.length > 0 && (
          <div style={{ marginTop: 10, borderTop: "1px solid #2e303a", paddingTop: 8 }}>
            <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2, marginBottom: 4, textTransform: "uppercase" }}>
              Deductions
            </div>
            {history.slice(0, 5).map((h, i) => {
              const opacity = Math.max(0.25, 1 - i * 0.18);
              const mins = Math.round(h.secs / 60);
              return (
                <div key={h.id} style={{
                  fontSize: 10,
                  color: "#ef4444",
                  opacity: opacity,
                  lineHeight: 1.7,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  -{mins}m &nbsp;{h.text}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toast popups */}
      <div style={{
        position: "fixed",
        top: 16,
        right: 252,
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        alignItems: "flex-end",
        pointerEvents: "none",
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: "rgba(239,68,68,0.15)",
            border: "1px solid #ef4444",
            borderRadius: 6,
            padding: "6px 12px",
            fontFamily: "ui-monospace, Consolas, monospace",
            fontSize: 12,
            color: "#ef4444",
            whiteSpace: "nowrap",
            animation: "toast-in 0.25s ease-out forwards",
          }}>
            {t.text}
          </div>
        ))}
      </div>

      {/* Survey */}
      <Survey model={survey} />

      <style>{`
        @keyframes hud-pulse {
          0%, 100% { box-shadow: 0 0 24px #ef444466; }
          50%       { box-shadow: 0 0 48px #ef4444cc; }
        }
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .orc-intro, .orc-context {
          padding: 16px 20px;
          border-radius: 6px;
          border: 1px solid #2e303a;
          background: #1f2028;
          font-family: ui-monospace, Consolas, monospace;
          font-size: 14px;
          line-height: 1.6;
          color: #9ca3af;
        }
        .orc-intro h2 {
          color: #c084fc;
          font-size: 18px;
          margin: 0 0 12px;
          letter-spacing: 4px;
        }
        .orc-context.orc-error {
          border-color: #ef4444;
          background: rgba(239,68,68,0.08);
        }
        .orc-context.orc-success {
          border-color: #22c55e;
          background: rgba(34,197,94,0.08);
        }
        .orc-context.orc-win {
          border-color: #c084fc;
          background: rgba(192,132,252,0.1);
          color: #f3f4f6;
          font-size: 15px;
        }
        .orc-context code {
          background: rgba(0,0,0,0.3);
          padding: 1px 5px;
          border-radius: 3px;
          font-size: 13px;
        }
        .orc-context ul {
          margin: 8px 0 0 16px;
          padding: 0;
        }
        .orc-switch-btn {
          display: inline-block;
          margin-bottom: 16px;
          padding: 8px 16px;
          background: transparent;
          border: 1px solid #ef4444;
          border-radius: 6px;
          color: #ef4444;
          font-family: ui-monospace, Consolas, monospace;
          font-size: 12px;
          letter-spacing: 1px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .orc-switch-btn:hover {
          background: rgba(239, 68, 68, 0.1);
        }
      `}</style>
    </div>
  );
}
