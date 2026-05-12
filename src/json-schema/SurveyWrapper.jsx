import { useEffect, useRef, useState } from "react";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import "survey-core/survey-core.min.css";
import base      from "../json-schema/base.json";
import pathSqli  from "../json-schema/path_sqli.json";
import pathOscmd from "../json-schema/path_oscmd.json";
import pathCsrf  from "../json-schema/path_csrf.json";
import pathXss   from "../json-schema/path_xss.json";
import questions  from "../json-schema/questions.json";

// Survey JSON
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

// Time costs (seconds)
const TIME_COSTS = {
  recon_tool:   { nmap: 180, netdiscover: 60, wireshark: 240, manual: 120 },
  recon_target: { db_server: 60, ssh_server: 60, mail_server: 60, web_server: 60 },
  chosen_path:  { sqli: 120, oscmd: 120, csrf: 120, xss: 120 },

  sqli_fingerprint:          { manual_quote: 60, sqlmap_detect: 120, burp_intercept: 180, source_view: 60 },
  sqli_exploit:              { auth_bypass: 60, union_select: 180, sqlmap_full: 240, blind_sqli: 300 },
  sqli_account:              { admin: 120, jsmith: 120, svc_transfer_xk9: 0, root: 300 },
  sqli_dead_end_choice:      { retry_svc: 180, switch_path: 300 },
  sqli_final:                { immediate_transfer: 60, recon_more: 180, cover_tracks: 240 },
  sqli_redirect_dead_choice: { retry_sqli: 120, switch_path: 300 },
  sqli_blind_dead_choice:    { retry_sqli: 120, switch_path: 300 },
  sqli_honeypot_choice:      { retry_sqli: 180, switch_path: 300 },
  sqli_temp_password_choice: { retry_sqli: 180, switch_path: 300 },
  sqli_finance_dead_choice:  { retry_sqli: 120, switch_path: 300 },
  sqli_privesc_dead_choice:  { retry_sqli: 120, switch_path: 300 },
  sqli_more_intel_choice:    { retry_sqli: 120, switch_path: 300 },
  sqli_audit_dead_choice:    { retry_sqli: 120, switch_path: 300 },
  sqli_crack_dead_choice:    { retry_sqli: 120, switch_path: 300 },
  sqli_session_inject_choice:{ retry_sqli: 120, switch_path: 300 },
  sqli_reset_choice:         { retry_sqli: 120, switch_path: 300 },
  sqli_auth_bypass_choice:   { retry_sqli: 180, switch_path: 300 },
  sqli_final_dead_choice:    { switch_path: 300 },

  oscmd_q1_answer:      { employee_lookup: 120, report_export: 120, login_portal: 60, system_status: 120 },
  oscmd_q2_answer:      { input_test: 60, stage_persistence_post: 300, manual_bruteforce: 240, approve_transfer_login: 240 },
  oscmd_q3_answer:      { status_code_only: 60, directory_scan_first: 60, realistic_usernames: 60, fuzz_backend_behavior: 60 },
  oscmd_q4_answer:      { check_transfer_before_confirming: 240, compare_controlled_responses: 120, install_tools_debug: 300, bruteforce_and_tool: 360 },
  oscmd_q5_answer:      { fake_admin_profile: 180, os_files: 240, app_data_files: 120, employee_bruteforce_info: 120 },
  oscmd_q6_answer:      { support_notes: 60, backup_config: 60, public_policy: 60, user_and_password_lists: 120 },
  oscmd_q7_answer:      { create_wordlist: 240, restart_recon: 300, assume_admin: 300, manual_try_all: 480 },
  oscmd_q7_1_answer:    { run_bruteforce_tooling: 420, ignore_restart: 300, admin_labeled_first: 300, manual_first_pairs: 480 },
  oscmd_q8_answer:      { fake_admin_search: 180, profile_picture: 120, messages_permissions: 120, wordlist_other_pages: 360 },
  oscmd_q9_answer:      { office_memo: 60, finance_routing: 120, it_newsletter: 120, logged_admin_alert: 180 },
  oscmd_q10_answer:     { chase_admin: 240, restart_homepage: 180, print_shadow_files: 120, check_inbox_permissions: 60 },
  oscmd_q10_1_answer:   { direct_login_spray_hashes: 300, restart_homepage: 240, john_wordlist: 540, check_inbox_permissions: 60 },
  oscmd_q10_2_answer:   { hashcat_wordlist: 480, restart_homepage: 240, hashes_as_passwords: 300, check_inbox_permissions: 60 },
  oscmd_q10_3_answer:   { wordlist_bruteforce: 480, restart_homepage: 240, different_hash_mode: 300, check_inbox_permissions: 60 },
  oscmd_q10_4_answer:   { restart_homepage: 240, try_sql_injection: 540, check_inbox_permissions: 60 },
  oscmd_q11_answer:     { install_persistence: 240, pivot_other_vuln: 180, follow_lead: 180 },
  oscmd_q12_answer:     { pivot_other_vuln: 180, follow_lead: 300, apt_install_from_login: 180, quit: 0 },
  oscmd_q12_1_answer:   { system_diagnostics: 180, change_local_config: 120, retry_package_manager: 240, manual_webpage_install: 420 },
  oscmd_q12_2_1_answer: { system_diagnostics_again: 180, change_local_config_again: 120, retry_package_manager_again: 240, manual_webpage_install: 420 },
  oscmd_q12_3_answer:   { basic_network_troubleshoot: 180, change_local_config: 120, pivot_other_vuln: 300, compile_custom_programs: 360 },
  oscmd_q12_3_1_answer: { extensive_network_troubleshoot: 180, change_local_config: 120, pivot_other_vuln: 300, follow_admin_lead: 360 },
  oscmd_q13_answer:     { pivot_other_vuln: 180, reset_password_observe: 300, compare_public_hash_examples: 240, search_config_salt: 360 },
  oscmd_q14_answer:     { change_password_again: 180, make_new_account: 240, reassess_machine_value: 0, compare_hash_pattern: 240 },
  oscmd_q15_answer:     { retry_cracking_salted: 540, stage_persistence: 900, troubleshoot_failed_request: 240, unrelated_system_checks: 180 },
  oscmd_q16_answer:     { recon_each_account: 540, stage_persistence: 900, pivot_other_vuln: 300 },
  oscmd_q16_1_answer:   { analyze_files: 720, stage_persistence: 900, reassess_value: 600, pivot_other_vuln: 0 },
  oscmd_q16_2_1_answer: { analyze_network: 540, assess_files_dirs: 240, extensive_troubleshoot: 480, retry_callback_name: 360 },
  oscmd_q16_2_2_answer: { analyze_network: 540, assess_files_dirs: 480, extensive_troubleshoot: 540, pivot_other_vuln: 0 },
  oscmd_q16_2_3_answer: { bypass_filtering: 480, reassess_value: 600, assess_files_dirs: 480, pivot_csrf: 300 },
  oscmd_q16_2_3_1_answer: { reassess_value: 600, assess_files_dirs: 480, pivot_other_vuln: 0 },
  oscmd_q17_answer:     { back_to_vuln_selection: 0 },

  xss_q1_answer:  { nmap_scan: 480, search_cves: 1080, browse_manually: 300 },
  xss_q2_answer:  { log_surface: 0, ignore_search: 300, fingerprint_stack: 360 },
  xss_q3_answer:  { direct_script_test: 900, intercept_request: 300, benign_test: 60, fuzz_length: 420 },
  xss_q4_answer:  { credential_payload_now: 720, compare_search: 240, confirm_active_behavior: 60, document_only: 540 },
  xss_q5_answer:  { focus_comment_only: 480, map_all_surfaces: 120, stress_test: 1200, enumerate_dirs: 360 },
  xss_q6_answer:  { run_dirb: 480, credential_capture_detour: 0, retry_payload: 720 },
  xss_q7_answer:  { continue_exfil_attempt: 600, decode_cookie: 480, sim_phish_form: 0 },
  xss_q8_answer:  { build_reflected_link: 480, inspect_dom: 600, hunt_second_order: 300, confirm_stored: 0 },
  xss_q9_answer:  { finance_channel: 360, general_discussion: 60, it_support: 240, all_channels: 840 },
  xss_q10_answer: { skip_pinned: 300, post_elsewhere: 180, inject_welcome: 0, enumerate_links: 240 },
  xss_q11_answer: { external_redirect: 960, sim_session_prompt: 60, key_capture: 420, browser_hook: 600 },
  xss_q12_answer: { validate_forum: 360, analyze_format: 0, test_vpn: 720, queue_harvest: 240 },
  xss_q13_answer: { stuff_vpn: 1200, validate_forum_all: 420, analyze_list: 120, sort_reuse: 240 },
  xss_q14_answer: { test_vpn_all: 300, check_forum_perms: 1500, try_it_admin: 60, try_hr_director: 360 },
  xss_q15_answer: { redeploy_payload: 1680, bruteforce_vpn: 2100, expand_testing: 720 },
  xss_q16_answer: { redeploy_second_payload: 1200, bruteforce_again: 1500, keep_testing_services: 900 },
  xss_pivot_answer: { return_path_select: 0 },

  csrf_cookie_choice:       { intercept_now: 60, skip_to_payload: 120 },
  csrf_recon:               { burp_csrf: 120, manual_review: 60, check_cookies: 60, owasp_zap: 180 },
  csrf_payload:             { auto_form: 60, img_tag: 120, fetch_api: 120, xmlhttprequest: 120 },
  csrf_img_choice:          { fix_form: 120, fix_fetch: 120 },
  csrf_fetch_dead_choice:   { switch_to_form: 60, switch_path: 300 },
  csrf_delivery:            { phish_cfo: 120, phish_ops: 120, internal_post: 180, wait_and_monitor: 300 },
  csrf_cfo_dead_choice:     { retry_delivery: 120, switch_path: 300 },
  csrf_board_dead_choice:   { retry_delivery: 120, switch_path: 300 },
  csrf_final:               { second_csrf: 120, session_hijack: 180, wait_auto: 300, cancel_monitor: 240 },
  csrf_monitor_dead_choice: { retry_final: 120, switch_path: 300 },
  csrf_hijack_dead_choice:  { retry_final: 120, switch_path: 300 },
};

// Constants
const TOTAL_SECONDS = 20 * 60;
const SUCCESS_PAGES = new Set(["csrf_success"]);
const NO_SWITCH_PAGES = new Set(["start", "recon", "path_selection", "csrf_success"]);
const SHEETS_URL = "https://script.google.com/macros/s/AKfycbwBGSAN8Ocvr7AvNZM6IIrteuUPnp0Py0_AuxyN2tZgScbejiKjoQkmJz04Ig6xZ7cw0A/exec";

function fmt(secs) {
  const s = Math.max(0, secs);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

let toastId = 0;

// Component
export default function SurveyWrapper() {
  const [timeLeft, setTimeLeft] = useState(TOTAL_SECONDS);
  const [running, setRunning]   = useState(false);
  const [done, setDone]         = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [toasts, setToasts]     = useState([]);
  const [history, setHistory]   = useState([]);

  const intervalRef     = useRef(null);
  const timeLeftRef     = useRef(TOTAL_SECONDS);
  const deductRef       = useRef(null);
  const surveyRef       = useRef(null);
  const timedOutRef     = useRef(false);
  const startedRef      = useRef(false);
  const isSwitchingPath = useRef(false);

  // Sheets submit
  async function submitToSheets(payload) {
    try {
      await fetch(SHEETS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("Sheet submit failed:", err);
    }
  }

  // Timer helpers
  function stopTimer() {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRunning(false);
  }

  function deduct(seconds, label) {
    if (seconds <= 0) return;
    setTimeLeft(prev => Math.max(0, prev - seconds));
    timeLeftRef.current = Math.max(0, timeLeftRef.current - seconds);
    const id = ++toastId;
    const mins = Math.round(seconds / 60);
    setToasts(prev => [...prev, { id, text: `-${mins} min — ${label}` }]);
    setHistory(prev => [{ id, text: label, secs: seconds }, ...prev].slice(0, 20));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500);
  }

  deductRef.current = deduct;

  // Countdown
  useEffect(() => {
    if (!running || done) return;

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const next = Math.max(0, prev - 1);
        timeLeftRef.current = next;

        if (next === 0 && !timedOutRef.current) {
          timedOutRef.current = true;
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setRunning(false);
          setDone(true);
          setTimedOut(true);
        }

        return next;
      });
    }, 1000);

    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [running, done]);

  // Survey model (stable — created once)
  const [survey] = useState(() => {
    const s = new Model(surveyJson);
    s.surveyPostId = "b9a511dd-5934-42ff-acb0-574de416e0f1";
    surveyRef.current = s;

    // Page change
    s.onCurrentPageChanged.add((_, { oldCurrentPage, newCurrentPage }) => {
      const name = newCurrentPage?.name;

      if (name && name !== "start" && !startedRef.current) {
        startedRef.current = true;
        setRunning(true);
      }

      if (SUCCESS_PAGES.has(name)) {
        stopTimer();
        setDone(true);
      }

      // Deduct time for answers on the page we just left
      if (oldCurrentPage) {
        oldCurrentPage.elements.forEach(el => {
          const questionName = el.name;
          const value = s.getValue(questionName);
          if (value == null) return;
          const cost = TIME_COSTS[questionName]?.[value];
          if (cost > 0) deductRef.current(cost, `${questionName}: ${value}`);
        });
      }
    });

    // Value change — handle special navigation values
    s.onValueChanged.add((_, { name, value }) => {
      if (value === "switch_path") {
        deductRef.current(300, "switch_path_penalty");
        const currentPath = s.getValue("chosen_path");
        const prefix = currentPath ? `${currentPath}_` : null;
        if (prefix) {
          Object.keys(s.data).forEach(key => {
            if (key.startsWith(prefix)) s.clearValue(key);
          });
        }
        isSwitchingPath.current = true;
        setTimeout(() => {
          s.currentPage = s.getPageByName("path_selection");
          setTimeout(() => {
            s.clearValue("chosen_path");
            isSwitchingPath.current = false;
          }, 50);
        }, 100);
      }

      if (value === "retry_final") {
        deductRef.current(120, `${name}: retry_final`);
        setTimeout(() => { s.clearValue(name); s.currentPage = s.getPageByName("csrf_4"); }, 100);
      }

      if (value === "retry_delivery") {
        deductRef.current(120, `${name}: retry_delivery`);
        setTimeout(() => { s.clearValue(name); s.currentPage = s.getPageByName("csrf_3"); }, 100);
      }

      if (value === "retry_sqli") {
        deductRef.current(120, `${name}: retry_sqli`);
        setTimeout(() => { s.clearValue(name); s.currentPage = s.getPageByName("sqli_2"); }, 100);
      }

      if (["return_path_select", "back_to_vuln_selection", "pivot_other_vuln", "pivot_csrf"].includes(value)) {
        setTimeout(() => { s.clearValue(name); s.currentPage = s.getPageByName("path_selection"); }, 100);
      }
    });

    // Inject "Switch Path" button on game pages
    s.onAfterRenderPage.add((_, { htmlElement, page }) => {
      if (page.name.startsWith("questions")) return;
      if (!s.getValue("chosen_path")) return;
      if (NO_SWITCH_PAGES.has(page.name)) return;
      if (htmlElement.querySelector(".orc-switch-btn")) return;

      const btn = document.createElement("button");
      btn.className = "orc-switch-btn";
      btn.textContent = "⚠ Switch Path [costs 5 min]";
      btn.onclick = () => {
        btn.remove();
        deductRef.current(300, "switch_path_penalty");
        const pathKeys = Object.keys(TIME_COSTS).filter(k =>
          k !== "recon_tool" && k !== "recon_target" && k !== "chosen_path"
        );
        pathKeys.forEach(k => s.setValue(k, null));
        s.setValue("chosen_path", null);
        s.currentPage = s.getPageByName("path_selection");
      };
      htmlElement.insertBefore(btn, htmlElement.firstChild);
    });

    // Complete
    s.onComplete.add((sender) => {
      stopTimer();
      setDone(true);
      const payload = {
        status: timeLeftRef.current <= 0 ? "timed_out_completed_postgame" : "completed",
        exportedAt: new Date().toISOString(),
        timer: {
          totalSeconds: TOTAL_SECONDS,
          timeRemainingSeconds: timeLeftRef.current,
          timeUsedSeconds: TOTAL_SECONDS - timeLeftRef.current,
          timedOut: timeLeftRef.current === 0,
        },
        answers: sender.data,
        completedPath: sender.data.chosen_path ?? null,
      };
      submitToSheets(payload);
      console.log("ORC Results:", payload);
    });

    return s;
  });

  // Derived display values
  const pct   = (timeLeft / TOTAL_SECONDS) * 100;
  const color = timeLeft > 300 ? "#22c55e" : timeLeft > 120 ? "#eab308" : "#ef4444";
  const pulse = timeLeft <= 60 && running;

  // Proceed to questions handler 
  function proceedToQuestions() {
    const qPage = surveyRef.current?.getPageByName("questions_1");
    if (qPage) {
      surveyRef.current.ignoreValidation = true;
      surveyRef.current.currentPage = qPage;
    }
  }

  // Render
  return (
    <div style={{ position: "relative" }}>

      {/* Timeout banner — shown above survey when time expires */}
      {timedOut && (
        <div style={{
          background: "#1f2028",
          border: "1px solid #ef4444",
          borderRadius: 8,
          padding: "24px 28px",
          fontFamily: "ui-monospace, Consolas, monospace",
          color: "#9ca3af",
          marginBottom: 20,
          lineHeight: 1.6,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⛔</div>
          <strong style={{
            fontSize: 18,
            letterSpacing: 3,
            display: "block",
            marginBottom: 12,
            color: "#f3f4f6",
            textTransform: "uppercase",
          }}>
            Time Expired
          </strong>
          Your time is up. The operation is over.
          <br /><br />
          Please answer the following debrief questions based on what you attempted during the simulation.
          <br /><br />
          <button
            onClick={proceedToQuestions}
            style={{
              background: "transparent",
              border: "1px solid #c084fc",
              borderRadius: 6,
              color: "#c084fc",
              fontFamily: "ui-monospace, Consolas, monospace",
              fontSize: 12,
              letterSpacing: 2,
              padding: "10px 20px",
              cursor: "pointer",
              textTransform: "uppercase",
              transition: "background 0.2s",
            }}
            onMouseEnter={e => e.target.style.background = "rgba(192,132,252,0.1)"}
            onMouseLeave={e => e.target.style.background = "transparent"}
          >
            → Proceed to Debrief Questions
          </button>
        </div>
      )}

      {/* Survey */}
      <Survey model={survey} />

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
          {timedOut ? "⛔ Time Expired" : done ? "✅ Complete" : running ? "⏱ Time Remaining" : "Standby"}
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
            {history.slice(0, 5).map((h, i) => (
              <div key={h.id} style={{
                fontSize: 10,
                color: "#ef4444",
                opacity: Math.max(0.25, 1 - i * 0.18),
                lineHeight: 1.7,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                -{Math.round(h.secs / 60)}m &nbsp;{h.text}
              </div>
            ))}
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
        .orc-context.orc-error  { border-color: #ef4444; }
        .orc-context.orc-success { border-color: #22c55e; }
        .orc-context.orc-win {
          border-color: #c084fc;
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
        .orc-switch-btn:hover { background: rgba(239, 68, 68, 0.1); }
        }
        .survey-timed-out .sd-navigation {
          display: none !important;
        }
        .survey-timed-out .sd-page:not(.questions-page):not([data-name="timeout"]) {
          display: none !important;
        }
        .survey-timed-out .questions-page ~ .sd-navigation,
        .survey-timed-out .sd-body:has(.questions-page) .sd-navigation {
          display: block !important;
        }
      `}</style>
    </div>
  );
}
