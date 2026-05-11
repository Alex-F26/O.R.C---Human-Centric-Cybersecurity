import { useEffect, useMemo, useRef, useState } from "react";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import "survey-core/survey-core.min.css";

import base from "../json-schema/base.json";
import pathSqli from "../json-schema/path_sqli.json";
import pathOscmd from "../json-schema/path_oscmd.json";
import pathCsrf from "../json-schema/path_csrf.json";
import pathXss from "../json-schema/path_xss.json";
import questions from "../json-schema/questions.json";

const INITIAL_TIME_MINUTES = 20;
const TOTAL_SECONDS = INITIAL_TIME_MINUTES * 60;

const PATH_COMPLETE_PAGES = new Set([
  "csrf_success"
]);

const POST_GAME_START_PAGE = "questions_1";

const surveyJson = {
  ...base,
  showProgressBar: "off",
  pages: [
    ...base.pages,
    ...pathSqli.pages,
    ...pathOscmd.pages,
    ...pathXss.pages,
    ...pathCsrf.pages,
    ...questions.pages,
  ],
};

function fmt(secs) {
  const s = Math.max(0, Math.floor(secs));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function makeSafeFileTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : JSON.stringify(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function getChoiceText(choice) {
  if (!choice) return "";
  return typeof choice.text === "string" ? choice.text : String(choice.text ?? choice.value ?? "");
}

function getFirstQuestionOnPage(page) {
  return page?.elements?.find((el) => Array.isArray(el.choices)) ?? null;
}

function getSelectedChoice(question, value) {
  if (!question || !Array.isArray(question.choices)) return null;
  return question.choices.find((choice) => choice.value === value) ?? null;
}

export default function SurveyWrapper() {
  const [timeLeft, setTimeLeft] = useState(TOTAL_SECONDS);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [showOverlay, setShowOverlay] = useState(null); // "timeout" | "pathComplete" | null
  const [toasts, setToasts] = useState([]);
  const [exportReady, setExportReady] = useState(false);
  const [finalPayload, setFinalPayload] = useState(null);
  const [actionMessage, setActionMessage] = useState("");

  const intervalRef = useRef(null);
  const timeLeftRef = useRef(TOTAL_SECONDS);
  const surveyRef = useRef(null);
  const startedRef = useRef(false);
  const selectedLockRef = useRef(false);
  const toastIdRef = useRef(0);
  const choiceHistoryRef = useRef([]);

  function stopTimer() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRunning(false);
  }

  function addToast(text, kind = "cost") {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, text, kind }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2200);
  }

  function applyTimeDelta(deltaMinutes, label) {
    const delta = Number(deltaMinutes ?? 0);
    const deltaSeconds = delta * 60;

    setTimeLeft((prev) => {
      const next = Math.max(0, Math.min(TOTAL_SECONDS, prev + deltaSeconds));
      timeLeftRef.current = next;
      return next;
    });

    if (delta < 0) addToast(`${delta} min — ${label}`, "cost");
    if (delta > 0) addToast(`+${delta} min bonus — ${label}`, "bonus");
  }

  function buildPayload(status = "completed") {
    const survey = surveyRef.current;
    return {
      status,
      exportedAt: new Date().toISOString(),
      timer: {
        initialMinutes: INITIAL_TIME_MINUTES,
        timeRemainingSeconds: timeLeftRef.current,
        timeUsedSeconds: TOTAL_SECONDS - timeLeftRef.current,
        timedOut,
      },
      answers: survey?.data ?? {},
      choiceHistory: choiceHistoryRef.current,
    };
  }

  function downloadJsonResults() {
    const payload = finalPayload ?? buildPayload("exported");
    downloadTextFile(
      `orc-results-${makeSafeFileTimestamp()}.json`,
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8"
    );
  }

  function downloadCsvResults() {
    const payload = finalPayload ?? buildPayload("exported");
    const rows = [];
    rows.push(["section", "field", "value"].map(csvEscape).join(","));
    rows.push(["timer", "initialMinutes", payload.timer.initialMinutes].map(csvEscape).join(","));
    rows.push(["timer", "timeRemainingSeconds", payload.timer.timeRemainingSeconds].map(csvEscape).join(","));
    rows.push(["timer", "timeUsedSeconds", payload.timer.timeUsedSeconds].map(csvEscape).join(","));
    rows.push(["timer", "timedOut", payload.timer.timedOut].map(csvEscape).join(","));

    Object.entries(payload.answers ?? {}).forEach(([key, value]) => {
      rows.push(["answer", key, value].map(csvEscape).join(","));
    });

    rows.push("");
    rows.push([
      "choiceIndex",
      "timestamp",
      "pageName",
      "questionName",
      "answerValue",
      "answerText",
      "timeDeltaMinutes",
      "advanceOnSelect",
      "gotoPage",
      "setChosenPath",
    ].map(csvEscape).join(","));

    payload.choiceHistory.forEach((item, index) => {
      rows.push([
        index + 1,
        item.timestamp,
        item.pageName,
        item.questionName,
        item.answerValue,
        item.answerText,
        item.timeDeltaMinutes,
        item.advanceOnSelect,
        item.gotoPage,
        item.setChosenPath,
      ].map(csvEscape).join(","));
    });

    downloadTextFile(
      `orc-results-${makeSafeFileTimestamp()}.csv`,
      rows.join("\n"),
      "text/csv;charset=utf-8"
    );
  }

  function goToPageByName(survey, pageName) {
    const page = survey.getPageByName(pageName);
    if (!page) {
      console.warn(`GOTO target not found: ${pageName}`);
      return false;
    }
    survey.currentPage = page;
    return true;
  }

  function goToPostGameQuestions() {
    const survey = surveyRef.current;
    if (!survey) return;
    setShowOverlay(null);
    goToPageByName(survey, POST_GAME_START_PAGE);
  }

  const [survey] = useState(() => {
    const s = new Model(surveyJson);
    surveyRef.current = s;

    s.onCurrentPageChanged.add((sender, { newCurrentPage }) => {
      const pageName = newCurrentPage?.name;

      if (pageName && pageName !== "start" && pageName !== POST_GAME_START_PAGE && !pageName.startsWith("questions") && !startedRef.current) {
        startedRef.current = true;
        setRunning(true);
      }

      if (PATH_COMPLETE_PAGES.has(pageName)) {
        stopTimer();
        setDone(true);
        setShowOverlay("pathComplete");
      }

      selectedLockRef.current = false;
      setActionMessage("");
    });

    s.onValueChanged.add((sender, options) => {
      const { name, value } = options;
      if (value === undefined || value === null || selectedLockRef.current) return;

      const page = sender.currentPage;
      if (!page || page.name?.startsWith("questions")) return;

      const question = page.elements?.find((el) => el.name === name && Array.isArray(el.choices));
      if (!question) return;

      const choice = getSelectedChoice(question, value);
      if (!choice) return;

      selectedLockRef.current = true;

      const timeDeltaMinutes = Number(choice.timeDeltaMinutes ?? 0);
      const advanceOnSelect = choice.advanceOnSelect !== false;
      const answerText = getChoiceText(choice);

      choiceHistoryRef.current.push({
        timestamp: new Date().toISOString(),
        pageName: page.name,
        questionName: name,
        answerValue: value,
        answerText,
        timeDeltaMinutes,
        advanceOnSelect,
        gotoPage: choice.gotoPage ?? null,
        setChosenPath: choice.setChosenPath ?? null,
      });

      applyTimeDelta(timeDeltaMinutes, answerText.replace(/<[^>]*>/g, ""));

      window.setTimeout(() => {
        if (timeLeftRef.current <= 0) {
          selectedLockRef.current = false;
          return;
        }

        if (!advanceOnSelect) {
          sender.clearValue(name);
          selectedLockRef.current = false;
          setActionMessage("That action used time but did not move you forward. Try another option.");
          return;
        }

        if (choice.setChosenPath) {
          sender.setValue("chosen_path", choice.setChosenPath);
        }

        if (choice.gotoPage) {
          if (choice.gotoPage === "path_selection") {
            sender.clearValue("chosen_path");
          }
          goToPageByName(sender, choice.gotoPage);
          selectedLockRef.current = false;
          return;
        }

        const defaultNextPage = page.defaultNextPage;
        if (defaultNextPage) {
          goToPageByName(sender, defaultNextPage);
          selectedLockRef.current = false;
          return;
        }

        sender.nextPage();
        selectedLockRef.current = false;
      }, 350);
    });

    s.onComplete.add((sender) => {
      stopTimer();
      setDone(true);
      const payload = buildPayload(timeLeftRef.current <= 0 ? "timed_out_completed_postgame" : "completed");
      setFinalPayload(payload);
      setExportReady(true);
    });

    return s;
  });

  useEffect(() => {
    if (!running || done) return undefined;

    intervalRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        const next = Math.max(0, prev - 1);
        timeLeftRef.current = next;

        if (next === 0) {
          stopTimer();
          setDone(true);
          setTimedOut(true);
          setShowOverlay("timeout");
        }

        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [running, done]);

  const pct = (timeLeft / TOTAL_SECONDS) * 100;
  const color = timeLeft > 300 ? "#22c55e" : timeLeft > 120 ? "#eab308" : "#ef4444";
  const pulse = timeLeft <= 60 && running;

  if (exportReady) {
    return (
      <div className="orc-context orc-win" style={{ maxWidth: 760, margin: "3rem auto", textAlign: "center" }}>
        <h2 style={{ color: "#c084fc", letterSpacing: 3 }}>EXPORT RESULTS</h2>
        <p>The post-game questionnaire is complete. Please download your results and email them to your project team.</p>
        <p style={{ color: "#9ca3af" }}>JSON is recommended because it keeps the full branching history. CSV is included for spreadsheet review.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 24 }}>
          <button className="orc-switch-btn" style={{ borderColor: "#c084fc", color: "#c084fc" }} onClick={downloadJsonResults}>
            Download JSON Results
          </button>
          <button className="orc-switch-btn" style={{ borderColor: "#22c55e", color: "#22c55e" }} onClick={downloadCsvResults}>
            Download CSV Results
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {showOverlay && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 99999,
          background: "#13141a",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "ui-monospace, Consolas, monospace",
          padding: 40,
        }}>
          <div className={`orc-context ${showOverlay === "timeout" ? "orc-error" : "orc-win"}`} style={{
            maxWidth: 600,
            textAlign: "center",
            fontSize: 15,
            lineHeight: 1.8,
          }}>
            <div style={{ fontSize: 28, marginBottom: 16 }}>{showOverlay === "timeout" ? "⛔" : "✅"}</div>
            <strong style={{ fontSize: 18, letterSpacing: 3, display: "block", marginBottom: 12 }}>
              {showOverlay === "timeout" ? "TIME EXPIRED" : "OPERATION COMPLETE"}
            </strong>
            {showOverlay === "timeout"
              ? "Your time is up. Please answer the following questions based on what you attempted."
              : "This path has reached an ending. Please answer the following post-game questions."}
          </div>
          <button
            className="orc-switch-btn"
            style={{ marginTop: 28, fontSize: 13, padding: "10px 24px", borderColor: "#c084fc", color: "#c084fc" }}
            onClick={goToPostGameQuestions}
          >
            → Proceed to Questions
          </button>
        </div>
      )}

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
      </div>

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
        {toasts.map((t) => (
          <div key={t.id} style={{
            background: t.kind === "bonus" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
            border: `1px solid ${t.kind === "bonus" ? "#22c55e" : "#ef4444"}`,
            borderRadius: 6,
            padding: "6px 12px",
            fontFamily: "ui-monospace, Consolas, monospace",
            fontSize: 12,
            color: t.kind === "bonus" ? "#22c55e" : "#ef4444",
            whiteSpace: "nowrap",
            animation: "toast-in 0.25s ease-out forwards",
          }}>
            {t.text}
          </div>
        ))}
      </div>

      {actionMessage && (
        <div className="orc-context orc-error" style={{ marginBottom: 16 }}>
          {actionMessage}
        </div>
      )}

      <Survey model={survey} />

      <style>{`
        @keyframes hud-pulse {
          0%, 100% { box-shadow: 0 0 24px #ef444466; }
          50% { box-shadow: 0 0 48px #ef4444cc; }
        }
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
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
        .orc-context.orc-error { border-color: #ef4444; }
        .orc-context.orc-success { border-color: #22c55e; }
        .orc-context.orc-win { border-color: #c084fc; color: #f3f4f6; font-size: 15px; }
        .orc-context code {
          background: rgba(0,0,0,0.3);
          padding: 1px 5px;
          border-radius: 3px;
          font-size: 13px;
        }
        .orc-context ul { margin: 8px 0 0 16px; padding: 0; }
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
        .sd-btn, .sd-action-bar .sd-btn { font-family: ui-monospace, Consolas, monospace; }
      `}</style>
    </div>
  );
}
