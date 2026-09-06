window.__ModuleLoader__.load({
  id: "dsh-workspace-canvas",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.tsx
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);
var import_react2 = require("react");

// src/TaskView.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var WEEK_NAMES = {
  "1": "\u5468\u4E00",
  "2": "\u5468\u4E8C",
  "3": "\u5468\u4E09",
  "4": "\u5468\u56DB",
  "5": "\u5468\u4E94",
  "6": "\u5468\u516D",
  "7": "\u5468\u65E5"
};
function getTodayDateString() {
  const now = /* @__PURE__ */ new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function getTodayDayOfWeek() {
  const d = (/* @__PURE__ */ new Date()).getDay();
  return d === 0 ? "7" : String(d);
}
function calculateDaysLeft(targetDateStr) {
  try {
    const target = new Date(targetDateStr).getTime();
    const now = (/* @__PURE__ */ new Date()).getTime();
    const diff = Math.ceil((target - now) / (1e3 * 60 * 60 * 24));
    return Math.max(0, diff);
  } catch {
    return 68;
  }
}
function TaskView({
  workspaceId,
  cwd,
  initialData,
  viewConfig,
  onSave,
  onSendToAi,
  onReloadStatus
}) {
  const todayStr = getTodayDateString();
  const todayWeekDay = getTodayDayOfWeek();
  const processDayRollover = (plan) => {
    if (plan.lastActiveDate && plan.lastActiveDate !== todayStr) {
      const lastDayWeek = String(new Date(plan.lastActiveDate).getDay() || 7);
      const lastDayItems = plan.weeklySchedule[lastDayWeek] || [];
      const historyList = plan.history || [];
      if (!historyList.some((h) => h.date === plan.lastActiveDate)) {
        historyList.unshift({
          date: plan.lastActiveDate,
          dayOfWeek: lastDayWeek,
          items: JSON.parse(JSON.stringify(lastDayItems))
        });
      }
      const resetSchedule = {};
      for (const [dayKey, items] of Object.entries(plan.weeklySchedule)) {
        resetSchedule[dayKey] = items.map((it) => ({
          ...it,
          done: false,
          actualMinutes: void 0,
          note: void 0
        }));
      }
      return {
        ...plan,
        lastActiveDate: todayStr,
        weeklySchedule: resetSchedule,
        history: historyList.slice(0, 30)
      };
    }
    if (!plan.lastActiveDate) {
      plan.lastActiveDate = todayStr;
    }
    return plan;
  };
  const [data, setData] = (0, import_react.useState)(() => {
    if (initialData?.weeklySchedule) {
      return processDayRollover(initialData);
    }
    return initialData || null;
  });
  (0, import_react.useEffect)(() => {
    if (initialData?.weeklySchedule) {
      setData(processDayRollover(initialData));
    } else {
      setData(initialData || null);
    }
  }, [initialData]);
  const [templates, setTemplates] = (0, import_react.useState)([]);
  const [syncing, setSyncing] = (0, import_react.useState)(false);
  const [activeTimerTask, setActiveTimerTask] = (0, import_react.useState)(null);
  const [secondsRemaining, setSecondsRemaining] = (0, import_react.useState)(0);
  const [isTimerRunning, setIsTimerRunning] = (0, import_react.useState)(false);
  const [reviewModalTask, setReviewModalTask] = (0, import_react.useState)(null);
  const [reviewScore, setReviewScore] = (0, import_react.useState)("");
  const [reviewMissedWords, setReviewMissedWords] = (0, import_react.useState)("");
  const [reviewNote, setReviewNote] = (0, import_react.useState)("");
  (0, import_react.useEffect)(() => {
    if (!data) {
      fetch("/api/workspace-canvas/templates").then((res) => res.json()).then((res) => {
        if (res.ok) setTemplates(res.templates || []);
      }).catch(console.error);
    }
  }, [data]);
  const handleApplyTemplate = async (templateId) => {
    setSyncing(true);
    try {
      const res = await fetch("/api/workspace-canvas/apply-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, cwd, templateId })
      });
      const result = await res.json();
      if (result.ok) {
        if (result.tasksData?.weeklySchedule) {
          setData(processDayRollover(result.tasksData));
        } else {
          setData(result.tasksData);
        }
        if (onReloadStatus) await onReloadStatus();
      }
    } finally {
      setSyncing(false);
    }
  };
  (0, import_react.useEffect)(() => {
    let timer = null;
    if (isTimerRunning && secondsRemaining > 0) {
      timer = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsTimerRunning(false);
            if (activeTimerTask) {
              handleAutoFinish(activeTimerTask.id, activeTimerTask.targetMinutes || 25);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1e3);
    }
    return () => clearInterval(timer);
  }, [isTimerRunning, secondsRemaining, activeTimerTask]);
  const handleAutoFinish = (taskId, targetMin) => {
    if (data?.weeklySchedule) {
      updateDaySchedule(
        (items) => items.map((it) => it.id === taskId ? { ...it, done: true, actualMinutes: targetMin } : it)
      );
    } else if (data?.tasks) {
      updateKanbanData((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => t.id === taskId ? { ...t, columnId: "done" } : t)
      }));
    }
  };
  const handleStartTaskTimer = (task) => {
    if (activeTimerTask?.id === task.id && isTimerRunning) {
      setIsTimerRunning(false);
      return;
    }
    const mins = task.targetMinutes || 25;
    setActiveTimerTask(task);
    setSecondsRemaining(mins * 60);
    setIsTimerRunning(true);
  };
  const handleFinishTimerEarly = () => {
    if (!activeTimerTask) return;
    const targetMin = activeTimerTask.targetMinutes || 25;
    const elapsedSec = targetMin * 60 - secondsRemaining;
    const actualMin = Math.max(1, Math.round(elapsedSec / 60));
    if (data?.weeklySchedule) {
      updateDaySchedule(
        (items) => items.map((it) => it.id === activeTimerTask.id ? { ...it, done: true, actualMinutes: actualMin } : it)
      );
    } else if (data?.tasks) {
      updateKanbanData((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => t.id === activeTimerTask.id ? { ...t, columnId: "done" } : t)
      }));
    }
    setIsTimerRunning(false);
    setActiveTimerTask(null);
    setSecondsRemaining(0);
  };
  const updateDaySchedule = async (updater) => {
    if (!data?.weeklySchedule) return;
    const currentList = data.weeklySchedule[todayWeekDay] || [];
    const updatedList = updater(currentList);
    const nextData = {
      ...data,
      lastActiveDate: todayStr,
      weeklySchedule: {
        ...data.weeklySchedule,
        [todayWeekDay]: updatedList
      }
    };
    setData(nextData);
    setSyncing(true);
    try {
      await onSave(nextData);
    } finally {
      setTimeout(() => setSyncing(false), 300);
    }
  };
  const updateKanbanData = async (updater) => {
    if (!data?.columns) return;
    const next = updater(data);
    setData(next);
    setSyncing(true);
    try {
      await onSave(next);
    } finally {
      setTimeout(() => setSyncing(false), 300);
    }
  };
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };
  const handleDispatchReviewToAi = () => {
    if (!reviewModalTask) return;
    const actualTime = reviewModalTask.actualMinutes || reviewModalTask.targetMinutes || 25;
    const prompt = [
      `\u3010${todayStr} \u4F5C\u7B54\u590D\u76D8\u4E0E\u8BCA\u65AD\u8BF7\u6C42\u3011`,
      `\u5DE5\u4F5C\u533A\u8DEF\u5F84\uFF1A${cwd}`,
      `\u4F5C\u7B54\u9898\u76EE/\u9879\uFF1A${reviewModalTask.title}`,
      `\u7528\u65F6\u60C5\u51B5\uFF1A\u8017\u65F6 ${actualTime} \u5206\u949F`,
      reviewScore ? `\u81EA\u6D4B\u5F97\u5206/\u6B63\u786E\u7387\uFF1A${reviewScore}` : "",
      reviewMissedWords ? `\u9057\u6F0F\u91C7\u5206\u8BCD/\u76F2\u533A\uFF1A${reviewMissedWords}` : "",
      reviewNote ? `\u53CD\u601D\u4E0E\u5361\u70B9\u8BB0\u5F55\uFF1A${reviewNote}` : "",
      `----------------------------------------`,
      `\u8BF7\u7ED3\u5408\u5F53\u524D\u5DE5\u4F5C\u533A\u4EFB\u52A1\u4E0E\u76EE\u6807\uFF0C\u7ED9\u51FA 2 \u70B9\u5173\u952E\u63D0\u5347\u5EFA\u8BAE\u53CA\u662F\u5426\u9700\u8981\u52A0\u5165\u9519\u9898\u590D\u76D8\u3002`
    ].filter(Boolean).join("\n");
    if (onSendToAi) {
      onSendToAi(prompt);
    } else {
      navigator.clipboard?.writeText(prompt);
      alert("\u2728 \u590D\u76D8\u8BCA\u65AD\u63D0\u95EE\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F\uFF01");
    }
    setReviewModalTask(null);
    setReviewScore("");
    setReviewMissedWords("");
    setReviewNote("");
  };
  if (!data) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      padding: "32px",
      color: "var(--dsw-alias-label-primary, #f0f0f2)",
      background: "var(--dsw-alias-bg-base, #151517)",
      gap: "20px",
      userSelect: "none"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { textAlign: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: "11px", color: "var(--dsw-alias-label-tertiary, #686872)", marginBottom: "4px" }, children: [
          "\u5DE5\u4F5C\u533A\uFF1A",
          cwd || workspaceId
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { style: { fontSize: "17px", fontWeight: 600, marginBottom: "6px" }, children: "\u4E3A\u6B64\u5DE5\u4F5C\u533A\u542F\u7528 Task \u770B\u677F" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { fontSize: "12.5px", color: "var(--dsw-alias-label-secondary, #a0a0a8)" }, children: "\u5F53\u524D\u5DE5\u4F5C\u533A\u76EE\u5F55\u4E0B\u672A\u627E\u5230 tasks.json\uFF0C\u8BF7\u9009\u62E9\u770B\u677F\u6A21\u677F\u521D\u59CB\u5316\uFF1A" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px", maxWidth: "620px", width: "100%" }, children: templates.map((tpl) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "div",
        {
          onClick: () => handleApplyTemplate(tpl.id),
          style: {
            background: "var(--dsw-alias-bg-layer-1, #1a1a1c)",
            border: "1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1))",
            borderRadius: "8px",
            padding: "16px",
            cursor: "pointer",
            transition: "border-color 150ms ease, transform 150ms ease"
          },
          onMouseEnter: (e) => e.currentTarget.style.borderColor = "var(--dsw-alias-brand-primary, #4d6bfe)",
          onMouseLeave: (e) => e.currentTarget.style.borderColor = "var(--dsw-alias-border-l2, rgba(255,255,255,0.1))",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: "13.5px", fontWeight: 600, marginBottom: "6px" }, children: tpl.name }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: "12px", color: "var(--dsw-alias-label-secondary, #a0a0a8)", lineHeight: 1.45 }, children: tpl.description }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { marginTop: "12px", fontSize: "11.5px", color: "var(--dsw-alias-brand-primary, #4d6bfe)", fontWeight: 600 }, children: "\u9009\u7528\u5E76\u751F\u6210 tasks.json \u2192" })
          ]
        },
        tpl.id
      )) })
    ] });
  }
  if (data.weeklySchedule) {
    const gongkaoData = data;
    const todayTasks = gongkaoData.weeklySchedule[todayWeekDay] || [];
    const completedCount = todayTasks.filter((t) => t.done).length;
    const totalCount = todayTasks.length;
    const dayProgressPct = totalCount > 0 ? Math.round(completedCount / totalCount * 100) : 0;
    const daysLeft = calculateDaysLeft(gongkaoData.profile.examDate || "2026-11-28");
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      display: "flex",
      flexDirection: "column",
      height: "100%",
      width: "100%",
      background: "var(--dsw-alias-bg-base, #151517)",
      padding: "12px 18px",
      gap: "10px",
      color: "var(--dsw-alias-label-primary, #f0f0f2)",
      fontFamily: "var(--dsw-font-family, sans-serif)",
      fontSize: "13px",
      userSelect: "none",
      overflowY: "auto"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        background: "var(--dsw-alias-bg-layer-1, #1a1a1c)",
        border: "1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.06))",
        borderRadius: "8px",
        gap: "12px",
        flexShrink: 0
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: {
            fontSize: "11px",
            fontWeight: 700,
            color: "#3b82f6",
            background: "rgba(59, 130, 246, 0.12)",
            padding: "2px 7px",
            borderRadius: "4px",
            whiteSpace: "nowrap"
          }, children: [
            todayStr,
            " \xB7 ",
            WEEK_NAMES[todayWeekDay]
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: "12.5px", fontWeight: 600 }, children: gongkaoData.profile.target }),
          gongkaoData.profile.coreRule && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: "11.5px", color: "#eab308", marginLeft: "6px" }, children: [
            "\u26A1 ",
            gongkaoData.profile.coreRule
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: "11px", color: "var(--dsw-alias-label-tertiary, #686872)" }, children: syncing ? "\u540C\u6B65 tasks.json..." : "\u6309\u5F53\u524D\u5DE5\u4F5C\u533A\u52A0\u8F7D" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: {
            fontSize: "11px",
            fontWeight: 700,
            color: "#ef4444",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            padding: "2px 8px",
            borderRadius: "12px"
          }, children: [
            "\u8DDD\u7B14\u8BD5\u7EA6 ",
            daysLeft,
            " \u5929"
          ] })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 16px",
        background: activeTimerTask ? "linear-gradient(135deg, #1c2333 0%, #151a24 100%)" : "var(--dsw-alias-bg-layer-2, #212124)",
        border: `1px solid ${activeTimerTask ? "var(--dsw-alias-brand-primary, #4d6bfe)" : "var(--dsw-alias-border-l2, rgba(255,255,255,0.1))"}`,
        borderRadius: "8px",
        boxShadow: activeTimerTask ? "0 0 12px rgba(59, 130, 246, 0.25)" : "none",
        transition: "all 200ms ease",
        flexShrink: 0
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: "18px" }, children: "\u23F1" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary, #a0a0a8)" }, children: activeTimerTask ? `\u9650\u65F6\u4E13\u6CE8\u4E2D \xB7 ${activeTimerTask.module || "\u4E13\u9879"}` : "\u70B9\u51FB\u4EFB\u610F\u8BA1\u5212\u9879\u65C1\u7684 [\u23F1 \u5F00\u59CB\u4E13\u6CE8] \u8F7D\u5165\u8BA1\u65F6" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: "13.5px", fontWeight: 600, color: activeTimerTask ? "#60a5fa" : "#f0f0f2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: activeTimerTask ? activeTimerTask.title : "\u672A\u542F\u52A8\u8BA1\u65F6\u5668\uFF08\u5012\u8BA1\u65F6\u7ED3\u675F\u540E\u81EA\u52A8\u6807\u8BB0\u5B8C\u6210\uFF09" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "14px", flexShrink: 0 }, children: [
          activeTimerTask && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
            fontSize: "24px",
            fontFamily: "ui-monospace, monospace",
            fontWeight: 700,
            color: secondsRemaining <= 300 ? "#ef4444" : "#38bdf8",
            letterSpacing: "1px"
          }, children: formatTime(secondsRemaining) }),
          activeTimerTask && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: "8px" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                onClick: () => setIsTimerRunning((prev) => !prev),
                style: {
                  height: "28px",
                  padding: "0 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#fff",
                  background: isTimerRunning ? "#eab308" : "var(--dsw-alias-button-info-fill, #3b5bfd)",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer"
                },
                children: isTimerRunning ? "\u6682\u505C" : "\u7EE7\u7EED"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                onClick: handleFinishTimerEarly,
                style: {
                  height: "28px",
                  padding: "0 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#10b981",
                  background: "rgba(16, 185, 129, 0.12)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: "5px",
                  cursor: "pointer"
                },
                children: "\u63D0\u524D\u4EA4\u5377/\u5B8C\u6210 \u2714"
              }
            )
          ] })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, padding: "2px 4px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: "13px", fontWeight: 600, color: "#f0f0f2" }, children: [
          "\u4ECA\u65E5\u8BA1\u5212\u6E05\u5355 (\u5DE5\u4F5C\u533A: ",
          cwd.split(/[\/\\]/).pop(),
          ")"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--dsw-alias-label-secondary, #a0a0a8)" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u4ECA\u65E5\u8FDB\u5EA6:" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { width: "100px", height: "5px", background: "var(--dsw-alias-bg-layer-3, #2a2a2e)", borderRadius: "3px", overflow: "hidden" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { height: "100%", width: `${dayProgressPct}%`, background: "#10b981", transition: "width 200ms" } }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontWeight: 600, color: "#10b981" }, children: [
            completedCount,
            " / ",
            totalCount,
            " (",
            dayProgressPct,
            "%)"
          ] })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", flexDirection: "column", gap: "6px", flex: 1, minHeight: 0, overflowY: "auto" }, children: todayTasks.map((item) => {
        const isItemActiveTimer = activeTimerTask?.id === item.id;
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              background: item.done ? "rgba(255, 255, 255, 0.02)" : isItemActiveTimer ? "rgba(59, 130, 246, 0.08)" : "var(--dsw-alias-bg-layer-1, #1a1a1c)",
              border: `1px solid ${isItemActiveTimer ? "var(--dsw-alias-brand-primary, #4d6bfe)" : item.done ? "var(--dsw-alias-border-l1, rgba(255,255,255,0.04))" : "var(--dsw-alias-border-l2, rgba(255,255,255,0.08))"}`,
              borderRadius: "6px",
              gap: "12px",
              transition: "all 120ms ease"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "input",
                  {
                    type: "checkbox",
                    checked: item.done,
                    onChange: (e) => {
                      updateDaySchedule((items) => items.map((it) => it.id === item.id ? { ...it, done: e.target.checked } : it));
                    },
                    style: { width: "15px", height: "15px", accentColor: "#10b981", cursor: "pointer" }
                  }
                ),
                item.timeSlot && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: {
                  fontSize: "11px",
                  fontWeight: 600,
                  color: item.module?.includes("\u7533\u8BBA") ? "#a78bfa" : item.module?.includes("\u8D44\u6599") ? "#38bdf8" : "#94a3b8",
                  background: "rgba(255, 255, 255, 0.05)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  whiteSpace: "nowrap"
                }, children: [
                  item.timeSlot,
                  " ",
                  item.module ? `\xB7 ${item.module}` : ""
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
                  fontSize: "12.5px",
                  fontWeight: 500,
                  color: item.done ? "var(--dsw-alias-label-secondary, #a0a0a8)" : "var(--dsw-alias-label-primary, #f0f0f2)",
                  textDecoration: item.done ? "line-through" : "none",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }, children: item.title }),
                item.resource && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: "11px", color: "var(--dsw-alias-label-tertiary, #686872)", whiteSpace: "nowrap", marginLeft: "auto" }, children: [
                  "\u{1F517} ",
                  item.resource
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }, children: item.done ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: "11px", color: "#10b981", fontWeight: 600 }, children: [
                  "\u2714 \u5B8C\u6210 ",
                  item.actualMinutes ? `(${item.actualMinutes}m)` : ""
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "button",
                  {
                    onClick: () => setReviewModalTask(item),
                    style: {
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      height: "24px",
                      padding: "0 8px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#a78bfa",
                      background: "rgba(167, 139, 250, 0.12)",
                      border: "1px solid rgba(167, 139, 250, 0.3)",
                      borderRadius: "4px",
                      cursor: "pointer"
                    },
                    children: "\u2728 \u53CD\u601D\u590D\u76D8"
                  }
                )
              ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: "11.5px", color: "var(--dsw-alias-label-secondary, #a0a0a8)" }, children: item.targetMinutes ? `\u9650\u65F6 ${item.targetMinutes}m` : "\u5F85\u6267\u884C" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "button",
                  {
                    onClick: () => handleStartTaskTimer(item),
                    style: {
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      height: "24px",
                      padding: "0 8px",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      color: isItemActiveTimer ? "#eab308" : "#38bdf8",
                      background: isItemActiveTimer ? "rgba(234, 179, 8, 0.12)" : "rgba(56, 189, 248, 0.12)",
                      border: `1px solid ${isItemActiveTimer ? "rgba(234, 179, 8, 0.3)" : "rgba(56, 189, 248, 0.25)"}`,
                      borderRadius: "4px",
                      cursor: "pointer"
                    },
                    children: isItemActiveTimer && isTimerRunning ? "\u23F8 \u8BA1\u65F6\u4E2D" : "\u23F1 \u5F00\u59CB\u4E13\u6CE8"
                  }
                )
              ] }) })
            ]
          },
          item.id
        );
      }) }),
      reviewModalTask && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1e3
      }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
        width: "420px",
        background: "var(--dsw-alias-bg-layer-1, #1a1a1c)",
        border: "1px solid var(--dsw-alias-border-l3, rgba(255,255,255,0.16))",
        borderRadius: "8px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px"
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: "14px", fontWeight: 600, display: "flex", justifyContent: "space-between", color: "#f0f0f2" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u5411 AI \u53D1\u9001\u4F5C\u7B54\u590D\u76D8" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { cursor: "pointer", color: "var(--dsw-alias-label-tertiary)" }, onClick: () => setReviewModalTask(null), children: "\u2715" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "text",
            value: reviewScore,
            onChange: (e) => setReviewScore(e.target.value),
            placeholder: "\u81EA\u6D4B\u5F97\u5206 / \u6B63\u786E\u7387 (\u5982: 15/20)",
            style: { background: "#151517", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", padding: "6px 8px", color: "#fff", fontSize: "12px" }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "text",
            value: reviewMissedWords,
            onChange: (e) => setReviewMissedWords(e.target.value),
            placeholder: "\u6F0F\u6389\u7684\u91C7\u5206\u8BCD / \u5931\u5206\u70B9",
            style: { background: "#151517", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", padding: "6px 8px", color: "#fff", fontSize: "12px" }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "textarea",
          {
            value: reviewNote,
            onChange: (e) => setReviewNote(e.target.value),
            placeholder: "\u4F5C\u7B54\u5361\u70B9\u4E0E\u53CD\u601D\u8BB0\u5F55...",
            rows: 3,
            style: { background: "#151517", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", padding: "6px 8px", color: "#fff", fontSize: "12px", resize: "none" }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", justifyContent: "flex-end", gap: "8px" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => setReviewModalTask(null), style: { padding: "4px 10px", background: "transparent", border: "1px solid #333", color: "#aaa", borderRadius: "4px", cursor: "pointer" }, children: "\u53D6\u6D88" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: handleDispatchReviewToAi, style: { padding: "4px 12px", background: "#3b5bfd", border: "none", color: "#fff", borderRadius: "4px", cursor: "pointer", fontWeight: 600 }, children: "\u53D1\u9001\u7ED9 AI" })
        ] })
      ] }) })
    ] });
  }
  const kanbanData = data;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    width: "100%",
    background: "var(--dsw-alias-bg-base, #151517)",
    padding: "12px 18px",
    gap: "10px",
    color: "var(--dsw-alias-label-primary, #f0f0f2)",
    fontFamily: "var(--dsw-font-family, sans-serif)",
    fontSize: "13px",
    userSelect: "none"
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--dsw-alias-bg-layer-1, #1a1a1c)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: "11px", fontWeight: 600, background: "rgba(59,130,246,0.15)", color: "#60a5fa", padding: "2px 6px", borderRadius: "4px" }, children: "\u901A\u7528\u770B\u677F" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontWeight: 600 }, children: kanbanData.plan?.target || "\u9879\u76EE\u4EFB\u52A1\u770B\u677F" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: "11.5px", color: "#888" }, children: [
          "(",
          cwd,
          ")"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: "11px", color: "#666" }, children: syncing ? "\u540C\u6B65\u4E2D..." : "\u5DF2\u52A0\u8F7D\u5DE5\u4F5C\u533A tasks.json" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "grid", gridTemplateColumns: `repeat(${kanbanData.columns.length}, 1fr)`, gap: "10px", flex: 1, minHeight: 0 }, children: kanbanData.columns.map((col) => {
      const colTasks = kanbanData.tasks.filter((t) => t.columnId === col.id);
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", background: "var(--dsw-alias-bg-layer-1, #1a1a1c)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", overflow: "hidden" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontWeight: 600, fontSize: "12.5px" }, children: col.title }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: "11px", color: "#888", background: "rgba(255,255,255,0.05)", padding: "0 6px", borderRadius: "10px" }, children: colTasks.length })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", flexDirection: "column", gap: "6px", padding: "8px", overflowY: "auto", flex: 1 }, children: colTasks.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { background: "#151517", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", padding: "8px 10px", display: "flex", flexDirection: "column", gap: "4px" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontWeight: 500, fontSize: "12.5px", color: t.columnId === "done" ? "#777" : "#eee", textDecoration: t.columnId === "done" ? "line-through" : "none" }, children: t.title }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: "10px", fontWeight: 600, color: t.priority === "P0" ? "#ef4444" : "#eab308" }, children: t.priority })
          ] }),
          t.desc && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: "11.5px", color: "#888" }, children: t.desc }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "#555", marginTop: "4px", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "4px" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t.source === "ai" ? "\u2728 AI" : "\u{1F464} \u4EBA\u5DE5" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: "6px" }, children: [
              col.id !== "todo" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => updateKanbanData((prev) => ({ ...prev, tasks: prev.tasks.map((it) => it.id === t.id ? { ...it, columnId: "todo" } : it) })), style: { background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "10.5px" }, children: "\u5F85\u529E" }),
              col.id !== "in_progress" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => updateKanbanData((prev) => ({ ...prev, tasks: prev.tasks.map((it) => it.id === t.id ? { ...it, columnId: "in_progress" } : it) })), style: { background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "10.5px" }, children: "\u63A8\u8FDB" }),
              col.id !== "done" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => updateKanbanData((prev) => ({ ...prev, tasks: prev.tasks.map((it) => it.id === t.id ? { ...it, columnId: "done" } : it) })), style: { background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "10.5px" }, children: "\u5B8C\u6210" })
            ] })
          ] })
        ] }, t.id)) })
      ] }, col.id);
    }) })
  ] });
}

// src/client.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var inject = ["slots", "sessions", "workspaces"];
var VIEW_ID_TASK = "dsh-task-canvas";
function apply(ctx) {
  ctx.slots.inject(
    "conversation.view",
    () => ctx.slots.register(
      {
        name: "conversation.view",
        id: VIEW_ID_TASK,
        order: 15,
        label: "Task"
      },
      CanvasViewBridge
    )
  );
  setupDynamicViewManager(ctx);
}
function CanvasViewBridge({ sessionId, useWorkspaces, inputActions }) {
  const workspace = useWorkspaces(
    (state) => state.items?.find((item) => item.sessionIds?.includes(sessionId))
  );
  const [loading, setLoading] = (0, import_react2.useState)(true);
  const [tasksData, setTasksData] = (0, import_react2.useState)(null);
  const [error, setError] = (0, import_react2.useState)(null);
  const workspaceId = workspace ? String(workspace.workspaceId) : "";
  const cwd = workspace ? workspace.path : "";
  const loadStatus = async () => {
    if (!workspaceId && !cwd) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace-canvas/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, cwd })
      });
      const result = await res.json();
      if (result.ok) {
        setTasksData(result.status.tasksData || null);
      } else {
        setError(result.error || "\u65E0\u6CD5\u83B7\u53D6\u5DE5\u4F5C\u533A\u72B6\u6001");
      }
    } catch (err) {
      setError(err.message || "\u7F51\u7EDC\u8BF7\u6C42\u5931\u8D25");
    } finally {
      setLoading(false);
    }
  };
  (0, import_react2.useEffect)(() => {
    loadStatus();
  }, [workspaceId, cwd]);
  const handleSave = async (updatedData) => {
    setTasksData(updatedData);
    await fetch("/api/workspace-canvas/save-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, cwd, tasksData: updatedData })
    });
  };
  const handleSendToAi = (prompt) => {
    if (inputActions && typeof inputActions.setDraft === "function") {
      inputActions.setDraft(prompt);
      const chatTab = document.querySelector('button[role="tab"]');
      if (chatTab) chatTab.click();
    } else {
      navigator.clipboard?.writeText(prompt);
      alert("\u2728 \u590D\u76D8\u8BCA\u65AD\u63D0\u95EE\u5DF2\u81EA\u52A8\u590D\u5236\u5230\u526A\u8D34\u677F\uFF01\u53EF\u76F4\u63A5\u7C98\u8D34\u5230\u5E95\u90E8\u8F93\u5165\u6846\u53D1\u9001\u7ED9 AI\u3002");
    }
  };
  if (!workspace) {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
      display: "grid",
      placeContent: "center",
      height: "100%",
      color: "var(--dsw-alias-label-secondary, #a0a0a8)",
      fontSize: "13px"
    }, children: "\u8BF7\u5728\u5DF2\u6CE8\u518C\u7684 DSH \u5DE5\u4F5C\u533A\u4F1A\u8BDD\u4E2D\u6253\u5F00 Task \u770B\u677F" });
  }
  if (loading) {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
      display: "grid",
      placeContent: "center",
      height: "100%",
      color: "var(--dsw-alias-label-tertiary, #686872)",
      fontSize: "12px"
    }, children: "\u6B63\u5728\u52A0\u8F7D\u5DE5\u4F5C\u533A\u770B\u677F\u72B6\u6001..." });
  }
  if (error) {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
      display: "grid",
      placeContent: "center",
      height: "100%",
      color: "var(--dsw-alias-state-error-primary, #ef4444)",
      fontSize: "13px"
    }, children: error });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    TaskView,
    {
      workspaceId,
      cwd,
      initialData: tasksData,
      onSave: handleSave,
      onSendToAi: handleSendToAi,
      onReloadStatus: loadStatus
    },
    `${workspaceId}_${cwd}`
  );
}
function getCurrentWorkspaceScope(ctx) {
  try {
    if (ctx?.sessions && ctx?.workspaces) {
      const currentSessionId = ctx.sessions.list?.getSnapshot?.()?.current;
      if (currentSessionId) {
        const wsSnapshot = ctx.workspaces.list?.getSnapshot?.();
        const found = wsSnapshot?.items?.find((item) => item.sessionIds?.includes(currentSessionId));
        if (found?.workspaceId) return String(found.workspaceId);
      }
    }
  } catch (e) {
  }
  return "default";
}
function setupDynamicViewManager(ctx) {
  if (typeof document === "undefined") return;
  const styleEl = document.createElement("style");
  styleEl.id = "dsh-workspace-canvas-manager-styles";
  styleEl.textContent = `
    /* \u4FDD\u8BC1 [role="tablist"] \u5185\u7684\u6240\u6709\u6807\u7B7E\u5F3A\u5236\u540C\u4E00\u884C\u6392\u7248\u3001\u7981\u6B62\u6298\u884C\u6362\u884C */
    div[role="tablist"] {
      display: flex !important;
      flex-direction: row !important;
      flex-wrap: nowrap !important;
      align-items: center !important;
      gap: 32px !important;
      position: relative !important;
      overflow-x: auto !important;
      scrollbar-width: none !important;
    }
    div[role="tablist"]::-webkit-scrollbar {
      display: none !important;
    }

    /* \u9ED8\u8BA4\u9690\u85CF\u672A\u5728\u5F53\u524D\u5DE5\u4F5C\u533A\u52FE\u9009\u5E38\u9A7B\u7684\u6269\u5C55\u89C6\u56FE\uFF0C\u4EC5\u5728\u5BF9\u5E94\u4F5C\u7528\u57DF\u5F00\u5173\u4E3A true \u65F6\u5C55\u793A */
    body:not([data-dsh-show-task="true"]) button[role="tab"][data-view-kind="task"] {
      display: none !important;
    }
    body:not([data-dsh-show-design="true"]) button[role="tab"][data-view-kind="design"] {
      display: none !important;
    }
    body:not([data-dsh-show-video="true"]) button[role="tab"][data-view-kind="video"] {
      display: none !important;
    }

    /* \u786E\u4FDD\u6CE8\u5165\u7684 tab \u6309\u94AE\u4E0E\u539F\u751F tab \u6837\u5F0F 100% \u540C\u884C\u5BF9\u9F50 */
    button[role="tab"] {
      flex-shrink: 0 !important;
      white-space: nowrap !important;
    }

    /* [+] \u52A0\u53F7\u7BA1\u7406\u6309\u94AE\u6837\u5F0F\uFF1A\u9AD8\u5EA6\u5BF9\u9F50\uFF0C\u7D27\u8DDF\u5728 tablist \u672B\u5C3E */
    .dsh-view-add-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      margin-bottom: 9px;
      border: 1px dashed var(--dsw-alias-border-l3, rgba(255, 255, 255, 0.2));
      border-radius: 4px;
      background: transparent;
      color: var(--dsw-alias-label-secondary, #a0a0a8);
      font-size: 13px;
      line-height: 1;
      cursor: pointer;
      flex-shrink: 0;
      transition: all 120ms ease;
    }
    .dsh-view-add-btn:hover {
      background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08));
      color: var(--dsw-alias-label-primary, #f0f0f2);
      border-color: var(--dsw-alias-brand-primary, #4d6bfe);
    }

    /* \u5F39\u51FA\u5F0F\u7BA1\u7406\u83DC\u5355 */
    .dsh-view-menu-popover {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 4px;
      width: 130px;
      background: var(--dsw-alias-bg-layer-2, #212124);
      border: 1px solid var(--dsw-alias-border-l3, rgba(255, 255, 255, 0.16));
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      padding: 4px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 12.5px;
      color: var(--dsw-alias-label-primary, #f0f0f2);
    }
    .dsh-view-menu-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
      border-radius: 6px;
      cursor: pointer;
      user-select: none;
      transition: background 120ms;
    }
    .dsh-view-menu-item:hover {
      background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.06));
    }
    .dsh-view-menu-check {
      color: var(--dsw-alias-brand-primary, #4d6bfe);
      font-weight: bold;
      font-size: 13px;
    }
  `;
  document.head.appendChild(styleEl);
  const syncTabBar = () => {
    const tablist = document.querySelector('[role="tablist"]');
    if (!tablist) return;
    const wsScope = getCurrentWorkspaceScope(ctx);
    const tabs = tablist.querySelectorAll('button[role="tab"]');
    tabs.forEach((tab) => {
      const text = tab.textContent?.trim();
      if (text === "Task") {
        tab.setAttribute("data-view-kind", "task");
      } else if (text === "Design") {
        tab.setAttribute("data-view-kind", "design");
      } else if (text === "Video") {
        tab.setAttribute("data-view-kind", "video");
      }
    });
    const showTask = localStorage.getItem(`dsh.canvas.${wsScope}.show_task`) === "true";
    const showDesign = localStorage.getItem(`dsh.canvas.${wsScope}.show_design`) === "true";
    const showVideo = localStorage.getItem(`dsh.canvas.${wsScope}.show_video`) === "true";
    document.body.setAttribute("data-dsh-show-task", showTask ? "true" : "false");
    document.body.setAttribute("data-dsh-show-design", showDesign ? "true" : "false");
    document.body.setAttribute("data-dsh-show-video", showVideo ? "true" : "false");
    if (!tablist.querySelector(".dsh-view-add-btn")) {
      const addBtn = document.createElement("button");
      addBtn.className = "dsh-view-add-btn";
      addBtn.title = "Add views";
      addBtn.textContent = "+";
      addBtn.type = "button";
      let menuEl = null;
      const closeMenu = () => {
        if (menuEl) {
          menuEl.remove();
          menuEl = null;
        }
      };
      addBtn.onclick = (e) => {
        e.stopPropagation();
        if (menuEl) {
          closeMenu();
          return;
        }
        const currentScope = getCurrentWorkspaceScope(ctx);
        const curTask = localStorage.getItem(`dsh.canvas.${currentScope}.show_task`) === "true";
        const curDesign = localStorage.getItem(`dsh.canvas.${currentScope}.show_design`) === "true";
        const curVideo = localStorage.getItem(`dsh.canvas.${currentScope}.show_video`) === "true";
        menuEl = document.createElement("div");
        menuEl.className = "dsh-view-menu-popover";
        menuEl.innerHTML = `
          <div class="dsh-view-menu-item" id="itemToggleTask">
            <span>Task</span>
            <span class="dsh-view-menu-check">${curTask ? "\u2714" : ""}</span>
          </div>
          <div class="dsh-view-menu-item" id="itemToggleDesign">
            <span>Design</span>
            <span class="dsh-view-menu-check">${curDesign ? "\u2714" : ""}</span>
          </div>
          <div class="dsh-view-menu-item" id="itemToggleVideo">
            <span>Video</span>
            <span class="dsh-view-menu-check">${curVideo ? "\u2714" : ""}</span>
          </div>
        `;
        menuEl.onclick = (ev) => ev.stopPropagation();
        const bindToggle = (id, prop, bodyAttr, kind, currentVal) => {
          const item = menuEl?.querySelector(id);
          if (item) {
            item.onclick = () => {
              const next = !currentVal;
              localStorage.setItem(`dsh.canvas.${currentScope}.${prop}`, next ? "true" : "false");
              document.body.setAttribute(bodyAttr, next ? "true" : "false");
              closeMenu();
              if (next) {
                const targetTab = tablist.querySelector(`button[data-view-kind="${kind}"]`);
                if (targetTab) targetTab.click();
              }
            };
          }
        };
        bindToggle("#itemToggleTask", "show_task", "data-dsh-show-task", "task", curTask);
        bindToggle("#itemToggleDesign", "show_design", "data-dsh-show-design", "design", curDesign);
        bindToggle("#itemToggleVideo", "show_video", "data-dsh-show-video", "video", curVideo);
        const parent = tablist.parentElement || tablist;
        if (getComputedStyle(parent).position === "static") {
          parent.style.position = "relative";
        }
        parent.appendChild(menuEl);
        const onDocClick = () => {
          closeMenu();
          document.removeEventListener("click", onDocClick);
        };
        setTimeout(() => document.addEventListener("click", onDocClick), 10);
      };
      tablist.appendChild(addBtn);
    }
  };
  const observer = new MutationObserver(() => syncTabBar());
  observer.observe(document.body, { childList: true, subtree: true });
  if (ctx.sessions?.list) {
    ctx.sessions.list.subscribe(() => syncTabBar());
  }
  if (ctx.workspaces?.list) {
    ctx.workspaces.list.subscribe(() => syncTabBar());
  }
  syncTabBar();
}

    return module.exports;
  }
});
