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
  onSave,
  onSendToAi
}) {
  const todayStr = getTodayDateString();
  const todayWeekDay = getTodayDayOfWeek();
  const processDayRollover = (raw) => {
    if (!raw || !raw.weeklySchedule) return null;
    const plan = raw;
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
        // 保留最近30天历史
      };
    }
    if (!plan.lastActiveDate) {
      plan.lastActiveDate = todayStr;
    }
    return plan;
  };
  const [data, setData] = (0, import_react.useState)(() => processDayRollover(initialData));
  const [activeTimerTask, setActiveTimerTask] = (0, import_react.useState)(null);
  const [secondsRemaining, setSecondsRemaining] = (0, import_react.useState)(0);
  const [isTimerRunning, setIsTimerRunning] = (0, import_react.useState)(false);
  const [syncing, setSyncing] = (0, import_react.useState)(false);
  const [reviewModalTask, setReviewModalTask] = (0, import_react.useState)(null);
  const [reviewScore, setReviewScore] = (0, import_react.useState)("");
  const [reviewMissedWords, setReviewMissedWords] = (0, import_react.useState)("");
  const [reviewNote, setReviewNote] = (0, import_react.useState)("");
  (0, import_react.useEffect)(() => {
    if (!data) {
      fetch("/api/workspace-canvas/templates").then((res) => res.json()).then((res) => {
        if (res.ok && res.templates?.length) {
          const defaultTpl = res.templates.find((t) => t.id === "template-task-shenlun") || res.templates[0];
          if (defaultTpl) {
            const initialized = processDayRollover(defaultTpl.data);
            setData(initialized);
            if (initialized) onSave(initialized);
          }
        }
      }).catch(console.error);
    }
  }, [data]);
  (0, import_react.useEffect)(() => {
    let timer = null;
    if (isTimerRunning && secondsRemaining > 0) {
      timer = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsTimerRunning(false);
            if (activeTimerTask) {
              handleAutoFinish(activeTimerTask.id, activeTimerTask.targetMinutes);
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
    updateDaySchedule(
      (items) => items.map((it) => it.id === taskId ? { ...it, done: true, actualMinutes: targetMin } : it)
    );
  };
  const handleStartTaskTimer = (task) => {
    if (activeTimerTask?.id === task.id && isTimerRunning) {
      setIsTimerRunning(false);
      return;
    }
    setActiveTimerTask(task);
    setSecondsRemaining(task.targetMinutes * 60);
    setIsTimerRunning(true);
  };
  const handleFinishTimerEarly = () => {
    if (!activeTimerTask) return;
    const elapsedSec = activeTimerTask.targetMinutes * 60 - secondsRemaining;
    const actualMin = Math.max(1, Math.round(elapsedSec / 60));
    updateDaySchedule(
      (items) => items.map((it) => it.id === activeTimerTask.id ? { ...it, done: true, actualMinutes: actualMin } : it)
    );
    setIsTimerRunning(false);
    setActiveTimerTask(null);
    setSecondsRemaining(0);
  };
  const updateDaySchedule = async (updater) => {
    if (!data) return;
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
  const handleToggleDone = (taskId, done) => {
    updateDaySchedule((items) => items.map((it) => it.id === taskId ? { ...it, done } : it));
  };
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };
  const handleDispatchReviewToAi = () => {
    if (!reviewModalTask) return;
    const actualTime = reviewModalTask.actualMinutes || reviewModalTask.targetMinutes;
    const timeStatus = actualTime <= reviewModalTask.targetMinutes ? `\u6B63\u5E38\u9650\u65F6\u5185\u5B8C\u6210 (\u9650\u65F6${reviewModalTask.targetMinutes}m/\u5B9E\u8017${actualTime}m)` : `\u8D85\u65F6\u5B8C\u6210 (\u9650\u65F6${reviewModalTask.targetMinutes}m/\u5B9E\u8017${actualTime}m)`;
    const prompt = [
      `\u3010${todayStr} \u516C\u8003\u4F5C\u7B54\u590D\u76D8\u4E0E\u8BCA\u65AD\u8BF7\u6C42\u3011`,
      `\u79D1\u76EE\u6A21\u5757\uFF1A${reviewModalTask.module}`,
      `\u4F5C\u7B54\u9898\u76EE/\u8BA1\u5212\u9879\uFF1A${reviewModalTask.title}`,
      `\u7528\u65F6\u60C5\u51B5\uFF1A${timeStatus}`,
      reviewScore ? `\u81EA\u6211\u9884\u4F30\u5F97\u5206/\u6B63\u786E\u7387\uFF1A${reviewScore}` : "",
      reviewMissedWords ? `\u542C\u8BFE/\u5BF9\u7B54\u6848\u5BF9\u7167\u6F0F\u6389\u7684\u6838\u5FC3\u91C7\u5206\u8BCD\uFF1A${reviewMissedWords}` : "",
      reviewNote ? `\u4F5C\u7B54\u5361\u70B9\u4E0E\u601D\u7EF4\u76F2\u533A\uFF1A${reviewNote}` : "",
      `----------------------------------------`,
      `\u8BF7\u8003\u516C\u6307\u5BFC\u79C1\u6559\u7ED3\u5408\u6211\u7684\u753B\u50CF\uFF08\u7533\u8BBA\u5BB9\u6613\u5F3A\u884C\u5957\u5206\u7C7B\u6F0F\u8BCD\u3001\u8D44\u6599\u5206\u6790\u9700\u63D0\u901F\uFF09\uFF0C\u9488\u5BF9\u4E0A\u8FF0\u4F5C\u7B54\u60C5\u51B5\u7ED9\u51FA\uFF1A`,
      `1. \u8BE5\u9898\u5931\u5206/\u8D85\u65F6\u7684\u6838\u5FC3\u8BA4\u77E5\u504F\u5DEE\uFF08\u4E3A\u4EC0\u4E48\u5F53\u65F6\u6CA1\u6709\u60F3\u5230\u6750\u6599\u539F\u8BCD/\u5FEB\u901F\u7B97\u6CD5\uFF1F\uFF09`,
      `2. \u4E0B\u6B21\u9762\u5BF9\u540C\u7C7B\u9898\u76EE\u7684 30 \u79D2\u673A\u68B0\u6027\u7834\u9898\u52A8\u4F5C\u6E05\u5355`,
      `3. \u8FD9\u9053\u9898\u662F\u5426\u9700\u8981\u52A0\u5165\u5468\u516D\u7684\u300C\u9519\u9898\u4E8C\u5237\u65A9\u6740\u6E05\u5355\u300D\uFF1F`
    ].filter(Boolean).join("\n");
    updateDaySchedule(
      (items) => items.map((it) => it.id === reviewModalTask.id ? {
        ...it,
        note: `\u81EA\u6D4B: ${reviewScore || "\u5DF2\u5BF9\u7B54\u6848"} \xB7 \u6F0F\u8BCD: ${reviewMissedWords || "\u65E0"} \xB7 \u53CD\u601D: ${reviewNote || "\u6B63\u5E38"}`
      } : it)
    );
    if (onSendToAi) {
      onSendToAi(prompt);
    } else {
      navigator.clipboard?.writeText(prompt);
      alert("\u2728 \u590D\u76D8\u8BCA\u65AD\u63D0\u95EE\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F\uFF01\u53EF\u76F4\u63A5\u7C98\u8D34\u5230\u5E95\u90E8\u8F93\u5165\u6846\u53D1\u9001\u7ED9 AI\u3002");
    }
    setReviewModalTask(null);
    setReviewScore("");
    setReviewMissedWords("");
    setReviewNote("");
  };
  if (!data) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "grid", placeContent: "center", height: "100%", color: "#94a3b8" }, children: "\u6B63\u5728\u521D\u59CB\u5316\u516C\u8003\u5907\u6218\u8BA1\u5212\u770B\u677F..." });
  }
  const todayTasks = data.weeklySchedule[todayWeekDay] || [];
  const completedCount = todayTasks.filter((t) => t.done).length;
  const totalCount = todayTasks.length;
  const dayProgressPct = totalCount > 0 ? Math.round(completedCount / totalCount * 100) : 0;
  const daysLeft = calculateDaysLeft(data.profile.examDate || "2026-11-28");
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
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: "12.5px", fontWeight: 600 }, children: data.profile.target }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: "11.5px", color: "#eab308", marginLeft: "6px" }, children: [
          "\u26A1 \u94C1\u5F8B\uFF1A",
          data.profile.coreRule
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: "11px", color: "var(--dsw-alias-label-tertiary, #686872)" }, children: syncing ? "\u540C\u6B65\u4E2D..." : "\u6BCF\u65E5\u81EA\u52A8\u5F52\u6863\u6E05\u7A7A" }),
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
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary, #a0a0a8)" }, children: activeTimerTask ? `\u4ECA\u65E5\u6B63\u5728\u9650\u65F6\u6267\u884C \xB7 ${activeTimerTask.module}` : "\u70B9\u51FB\u4E0B\u65B9\u4EFB\u610F\u4EFB\u52A1\u9879\u65C1\u7684 [\u23F1 \u5F00\u59CB\u4E13\u6CE8] \u8F7D\u5165\u5012\u8BA1\u65F6" }),
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
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: "13px", fontWeight: 600, color: "#f0f0f2" }, children: "\u4ECA\u65E5\u56FA\u5B9A\u6267\u884C\u8BA1\u5212 (P1 \u4F5C\u606F\u8868)" }),
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
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      flex: 1,
      minHeight: 0,
      overflowY: "auto"
    }, children: todayTasks.map((item) => {
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
                  onChange: (e) => handleToggleDone(item.id, e.target.checked),
                  style: { width: "15px", height: "15px", accentColor: "#10b981", cursor: "pointer" }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: {
                fontSize: "11px",
                fontWeight: 600,
                color: item.module.includes("\u7533\u8BBA") ? "#a78bfa" : item.module.includes("\u8D44\u6599") ? "#38bdf8" : item.module.includes("\u6570\u91CF") ? "#fbbf24" : "#94a3b8",
                background: "rgba(255, 255, 255, 0.05)",
                padding: "2px 6px",
                borderRadius: "4px",
                whiteSpace: "nowrap"
              }, children: [
                item.timeSlot,
                " \xB7 ",
                item.module
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
                  fontSize: "12.5px",
                  fontWeight: 500,
                  color: item.done ? "var(--dsw-alias-label-secondary, #a0a0a8)" : "var(--dsw-alias-label-primary, #f0f0f2)",
                  textDecoration: item.done ? "line-through" : "none",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }, children: item.title }),
                item.note && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: "11px", color: "#60a5fa" }, children: [
                  "\u{1F4DD} ",
                  item.note
                ] })
              ] }),
              item.resource && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: "11px", color: "var(--dsw-alias-label-tertiary, #686872)", whiteSpace: "nowrap", marginLeft: "auto" }, children: [
                "\u{1F517} ",
                item.resource
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }, children: item.done ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: "11px", color: "#10b981", fontWeight: 600 }, children: [
                "\u2714 \u5DF2\u5B8C\u6210 ",
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
                  title: "\u5411\u4E0B\u65B9 Agent \u53D1\u9001\u672C\u9898\u7684\u4F5C\u7B54\u6548\u679C\u8BCA\u65AD\u4E0E\u590D\u76D8\u8BF7\u6C42",
                  children: "\u2728 \u53CD\u601D\u590D\u76D8"
                }
              )
            ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: "11.5px", color: "var(--dsw-alias-label-secondary, #a0a0a8)" }, children: [
                "\u9650\u65F6 ",
                item.targetMinutes,
                " \u5206\u949F"
              ] }),
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
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "6px 12px",
      background: "rgba(255, 255, 255, 0.02)",
      borderTop: "1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.06))",
      fontSize: "11px",
      color: "var(--dsw-alias-label-tertiary, #686872)",
      flexShrink: 0
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontWeight: 700, color: "var(--dsw-alias-label-secondary, #a0a0a8)" }, children: "\u5173\u952E\u8282\u70B9:" }),
      data.checkpoints.map((cp, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { style: { color: "#94a3b8" }, children: cp.date }),
        ": ",
        cp.criteria
      ] }, idx))
    ] }),
    reviewModalTask && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1e3
    }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      width: "440px",
      background: "var(--dsw-alias-bg-layer-1, #1a1a1c)",
      border: "1px solid var(--dsw-alias-border-l3, rgba(255,255,255,0.16))",
      borderRadius: "8px",
      padding: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "10px"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: "14px", fontWeight: 600, display: "flex", justifyContent: "space-between", color: "#f0f0f2" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u5411 AI \u53D1\u9001\u672C\u9898\u4F5C\u7B54\u590D\u76D8" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { cursor: "pointer", color: "var(--dsw-alias-label-tertiary)" }, onClick: () => setReviewModalTask(null), children: "\u2715" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: "12px", color: "#38bdf8", padding: "6px 8px", background: "rgba(56, 189, 248, 0.08)", borderRadius: "4px" }, children: [
        "\u9898\u76EE: ",
        reviewModalTask.title,
        " (\u5B9E\u9645\u8017\u65F6: ",
        reviewModalTask.actualMinutes || reviewModalTask.targetMinutes,
        " \u5206\u949F)"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: "4px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: { fontSize: "11.5px", color: "var(--dsw-alias-label-secondary)" }, children: "\u9884\u4F30\u5F97\u5206 / \u6B63\u786E\u7387 (\u5982: 14/20 \u6216 85%):" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "text",
            value: reviewScore,
            onChange: (e) => setReviewScore(e.target.value),
            placeholder: "\u4F8B\u5982: 15/20\u5206\uFF0C\u6216 4/5\u9898",
            style: {
              background: "var(--dsw-alias-bg-base, #151517)",
              border: "1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1))",
              borderRadius: "5px",
              padding: "6px 8px",
              color: "#fff",
              fontSize: "12.5px",
              outline: "none"
            }
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: "4px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: { fontSize: "11.5px", color: "var(--dsw-alias-label-secondary)" }, children: "\u542C\u8BFE\u5BF9\u7167\u6F0F\u6389\u7684\u91C7\u5206\u8BCD / \u5173\u952E\u5931\u5206\u70B9:" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "text",
            value: reviewMissedWords,
            onChange: (e) => setReviewMissedWords(e.target.value),
            placeholder: "\u4F8B\u5982: \u6F0F\u6389\u4E86'\u60C5\u7406\u878D\u5408'\u3001'\u521A\u67D4\u5E76\u6D4E'\u91C7\u5206\u8BCD",
            style: {
              background: "var(--dsw-alias-bg-base, #151517)",
              border: "1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1))",
              borderRadius: "5px",
              padding: "6px 8px",
              color: "#fff",
              fontSize: "12.5px",
              outline: "none"
            }
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: "4px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: { fontSize: "11.5px", color: "var(--dsw-alias-label-secondary)" }, children: "\u4E2A\u4EBA\u601D\u8003\u76F2\u533A\u6216\u4F5C\u7B54\u5361\u70B9:" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "textarea",
          {
            value: reviewNote,
            onChange: (e) => setReviewNote(e.target.value),
            placeholder: "\u4F8B\u5982: \u8BFB\u6750\u6599\u65F6\u6CA1\u6709\u770B\u51FA\u7B2C\u4E09\u6BB5\u7684\u5BF9\u7B56\u6620\u5C04\uFF0C\u82B1\u4E86\u592A\u591A\u65F6\u95F4\u5728\u5F3A\u884C\u5206\u7C7B\u5C0F\u6807\u9898\u4E0A...",
            rows: 3,
            style: {
              background: "var(--dsw-alias-bg-base, #151517)",
              border: "1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1))",
              borderRadius: "5px",
              padding: "6px 8px",
              color: "#fff",
              fontSize: "12px",
              outline: "none",
              resize: "none"
            }
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "6px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            onClick: () => setReviewModalTask(null),
            style: {
              padding: "5px 12px",
              background: "transparent",
              border: "1px solid var(--dsw-alias-border-l2)",
              color: "var(--dsw-alias-label-secondary)",
              borderRadius: "5px",
              cursor: "pointer"
            },
            children: "\u53D6\u6D88"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            onClick: handleDispatchReviewToAi,
            style: {
              padding: "5px 14px",
              background: "var(--dsw-alias-button-info-fill)",
              border: "none",
              color: "#fff",
              borderRadius: "5px",
              cursor: "pointer",
              fontWeight: 600
            },
            children: "\u63A8\u9001\u7ED9 AI \u590D\u76D8 \u{1F680}"
          }
        )
      ] })
    ] }) })
  ] });
}

// src/client.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var inject = ["slots"];
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
  setupDynamicViewManager();
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
      onSendToAi: handleSendToAi
    }
  );
}
function setupDynamicViewManager() {
  if (typeof document === "undefined") return;
  const styleEl = document.createElement("style");
  styleEl.id = "dsh-workspace-canvas-manager-styles";
  styleEl.textContent = `
    /* \u9ED8\u8BA4\u9690\u85CF\u672A\u52FE\u9009\u5E38\u9A7B\u7684\u6269\u5C55\u89C6\u56FE\uFF0C\u4EC5\u5728\u5BF9\u5E94\u5F00\u5173\u4E3A true \u65F6\u5C55\u793A */
    body:not([data-dsh-show-task="true"]) button[role="tab"][data-view-kind="task"] {
      display: none !important;
    }
    body:not([data-dsh-show-design="true"]) button[role="tab"][data-view-kind="design"] {
      display: none !important;
    }
    body:not([data-dsh-show-video="true"]) button[role="tab"][data-view-kind="video"] {
      display: none !important;
    }

    /* [+] \u52A0\u53F7\u7BA1\u7406\u6309\u94AE\u6837\u5F0F */
    .dsh-view-add-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      margin-left: 6px;
      border: 1px dashed var(--dsw-alias-border-l3, rgba(255, 255, 255, 0.2));
      border-radius: 4px;
      background: transparent;
      color: var(--dsw-alias-label-secondary, #a0a0a8);
      font-size: 14px;
      line-height: 1;
      cursor: pointer;
      transition: all 150ms ease;
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
      margin-top: 6px;
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
    const showTask = localStorage.getItem("dsh.canvas.show_task") === "true";
    const showDesign = localStorage.getItem("dsh.canvas.show_design") === "true";
    const showVideo = localStorage.getItem("dsh.canvas.show_video") === "true";
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
        const curTask = localStorage.getItem("dsh.canvas.show_task") === "true";
        const curDesign = localStorage.getItem("dsh.canvas.show_design") === "true";
        const curVideo = localStorage.getItem("dsh.canvas.show_video") === "true";
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
        const bindToggle = (id, storageKey, bodyAttr, kind, current) => {
          const item = menuEl?.querySelector(id);
          if (item) {
            item.onclick = () => {
              const next = !current;
              localStorage.setItem(storageKey, next ? "true" : "false");
              document.body.setAttribute(bodyAttr, next ? "true" : "false");
              closeMenu();
              if (next) {
                const targetTab = tablist.querySelector(`button[data-view-kind="${kind}"]`);
                if (targetTab) targetTab.click();
              }
            };
          }
        };
        bindToggle("#itemToggleTask", "dsh.canvas.show_task", "data-dsh-show-task", "task", curTask);
        bindToggle("#itemToggleDesign", "dsh.canvas.show_design", "data-dsh-show-design", "design", curDesign);
        bindToggle("#itemToggleVideo", "dsh.canvas.show_video", "data-dsh-show-video", "video", curVideo);
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
  syncTabBar();
}

    return module.exports;
  }
});
