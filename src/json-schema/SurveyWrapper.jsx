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

const INITIAL_TIME_MINUTES = 30;
const TOTAL_SECONDS = INITIAL_TIME_MINUTES * 60;
const SWITCH_PATH_DELTA_MINUTES = -5;
const NAVIGATION_DELAY_MS = 250;

const surveyJson = {
  ...base,
  showProgressBar: "off",
  showTimerPanel: "none",
  pages: [
    ...base.pages,
    ...pathSqli.pages,
    ...pathOscmd.pages,
    ...pathCsrf.pages,
    ...pathXss.pages,
    ...questions.pages,
  ],
};

const PATH_PREFIX_TO_VALUE = {
  sqli: "sqli",
  oscmd: "oscmd",
  csrf: "csrf",
  xss: "xss",
};

// Pages that represent a completed operation and should pause the timer,
// then show the overlay that sends participants to the post-game questions.
const END_PAGES = new Set(["csrf_success"]);

// Pages that should not show the manual Switch Path button.
const NO_SWITCH_PAGES = new Set([
  "start",
  "recon",
  "path_selection",
  "questions_1",
  "questions_2",
  "questions_3",
  "csrf_success",
]);

function fmt(secs) {
  const s = Math.max(0, secs);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function buildSurveyMeta(json) {
  const pageNames = new Set();
  const pageIndex = new Map();
  const choiceIndex = new Map();
  const pageDefaults = new Map();

  json.pages.forEach((page, index) => {
    pageNames.add(page.name);
    pageIndex.set(page.name, index);
    if (page.defaultNextPage) pageDefaults.set(page.name, page.defaultNextPage);

    page.elements?.forEach((element) => {
      if (!Array.isArray(element.choices)) return;
      const byValue = choiceIndex.get(element.name) ?? new Map();
      element.choices.forEach((choice) => {
        byValue.set(choice.value, { ...choice, pageName: page.name, questionName: element.name });
      });
      choiceIndex.set(element.name, byValue);
    });
  });

  return { pageNames, pageIndex, choiceIndex, pageDefaults };
}

function getPathFromPageName(pageName) {
  if (!pageName || pageName === "path_selection" || pageName.startsWith("questions")) return null;
  const prefix = pageName.split("_")[0];
  return PATH_PREFIX_TO_VALUE[prefix] ?? null;
}

function getNextPageName(survey, meta, currentPageName) {
  const defaultNext = meta.pageDefaults.get(currentPageName);
  if (defaultNext) return defaultNext;

  const currentIndex = meta.pageIndex.get(currentPageName);
  if (currentIndex == null) return null;

  for (let i = currentIndex + 1; i < survey.pages.length; i += 1) {
    const candidate = survey.pages[i];
    if (candidate?.isVisible) return candidate.name;
  }
  return null;
}

function makeCsvValue(value) {
  if (value == null) return "";
  const stringValue = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${stringValue.replaceAll('"', '""')}"`;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(makeCsvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function SurveyWrapper() {
  const meta = useMemo(() => buildSurveyMeta(surveyJson), []);
  const [timeLeft, setTimeLeft] = useState(TOTAL_SECONDS);
  const [running, setRunning] = useState(false);
  const [timerStopped, setTimerStopped] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [overlay, setOverlay] = useState(null); // "timeout" | "complete" | null
  const [surveyFinished, setSurveyFinished] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);

  const intervalRef = useRef(null);
  const timeLeftRef = useRef(TOTAL_SECONDS);
  const surveyRef = useRef(null);
  const startedRef = useRef(false);
  const lockedRef = useRef(false);
  const programmaticValueChangeRef = useRef(false);
  const choiceHistoryRef = useRef([]);

  function stopTimer() {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRunning(false);
    setTimerStopped(true);
  }

  function applyTimeDelta(deltaMinutes) {
    if (typeof deltaMinutes !== "number" || Number.isNaN(deltaMinutes)) return;
    const deltaSeconds = Math.round(deltaMinutes * 60);
    setTimeLeft((previous) => {
      const next = Math.max(0, Math.min(TOTAL_SECONDS, previous + deltaSeconds));
      timeLeftRef.current = next;
      if (next === 0 && previous > 0 && deltaSeconds < 0) {
        window.setTimeout(() => {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setRunning(false);
          setTimerStopped(true);
          setTimedOut(true);
          setOverlay("timeout");
        }, 0);
      }
      return next;
    });
  }

  function recordChoice({ pageName, questionName, value, text, timeDeltaMinutes, gotoPage }) {
    choiceHistoryRef.current.push({
      timestamp: new Date().toISOString(),
      pageName,
      questionName,
      value,
      text,
      timeDeltaMinutes: typeof timeDeltaMinutes === "number" ? timeDeltaMinutes : 0,
      gotoPage: gotoPage ?? "",
      timeRemainingSeconds: timeLeftRef.current,
    });
  }

  function goToPage(survey, pageName) {
    if (!pageName) return false;
    const page = survey.getPageByName(pageName);
    if (!page) {
      console.warn(`[ORC] GOTO target not found: ${pageName}`);
      return false;
    }

    if (pageName === "path_selection") {
      programmaticValueChangeRef.current = true;
      survey.clearValue("chosen_path");
      programmaticValueChangeRef.current = false;
    } else {
      const nextPath = getPathFromPageName(pageName);
      if (nextPath && survey.getValue("chosen_path") !== nextPath) {
        programmaticValueChangeRef.current = true;
        survey.setValue("chosen_path", nextPath);
        programmaticValueChangeRef.current = false;
      }
    }

    survey.currentPage = page;
    return true;
  }

  function proceedToPostGame() {
    setOverlay(null);
    const survey = surveyRef.current;
    if (!survey) return;
    const page = survey.getPageByName("questions_1");
    if (page) survey.currentPage = page;
  }

  function handleChoice(survey, questionName, value) {
    if (lockedRef.current || surveyFinished || overlay) return;
    const choice = meta.choiceIndex.get(questionName)?.get(value);
    if (!choice) return;

    const currentPageName = survey.currentPage?.name;
    if (!currentPageName || currentPageName.startsWith("questions")) return;

    lockedRef.current = true;
    setActionFeedback(null);
    const question = survey.getQuestionByName(questionName);
    if (question) question.readOnly = true;

    const delta = typeof choice.timeDeltaMinutes === "number" ? choice.timeDeltaMinutes : 0;
    const shouldAdvance = choice.advanceOnSelect !== false;

    applyTimeDelta(delta);
    recordChoice({
      pageName: currentPageName,
      questionName,
      value,
      text: choice.text,
      timeDeltaMinutes: delta,
      gotoPage: shouldAdvance ? choice.gotoPage : currentPageName,
    });

    window.setTimeout(() => {
      const updatedSurvey = surveyRef.current;
      if (!updatedSurvey) return;

      if (!shouldAdvance) {
        // Wrong actions waste time, then keep the participant on the same question.
        // We clear only this answer so they can try another option. The choice remains in choiceHistory.
        programmaticValueChangeRef.current = true;
        updatedSurvey.clearValue(questionName);
        programmaticValueChangeRef.current = false;
        if (question) question.readOnly = false;
        setActionFeedback("That action did not move you forward. Time was deducted. Try another option.");
        lockedRef.current = false;
        return;
      }

      const target = choice.gotoPage || choice.nextPage || getNextPageName(updatedSurvey, meta, currentPageName);
      const didNavigate = goToPage(updatedSurvey, target);
      if (!didNavigate) updatedSurvey.nextPage();

      window.setTimeout(() => {
        updatedSurvey.currentPage?.elements?.forEach((element) => {
          if (element.readOnly) element.readOnly = false;
        });
        lockedRef.current = false;
      }, 50);
    }, NAVIGATION_DELAY_MS);
  }

  function handlePathComplete(pageName) {
    if (pageName && END_PAGES.has(pageName)) {
      stopTimer();
      setOverlay("complete");
    }
  }

  function exportResultsCsv() {
    const survey = surveyRef.current;
    const answers = survey?.data ?? {};
    const rows = [
      ["section", "timestamp", "pageName", "questionName", "value", "text", "timeDeltaMinutes", "gotoPage", "timeRemainingSeconds"],
      ["summary", new Date().toISOString(), "", "timeRemainingSeconds", timeLeftRef.current, "", "", "", ""],
      ["summary", new Date().toISOString(), "", "timeUsedSeconds", TOTAL_SECONDS - timeLeftRef.current, "", "", "", ""],
      ["summary", new Date().toISOString(), "", "timedOut", timedOut, "", "", "", ""],
      ["summary", new Date().toISOString(), "", "completedPath", answers.chosen_path ?? "", "", "", "", ""],
      ...choiceHistoryRef.current.map((entry) => [
        "choice",
        entry.timestamp,
        entry.pageName,
        entry.questionName,
        entry.value,
        entry.text,
        entry.timeDeltaMinutes,
        entry.gotoPage,
        entry.timeRemainingSeconds,
      ]),
      ...Object.entries(answers).map(([key, value]) => [
        "answer",
        new Date().toISOString(),
        "",
        key,
        value,
        "",
        "",
        "",
        "",
      ]),
    ];
    downloadCsv(`orc-results-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`, rows);
  }

  useEffect(() => {
    if (!running || timerStopped) return undefined;

    intervalRef.current = window.setInterval(() => {
      setTimeLeft((previous) => {
        const next = Math.max(0, previous - 1);
        timeLeftRef.current = next;
        if (next === 0) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setRunning(false);
          setTimerStopped(true);
          setTimedOut(true);
          setOverlay("timeout");
        }
        return next;
      });
    }, 1000);

    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [running, timerStopped]);

  const [survey] = useState(() => {
    const model = new Model(surveyJson);
    surveyRef.current = model;

    model.onCurrentPageChanged.add((sender, options) => {
      setActionFeedback(null);
      const name = options.newCurrentPage?.name;
      if (name && name !== "start" && !name.startsWith("questions") && !startedRef.current) {
        startedRef.current = true;
        setRunning(true);
      }
      handlePathComplete(name);
    });

    model.onValueChanged.add((sender, options) => {
      if (programmaticValueChangeRef.current) return;
      handleChoice(sender, options.name, options.value);
    });

    model.onAfterRenderPage.add((sender, { htmlElement, page }) => {
      if (!page || page.name.startsWith("questions")) return;
      if (!sender.getValue("chosen_path")) return;
      if (NO_SWITCH_PAGES.has(page.name)) return;
      if (htmlElement.querySelector(".orc-switch-btn")) return;

      const button = document.createElement("button");
      button.className = "orc-switch-btn";
      button.textContent = "⚠ Switch Path [costs 5 min]";
      button.onclick = () => {
        if (lockedRef.current) return;
        lockedRef.current = true;
        applyTimeDelta(SWITCH_PATH_DELTA_MINUTES);
        recordChoice({
          pageName: sender.currentPage?.name ?? "",
          questionName: "manual_switch_path",
          value: "switch_path",
          text: "Switch Path [costs 5 min]",
          timeDeltaMinutes: SWITCH_PATH_DELTA_MINUTES,
          gotoPage: "path_selection",
        });
        goToPage(sender, "path_selection");
        window.setTimeout(() => {
          lockedRef.current = false;
        }, 50);
      };
      htmlElement.insertBefore(button, htmlElement.firstChild);
    });

    model.onComplete.add(() => {
      stopTimer();
      setSurveyFinished(true);
      console.log("ORC Results:", {
        answers: model.data,
        choiceHistory: choiceHistoryRef.current,
        timeRemaining: timeLeftRef.current,
        timeUsed: TOTAL_SECONDS - timeLeftRef.current,
        timedOut,
        completedPath: model.data.chosen_path ?? null,
      });
    });

    return model;
  });

  const pct = (timeLeft / TOTAL_SECONDS) * 100;
  const color = timeLeft > 300 ? "#22c55e" : timeLeft > 120 ? "#eab308" : "#ef4444";
  const pulse = timeLeft <= 60 && running;

  return (
    <div style={{ position: "relative" }}>
      {overlay && (
        <div
          style={{
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
          }}
        >
          <div
            className={overlay === "timeout" ? "orc-context orc-error" : "orc-context orc-win"}
            style={{ maxWidth: 620, textAlign: "center", fontSize: 15, lineHeight: 1.8 }}
          >
            <div style={{ fontSize: 28, marginBottom: 16 }}>{overlay === "timeout" ? "⛔" : "✅"}</div>
            <strong style={{ fontSize: 18, letterSpacing: 3, display: "block", marginBottom: 12 }}>
              {overlay === "timeout" ? "TIME EXPIRED" : "OPERATION COMPLETE"}
            </strong>
            {overlay === "timeout"
              ? "Your time is up. The operation is over. Please answer the following questions based on what you attempted."
              : "This path reached an ending condition. Please answer the following questions based on your decisions."}
          </div>
          <button
            className="orc-switch-btn"
            style={{ marginTop: 28, fontSize: 13, padding: "10px 24px", borderColor: "#c084fc", color: "#c084fc" }}
            onClick={proceedToPostGame}
          >
            → Proceed to Post-Game Questions
          </button>
        </div>
      )}

      <div
        style={{
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
        }}
      >
        <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>
          {timedOut ? "⛔ TIME EXPIRED" : timerStopped ? "✅ STOPPED" : running ? "⏱ TIME REMAINING" : "STANDBY"}
        </div>
        <div style={{ fontSize: 42, fontWeight: 800, color, lineHeight: 1, letterSpacing: 3, transition: "color 0.4s" }}>
          {fmt(timeLeft)}
        </div>
        <div style={{ marginTop: 10, background: "#2e303a", borderRadius: 4, height: 5, overflow: "hidden" }}>
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: color,
              borderRadius: 4,
              transition: "width 1s linear, background 0.4s",
            }}
          />
        </div>
      </div>

      {surveyFinished && (
        <div style={{ marginBottom: 16, paddingTop: 8 }}>
          <button className="orc-export-btn" onClick={exportResultsCsv}>
            Download Results CSV
          </button>
        </div>
      )}

      {actionFeedback && (
        <div className="orc-action-feedback" role="status">
          {actionFeedback}
        </div>
      )}

      <Survey model={survey} />

      <style>{`
        @keyframes hud-pulse {
          0%, 100% { box-shadow: 0 0 24px #ef444466; }
          50% { box-shadow: 0 0 48px #ef4444cc; }
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
        .orc-context.orc-error, .orc-context.orc-fail {
          border-color: #ef4444;
        }
        .orc-context.orc-success {
          border-color: #22c55e;
        }
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
        .orc-switch-btn, .orc-export-btn {
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
        .orc-export-btn {
          border-color: #22c55e;
          color: #22c55e;
        }
        .orc-switch-btn:hover, .orc-export-btn:hover {
          background: rgba(255,255,255,0.06);
        }
        .orc-action-feedback {
          margin: 0 0 16px 0;
          padding: 12px 16px;
          border-radius: 6px;
          border: 1px solid #eab308;
          background: rgba(234, 179, 8, 0.08);
          color: #fde68a;
          font-family: ui-monospace, Consolas, monospace;
          font-size: 13px;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}
