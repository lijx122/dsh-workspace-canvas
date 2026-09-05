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
function TaskView({
  workspaceId,
  cwd,
  initialData,
  onSave
}) {
  const normalizeData = (raw) => {
    if (!raw) return null;
    if (raw.weeklySchedule) return raw;
    return null;
  };
  const [data, setData] = (0, import_react.useState)(() => normalizeData(initialData));
  const [activeDay, setActiveDay] = (0, import_react.useState)(() => {
    const d = (/* @__PURE__ */ new Date()).getDay();
    return d === 0 ? "7" : String(d);
  });
  const [activeTimerTask, setActiveTimerTask] = (0, import_react.useState)(null);
  const [secondsRemaining, setSecondsRemaining] = (0, import_react.useState)(0);
  const [isTimerRunning, setIsTimerRunning] = (0, import_react.useState)(false);
  const [syncing, setSyncing] = (0, import_react.useState)(false);
  (0, import_react.useEffect)(() => {
    if (!data) {
      fetch("/api/workspace-canvas/templates").then((res) => res.json()).then((res) => {
        if (res.ok && res.templates?.length) {
          const defaultTpl = res.templates.find((t) => t.id === "template-task-shenlun") || res.templates[0];
          if (defaultTpl) setData(defaultTpl.data);
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
    alert(`\u{1F389} \u606D\u559C\uFF01\u4EFB\u52A1 [${activeTimerTask?.title}] \u9650\u65F6\u5B8C\u6210\uFF0C\u5DF2\u81EA\u52A8\u52FE\u9009\uFF01`);
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
    const currentList = data.weeklySchedule[activeDay] || [];
    const updatedList = updater(currentList);
    const nextData = {
      ...data,
      weeklySchedule: {
        ...data.weeklySchedule,
        [activeDay]: updatedList
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
    updateDaySchedule(
      (items) => items.map((it) => it.id === taskId ? { ...it, done } : it)
    );
  };
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };
  if (!data) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "grid", placeContent: "center", height: "100%", color: "#94a3b8" }, children: "\u6B63\u5728\u521D\u59CB\u5316\u516C\u8003\u5907\u6218\u8BA1\u5212\u770B\u677F..." });
  }
  const dayTasks = data.weeklySchedule[activeDay] || [];
  const completedCount = dayTasks.filter((t) => t.done).length;
  const totalCount = dayTasks.length;
  const dayProgressPct = totalCount > 0 ? Math.round(completedCount / totalCount * 100) : 0;
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
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
          fontSize: "11px",
          fontWeight: 700,
          color: "#3b82f6",
          background: "rgba(59, 130, 246, 0.12)",
          padding: "2px 7px",
          borderRadius: "4px",
          whiteSpace: "nowrap"
        }, children: data.profile.stage }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: "12.5px", fontWeight: 600 }, children: data.profile.target }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: "11.5px", color: "#eab308", marginLeft: "6px" }, children: [
          "\u26A1 \u94C1\u5F8B\uFF1A",
          data.profile.coreRule
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: "11px", color: "var(--dsw-alias-label-tertiary, #686872)" }, children: syncing ? "\u540C\u6B65 tasks.json..." : "\u5DF2\u540C\u6B65\u8BA1\u5212" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
          fontSize: "11px",
          fontWeight: 700,
          color: "#ef4444",
          background: "rgba(239, 68, 68, 0.12)",
          border: "1px solid rgba(239, 68, 68, 0.25)",
          padding: "2px 8px",
          borderRadius: "12px"
        }, children: "\u8DDD\u7B14\u8BD5\u7EA6 68 \u5929" })
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
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary, #a0a0a8)" }, children: activeTimerTask ? `\u6B63\u5728\u4E13\u6CE8\u9650\u65F6\u6267\u884C \xB7 ${activeTimerTask.module}` : "\u70B9\u51FB\u4E0B\u65B9\u4EFB\u610F\u4EFB\u52A1\u9879\u65C1\u7684 [\u23F1 \u5F00\u59CB\u4E13\u6CE8] \u8F7D\u5165\u8BA1\u65F6" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: "13.5px", fontWeight: 600, color: activeTimerTask ? "#60a5fa" : "#f0f0f2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: activeTimerTask ? activeTimerTask.title : "\u672A\u542F\u52A8\u8BA1\u65F6\u5668\uFF08\u8BA1\u65F6\u7ED3\u675F\u540E\u5C06\u81EA\u52A8\u6807\u8BB0\u8BE5\u9879\u5B8C\u6210\uFF09" })
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
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, marginTop: "2px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", gap: "6px" }, children: Object.entries(WEEK_NAMES).map(([key, label]) => {
        const isCur = key === activeDay;
        const countDone = (data.weeklySchedule[key] || []).filter((t) => t.done).length;
        const countAll = (data.weeklySchedule[key] || []).length;
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "button",
          {
            onClick: () => setActiveDay(key),
            style: {
              display: "flex",
              alignItems: "center",
              gap: "6px",
              height: "28px",
              padding: "0 12px",
              fontSize: "12px",
              fontWeight: isCur ? 700 : 500,
              color: isCur ? "#f0f0f2" : "var(--dsw-alias-label-secondary, #a0a0a8)",
              background: isCur ? "var(--dsw-alias-bg-layer-2, #212124)" : "transparent",
              border: `1px solid ${isCur ? "var(--dsw-alias-border-l3, rgba(255,255,255,0.16))" : "transparent"}`,
              borderRadius: "6px",
              cursor: "pointer"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label }),
              countAll > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: "10.5px", color: countDone === countAll ? "#10b981" : "var(--dsw-alias-label-tertiary, #686872)" }, children: [
                countDone,
                "/",
                countAll
              ] })
            ]
          },
          key
        );
      }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--dsw-alias-label-secondary, #a0a0a8)" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u4ECA\u65E5\u8FDB\u5EA6:" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { width: "80px", height: "5px", background: "var(--dsw-alias-bg-layer-3, #2a2a2e)", borderRadius: "3px", overflow: "hidden" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { height: "100%", width: `${dayProgressPct}%`, background: "#10b981", transition: "width 200ms" } }) }),
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
    }, children: dayTasks.map((item) => {
      const isItemActiveTimer = activeTimerTask?.id === item.id;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "9px 12px",
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
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
                fontSize: "12.5px",
                fontWeight: 500,
                color: item.done ? "var(--dsw-alias-label-secondary, #a0a0a8)" : "var(--dsw-alias-label-primary, #f0f0f2)",
                textDecoration: item.done ? "line-through" : "none",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }, children: item.title }),
              item.resource && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: "11px", color: "var(--dsw-alias-label-tertiary, #686872)", whiteSpace: "nowrap" }, children: [
                "\u{1F517} ",
                item.resource
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }, children: item.done ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: "11px", color: "#10b981", fontWeight: 600 }, children: [
              "\u2714 \u5DF2\u5B8C\u6210 ",
              item.actualMinutes ? `(\u7528\u65F6 ${item.actualMinutes}m)` : ""
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
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontWeight: 700, color: "var(--dsw-alias-label-secondary, #a0a0a8)" }, children: "\u5173\u952E\u68C0\u67E5\u70B9:" }),
      data.checkpoints.map((cp, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { style: { color: "#94a3b8" }, children: cp.date }),
        ": ",
        cp.criteria
      ] }, idx))
    ] })
  ] });
}

// src/client.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var inject = ["slots"];
var VIEW_ID = "dsh-task-canvas";
function apply(ctx) {
  ctx.slots.inject(
    "conversation.view",
    () => ctx.slots.register(
      {
        name: "conversation.view",
        id: VIEW_ID,
        order: 15,
        label: "Task"
      },
      CanvasViewBridge
    )
  );
  setupDynamicViewManager();
}
function CanvasViewBridge({ sessionId, useWorkspaces }) {
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
      onSave: handleSave
    }
  );
}
function setupDynamicViewManager() {
  if (typeof document === "undefined") return;
  const styleEl = document.createElement("style");
  styleEl.id = "dsh-workspace-canvas-manager-styles";
  styleEl.textContent = `
    /* \u9ED8\u8BA4\u9690\u85CF Task \u6309\u94AE\uFF0C\u53EA\u6709\u5F53\u5F53\u524D\u5DE5\u4F5C\u533A\u5DF2\u542F\u7528\u65F6\u663E\u793A */
    body:not([data-dsh-has-task="true"]) button[role="tab"]:is([data-view-id="dsh-task-canvas"]) {
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
      width: 190px;
      background: var(--dsw-alias-bg-layer-2, #212124);
      border: 1px solid var(--dsw-alias-border-l3, rgba(255, 255, 255, 0.16));
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      padding: 6px;
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
        tab.setAttribute("data-view-id", VIEW_ID);
      }
    });
    const isTaskEnabled = localStorage.getItem("dsh.canvas.task_pinned") === "true";
    document.body.setAttribute("data-dsh-has-task", isTaskEnabled ? "true" : "false");
    if (!tablist.querySelector(".dsh-view-add-btn")) {
      const addBtn = document.createElement("button");
      addBtn.className = "dsh-view-add-btn";
      addBtn.title = "\u7BA1\u7406\u5F53\u524D\u4F1A\u8BDD\u5E38\u9A7B\u89C6\u56FE (Task \u770B\u677F\u7B49)";
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
        const currentPinned = localStorage.getItem("dsh.canvas.task_pinned") === "true";
        menuEl = document.createElement("div");
        menuEl.className = "dsh-view-menu-popover";
        menuEl.innerHTML = `
          <div style="font-size: 11px; color: var(--dsw-alias-label-tertiary, #686872); padding: 4px 8px; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.06)); margin-bottom: 4px;">
            \u4F1A\u8BDD\u89C6\u56FE\u7BA1\u7406
          </div>
          <div class="dsh-view-menu-item" id="menuToggleTask">
            <span>\u4EFB\u52A1\u770B\u677F (Task)</span>
            <span class="dsh-view-menu-check">${currentPinned ? "\u2714" : ""}</span>
          </div>
        `;
        menuEl.onclick = (ev) => ev.stopPropagation();
        const toggleItem = menuEl.querySelector("#menuToggleTask");
        if (toggleItem) {
          toggleItem.onclick = () => {
            const next = !currentPinned;
            localStorage.setItem("dsh.canvas.task_pinned", next ? "true" : "false");
            document.body.setAttribute("data-dsh-has-task", next ? "true" : "false");
            closeMenu();
            if (next) {
              const taskTab = tablist.querySelector('button[data-view-id="dsh-task-canvas"]');
              if (taskTab) taskTab.click();
            }
          };
        }
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
