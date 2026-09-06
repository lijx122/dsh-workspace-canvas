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
function TaskView({
  workspaceId,
  cwd,
  initialData,
  viewConfig,
  onSave,
  onSendToAi,
  onReloadStatus,
  onDispatchAiSession,
  onOpenSession
}) {
  const normalizeData = (raw) => {
    if (!raw) return null;
    if (Array.isArray(raw.columns) && Array.isArray(raw.tasks)) {
      return raw;
    }
    return null;
  };
  const [data, setData] = (0, import_react.useState)(() => normalizeData(initialData));
  (0, import_react.useEffect)(() => {
    setData(normalizeData(initialData));
  }, [initialData]);
  const [templates, setTemplates] = (0, import_react.useState)([]);
  const [syncing, setSyncing] = (0, import_react.useState)(false);
  const [activeTimerTask, setActiveTimerTask] = (0, import_react.useState)(null);
  const [secondsRemaining, setSecondsRemaining] = (0, import_react.useState)(0);
  const [isTimerRunning, setIsTimerRunning] = (0, import_react.useState)(false);
  const [createModalCol, setCreateModalCol] = (0, import_react.useState)(null);
  const [editingTask, setEditingTask] = (0, import_react.useState)(null);
  const [formTitle, setFormTitle] = (0, import_react.useState)("");
  const [formDesc, setFormDesc] = (0, import_react.useState)("");
  const [formAssignee, setFormAssignee] = (0, import_react.useState)("human");
  const [formPriority, setFormPriority] = (0, import_react.useState)("P1");
  const [formMinutes, setFormMinutes] = (0, import_react.useState)(25);
  const [formTags, setFormTags] = (0, import_react.useState)("");
  const [failModalTask, setFailModalTask] = (0, import_react.useState)(null);
  const [failReason, setFailReason] = (0, import_react.useState)("");
  const [showAddColModal, setShowAddColModal] = (0, import_react.useState)(false);
  const [newColTitle, setNewColTitle] = (0, import_react.useState)("");
  const [dispatchingId, setDispatchingId] = (0, import_react.useState)(null);
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
        setData(result.tasksData);
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
              handleTimerAutoComplete(activeTimerTask.id, activeTimerTask.targetMinutes || 25);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1e3);
    }
    return () => clearInterval(timer);
  }, [isTimerRunning, secondsRemaining, activeTimerTask]);
  const handleTimerAutoComplete = (taskId, targetMin) => {
    updateBoard((prev) => ({
      ...prev,
      tasks: prev.tasks.map(
        (t) => t.id === taskId ? { ...t, columnId: "done", actualMinutes: targetMin } : t
      )
    }));
    alert(`\u{1F389} \u9650\u65F6\u7ED3\u675F\uFF01\u4EBA\u7C7B\u4EFB\u52A1\u5DF2\u81EA\u52A8\u6807\u8BB0\u6D41\u8F6C\u81F3\u3010\u5B8C\u6210\u3011\uFF01`);
  };
  const handleStartTimer = (task) => {
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
    updateBoard((prev) => ({
      ...prev,
      tasks: prev.tasks.map(
        (t) => t.id === activeTimerTask.id ? { ...t, columnId: "done", actualMinutes: actualMin } : t
      )
    }));
    setIsTimerRunning(false);
    setActiveTimerTask(null);
    setSecondsRemaining(0);
  };
  const updateBoard = async (updater) => {
    if (!data) return;
    const next = updater(data);
    setData(next);
    setSyncing(true);
    try {
      await onSave(next);
    } finally {
      setTimeout(() => setSyncing(false), 300);
    }
  };
  const handleStepJumpColumn = (taskId, direction) => {
    if (!data) return;
    const task = data.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const currentIndex = data.columns.findIndex((c) => c.id === task.columnId);
    if (currentIndex === -1) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= data.columns.length) return;
    const targetCol = data.columns[nextIndex];
    if (targetCol.id === "failed") {
      setFailModalTask(task);
      setFailReason("");
      return;
    }
    updateBoard((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => t.id === taskId ? { ...t, columnId: targetCol.id } : t)
    }));
  };
  const handleCommitFailed = () => {
    if (!failModalTask) return;
    updateBoard((prev) => ({
      ...prev,
      tasks: prev.tasks.map(
        (t) => t.id === failModalTask.id ? { ...t, columnId: "failed", reason: failReason.trim() || "\u672A\u6807\u6CE8\u5931\u8D25\u539F\u56E0" } : t
      )
    }));
    setFailModalTask(null);
    setFailReason("");
  };
  const handleTriggerDispatchAi = async (task) => {
    if (!onDispatchAiSession) return;
    setDispatchingId(task.id);
    try {
      const activeSessionId = await onDispatchAiSession(task);
      if (activeSessionId) {
        updateBoard((prev) => ({
          ...prev,
          tasks: prev.tasks.map(
            (t) => t.id === task.id ? { ...t, columnId: "in_progress", claimedSessionId: activeSessionId, assignee: "ai" } : t
          )
        }));
      }
    } catch (err) {
      alert(`\u6D3E\u53D1\u5931\u8D25: ${err.message || "\u672A\u77E5\u9519\u8BEF"}`);
    } finally {
      setDispatchingId(null);
    }
  };
  const handleResolveHumanBlock = (task) => {
    updateBoard((prev) => ({
      ...prev,
      tasks: prev.tasks.map(
        (t) => t.id === task.id ? { ...t, waitingHumanAction: void 0 } : t
      )
    }));
    const resumePrompt = `\u3010\u4EBA\u7C7B\u5E72\u9884\u5B8C\u6210\u901A\u77E5\u3011\u5DF2\u5728\u5DE5\u4F5C\u533A\u5B8C\u6210\u8981\u6C42\u7684\u4EBA\u5DE5\u52A8\u4F5C\uFF08\u5982\u9A8C\u8BC1\u7801/\u767B\u5F55/\u786E\u8BA4\uFF09\uFF0C\u8BF7\u4ECE\u963B\u65AD\u5904\u7EE7\u7EED\u63A8\u8FDB\u4EFB\u52A1\uFF1A${task.title}`;
    if (onSendToAi) {
      onSendToAi(resumePrompt);
    }
  };
  const handleSaveTask = () => {
    if (!formTitle.trim()) return;
    const tags = formTags.trim() ? formTags.split(/[,，\s]+/) : [];
    if (editingTask) {
      updateBoard((prev) => ({
        ...prev,
        tasks: prev.tasks.map(
          (t) => t.id === editingTask.id ? {
            ...t,
            title: formTitle.trim(),
            desc: formDesc.trim() || void 0,
            assignee: formAssignee,
            priority: formPriority,
            targetMinutes: formMinutes,
            tags: tags.length ? tags : void 0
          } : t
        )
      }));
    } else {
      const newTask = {
        id: `task-${Date.now()}`,
        columnId: createModalCol || (data?.columns[0]?.id ?? "planned"),
        title: formTitle.trim(),
        desc: formDesc.trim() || void 0,
        assignee: formAssignee,
        priority: formPriority,
        targetMinutes: formMinutes,
        tags: tags.length ? tags : void 0,
        source: "manual",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      updateBoard((prev) => ({
        ...prev,
        tasks: [newTask, ...prev.tasks]
      }));
    }
    setCreateModalCol(null);
    setEditingTask(null);
    setFormTitle("");
    setFormDesc("");
    setFormTags("");
  };
  const handleDeleteTask = (taskId) => {
    if (!confirm("\u786E\u5B9A\u5220\u9664\u8BE5\u4EFB\u52A1\u5361\u7247\u5417\uFF1F")) return;
    updateBoard((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId)
    }));
  };
  const handleAddCustomColumn = () => {
    if (!newColTitle.trim()) return;
    const newColId = `col-${Date.now()}`;
    updateBoard((prev) => ({
      ...prev,
      columns: [...prev.columns, { id: newColId, title: newColTitle.trim(), color: "#38bdf8" }]
    }));
    setNewColTitle("");
    setShowAddColModal(false);
  };
  const handleDeleteColumn = (colId) => {
    if (!confirm("\u786E\u5B9A\u5220\u9664\u8BE5\u5217\u5417\uFF1F\u8BE5\u5217\u5185\u7684\u4EFB\u52A1\u5C06\u81EA\u52A8\u79FB\u81F3\u7B2C\u4E00\u5217\u3002")) return;
    updateBoard((prev) => {
      const remainingCols = prev.columns.filter((c) => c.id !== colId);
      const fallbackColId = remainingCols[0]?.id ?? "planned";
      return {
        ...prev,
        columns: remainingCols,
        tasks: prev.tasks.map((t) => t.columnId === colId ? { ...t, columnId: fallbackColId } : t)
      };
    });
  };
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: "16px", maxWidth: "640px", width: "100%" }, children: templates.map((tpl) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
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
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: "14px", fontWeight: 600, marginBottom: "6px" }, children: tpl.name }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: "12px", color: "var(--dsw-alias-label-secondary, #a0a0a8)", lineHeight: 1.45 }, children: tpl.description }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { marginTop: "12px", fontSize: "11.5px", color: "var(--dsw-alias-brand-primary, #4d6bfe)", fontWeight: 600 }, children: "\u9009\u7528\u5E76\u751F\u6210 tasks.json \u2192" })
          ]
        },
        tpl.id
      )) })
    ] });
  }
  const totalCount = data.tasks.length;
  const doneCount = data.tasks.filter((t) => t.columnId === "done").length;
  const failedCount = data.tasks.filter((t) => t.columnId === "failed").length;
  const inProgressCount = data.tasks.filter((t) => t.columnId === "in_progress").length;
  const waitingHumanCount = data.tasks.filter((t) => Boolean(t.waitingHumanAction)).length;
  const workspaceTitle = cwd.split(/[\/\\]/).pop() || workspaceId;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    background: "var(--dsw-alias-bg-base, #151517)",
    padding: "12px 28px 16px 20px",
    gap: "12px",
    color: "var(--dsw-alias-label-primary, #f0f0f2)",
    fontFamily: "var(--dsw-font-family, sans-serif)",
    fontSize: "13px",
    userSelect: "none",
    overflowX: "hidden",
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
        }, children: "\u4EBA\u673A\u534F\u540C\u770B\u677F" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: "13px", fontWeight: 600 }, children: data.meta?.title || workspaceTitle }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: "11.5px", color: "var(--dsw-alias-label-tertiary, #686872)" }, children: [
          "(",
          cwd,
          ")"
        ] }),
        waitingHumanCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: {
          fontSize: "11px",
          fontWeight: 700,
          color: "#f97316",
          background: "rgba(249, 115, 22, 0.15)",
          border: "1px solid rgba(249, 115, 22, 0.3)",
          padding: "1px 6px",
          borderRadius: "4px"
        }, children: [
          "\u{1F6A8} ",
          waitingHumanCount,
          " \u4E2A\u4EFB\u52A1\u7B49\u5F85\u4EBA\u5DE5\u5904\u7406"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: "11.5px", color: "var(--dsw-alias-label-secondary, #a0a0a8)" }, children: [
          "\u603B\u8BA1 ",
          totalCount,
          " \xB7 \u8FBE\u6210 ",
          doneCount,
          " \xB7 \u63A8\u8FDB\u4E2D ",
          inProgressCount,
          " ",
          failedCount > 0 ? `\xB7 \u963B\u585E ${failedCount}` : ""
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: "11px", color: "var(--dsw-alias-label-tertiary, #686872)" }, children: syncing ? "\u540C\u6B65 tasks.json..." : "\u5DF2\u5C31\u7EEA" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            onClick: () => setShowAddColModal(true),
            style: {
              height: "24px",
              padding: "0 8px",
              fontSize: "11.5px",
              color: "var(--dsw-alias-label-secondary, #a0a0a8)",
              background: "transparent",
              border: "1px dashed var(--dsw-alias-border-l2, rgba(255,255,255,0.15))",
              borderRadius: "4px",
              cursor: "pointer"
            },
            children: "+ \u52A0\u5217"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "9px 14px",
      background: activeTimerTask ? "linear-gradient(135deg, #1c2333 0%, #151a24 100%)" : "var(--dsw-alias-bg-layer-2, #212124)",
      border: `1px solid ${activeTimerTask ? "var(--dsw-alias-brand-primary, #4d6bfe)" : "var(--dsw-alias-border-l2, rgba(255,255,255,0.1))"}`,
      borderRadius: "8px",
      boxShadow: activeTimerTask ? "0 0 12px rgba(59, 130, 246, 0.25)" : "none",
      transition: "all 200ms ease",
      flexShrink: 0
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: "16px" }, children: "\u23F1" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary, #a0a0a8)" }, children: activeTimerTask ? `\u4EBA\u7C7B\u4E13\u6CE8\u8FDB\u884C\u4E2D` : "\u4EBA\u7C7B\u4EFB\u52A1\u70B9\u51FB [\u23F1] \u8F7D\u5165\u9650\u65F6\u8BA1\u65F6\uFF1BAI \u4EFB\u52A1\u70B9\u51FB [\u{1F680} \u6D3E\u53D1\u4F1A\u8BDD] \u76F4\u63A5\u8C03\u8D77\u540E\u53F0\u5B50 Agent \u5E76\u53D1\u63A8\u8FDB" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: "13px", fontWeight: 600, color: activeTimerTask ? "#60a5fa" : "#f0f0f2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: activeTimerTask ? activeTimerTask.title : "\u4EBA\u673A\u53CC\u8F68\u534F\u4F5C\u4E2D\u67A2" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }, children: [
        activeTimerTask && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
          fontSize: "22px",
          fontFamily: "ui-monospace, monospace",
          fontWeight: 700,
          color: secondsRemaining <= 300 ? "#ef4444" : "#38bdf8",
          letterSpacing: "1px"
        }, children: formatTime(secondsRemaining) }),
        activeTimerTask && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: "6px" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              onClick: () => setIsTimerRunning((prev) => !prev),
              style: {
                height: "26px",
                padding: "0 10px",
                fontSize: "11.5px",
                fontWeight: 600,
                color: "#fff",
                background: isTimerRunning ? "#eab308" : "var(--dsw-alias-button-info-fill, #3b5bfd)",
                border: "none",
                borderRadius: "4px",
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
                height: "26px",
                padding: "0 10px",
                fontSize: "11.5px",
                fontWeight: 600,
                color: "#10b981",
                background: "rgba(16, 185, 129, 0.12)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                borderRadius: "4px",
                cursor: "pointer"
              },
              children: "\u4EA4\u5377\u5B8C\u6210 \u2714"
            }
          )
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      display: "grid",
      gridTemplateColumns: `repeat(${data.columns.length}, minmax(190px, 1fr))`,
      gap: "10px",
      flex: 1,
      minHeight: 0,
      boxSizing: "border-box",
      overflowX: "auto",
      overflowY: "hidden",
      paddingBottom: "4px"
    }, children: data.columns.map((col, colIdx) => {
      const colTasks = data.tasks.filter((t) => t.columnId === col.id);
      const colColor = col.color || (col.id === "done" ? "#10b981" : col.id === "failed" ? "#ef4444" : col.id === "in_progress" ? "#eab308" : "#38bdf8");
      const isFirstCol = colIdx === 0;
      const isLastCol = colIdx === data.columns.length - 1;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            background: "var(--dsw-alias-bg-layer-1, #1a1a1c)",
            border: "1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.06))",
            borderRadius: "8px",
            minHeight: 0,
            overflow: "hidden"
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 10px",
              borderBottom: "1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.06))",
              flexShrink: 0
            }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "6px" }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { width: "7px", height: "7px", borderRadius: "50%", background: colColor } }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: "12.5px", fontWeight: 600 }, children: col.title }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
                  fontSize: "11px",
                  padding: "0 6px",
                  borderRadius: "999px",
                  background: "var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.05))",
                  color: "var(--dsw-alias-label-secondary, #a0a0a8)"
                }, children: colTasks.length })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "4px" }, children: [
                data.type === "custom" && data.columns.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "button",
                  {
                    onClick: () => handleDeleteColumn(col.id),
                    title: "\u5220\u9664\u6B64\u5217",
                    style: { background: "transparent", border: "none", color: "#555", cursor: "pointer", fontSize: "11px" },
                    children: "\u2715"
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "button",
                  {
                    onClick: () => {
                      setCreateModalCol(col.id);
                      setEditingTask(null);
                      setFormTitle("");
                      setFormDesc("");
                      setFormAssignee("human");
                      setFormTags("");
                    },
                    title: "\u5411\u6B64\u5217\u6DFB\u52A0\u4EFB\u52A1",
                    style: { background: "transparent", border: "none", color: "#888", cursor: "pointer", fontSize: "14px" },
                    children: "+"
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              padding: "8px",
              overflowY: "auto",
              flex: 1,
              minHeight: 0
            }, children: colTasks.map((task) => {
              const isTimerTarget = activeTimerTask?.id === task.id;
              const isDone = task.columnId === "done";
              const isFailed = task.columnId === "failed";
              const isAi = task.assignee === "ai";
              const isWaitingHuman = Boolean(task.waitingHumanAction);
              return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "div",
                {
                  style: {
                    background: "var(--dsw-alias-bg-base, #151517)",
                    border: `1px solid ${isWaitingHuman ? "#f97316" : isTimerTarget ? "#4d6bfe" : isFailed ? "rgba(239, 68, 68, 0.4)" : isDone ? "rgba(16, 185, 129, 0.25)" : "var(--dsw-alias-border-l2, rgba(255,255,255,0.1))"}`,
                    borderRadius: "6px",
                    padding: "9px 10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    opacity: isDone ? 0.6 : 1,
                    transition: "border-color 150ms ease"
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }, children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "flex-start", gap: "6px", flex: 1, minWidth: 0 }, children: [
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "1px 4px",
                          borderRadius: "3px",
                          flexShrink: 0,
                          color: isAi ? "#a78bfa" : "#38bdf8",
                          background: isAi ? "rgba(167, 139, 250, 0.12)" : "rgba(56, 189, 248, 0.12)"
                        }, children: isAi ? "\u{1F916} AI" : "\u{1F464} \u4EBA\u7C7B" }),
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
                          fontSize: "12.5px",
                          fontWeight: 500,
                          lineHeight: 1.4,
                          color: isDone ? "#888" : isFailed ? "#fca5a5" : "#eee",
                          textDecoration: isDone ? "line-through" : "none",
                          wordBreak: "break-word"
                        }, children: task.title })
                      ] }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
                        fontSize: "10px",
                        fontWeight: 600,
                        padding: "0 4px",
                        borderRadius: "3px",
                        flexShrink: 0,
                        color: task.priority === "P0" ? "#ef4444" : task.priority === "P1" ? "#eab308" : "#888",
                        background: task.priority === "P0" ? "rgba(239, 68, 68, 0.12)" : "rgba(255, 255, 255, 0.05)"
                      }, children: task.priority || "P1" })
                    ] }),
                    task.desc && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: "11.5px", color: "var(--dsw-alias-label-secondary, #a0a0a8)", lineHeight: 1.45 }, children: task.desc }),
                    isWaitingHuman && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
                      fontSize: "11px",
                      color: "#fed7aa",
                      background: "rgba(249, 115, 22, 0.15)",
                      border: "1px solid rgba(249, 115, 22, 0.3)",
                      padding: "5px 7px",
                      borderRadius: "4px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px"
                    }, children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
                        "\u{1F6A8} ",
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "AI \u7B49\u5F85\u4EBA\u5DE5\u5904\u7406\uFF1A" }),
                        task.waitingHumanAction
                      ] }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "button",
                        {
                          onClick: () => handleResolveHumanBlock(task),
                          style: {
                            alignSelf: "flex-end",
                            background: "#f97316",
                            color: "#fff",
                            border: "none",
                            padding: "2px 8px",
                            borderRadius: "3px",
                            fontSize: "10.5px",
                            fontWeight: 600,
                            cursor: "pointer"
                          },
                          children: "\u2714 \u6211\u5DF2\u5904\u7406\uFF0C\u901A\u77E5 AI \u7EE7\u7EED"
                        }
                      )
                    ] }),
                    task.reason && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: "11px", color: "#f87171", background: "rgba(239, 68, 68, 0.08)", padding: "3px 6px", borderRadius: "4px" }, children: [
                      "\u26A0 \u963B\u585E\u539F\u56E0: ",
                      task.reason
                    ] }),
                    task.tags && task.tags.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", flexWrap: "wrap", gap: "4px" }, children: task.tags.map((tag) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
                      fontSize: "10px",
                      color: "#94a3b8",
                      background: "var(--dsw-alias-bg-layer-2, #212124)",
                      border: "1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.06))",
                      padding: "0 4px",
                      borderRadius: "3px"
                    }, children: tag.startsWith("#") ? tag : `#${tag}` }, tag)) }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "10.5px",
                      color: "var(--dsw-alias-label-tertiary, #686872)",
                      paddingTop: "4px",
                      borderTop: "1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.06))",
                      marginTop: "2px"
                    }, children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", alignItems: "center", gap: "6px" }, children: isAi ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "button",
                        {
                          onClick: () => handleTriggerDispatchAi(task),
                          disabled: dispatchingId === task.id,
                          style: {
                            background: "rgba(167, 139, 250, 0.15)",
                            border: "1px solid rgba(167, 139, 250, 0.3)",
                            color: "#c4b5fd",
                            padding: "2px 6px",
                            borderRadius: "3px",
                            cursor: "pointer",
                            fontSize: "11px",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px"
                          },
                          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: dispatchingId === task.id ? "\u542F\u52A8\u4E2D..." : "\u{1F680} \u6D3E\u53D1\u4F1A\u8BDD" })
                        }
                      ) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                        "button",
                        {
                          onClick: () => handleStartTimer(task),
                          title: "\u9650\u65F6\u4E13\u6CE8\u8BA1\u65F6",
                          style: { background: "transparent", border: "none", color: isTimerTarget ? "#eab308" : "#38bdf8", cursor: "pointer", fontSize: "11px" },
                          children: [
                            "\u23F1 ",
                            task.targetMinutes || 25,
                            "m"
                          ]
                        }
                      ) }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "3px" }, children: [
                        !isFirstCol && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                          "button",
                          {
                            onClick: () => handleStepJumpColumn(task.id, -1),
                            title: `\u5411\u5DE6\u8DF3\u81F3\u3010${data.columns[colIdx - 1]?.title}\u3011`,
                            style: {
                              background: "var(--dsw-alias-bg-layer-2, #212124)",
                              border: "1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1))",
                              color: "#cbd5e1",
                              borderRadius: "3px",
                              padding: "1px 6px",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                              lineHeight: "14px"
                            },
                            children: "\u2190"
                          }
                        ),
                        !isLastCol && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                          "button",
                          {
                            onClick: () => handleStepJumpColumn(task.id, 1),
                            title: `\u5411\u53F3\u8DF3\u81F3\u3010${data.columns[colIdx + 1]?.title}\u3011`,
                            style: {
                              background: "var(--dsw-alias-bg-layer-2, #212124)",
                              border: "1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1))",
                              color: "#cbd5e1",
                              borderRadius: "3px",
                              padding: "1px 6px",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                              lineHeight: "14px"
                            },
                            children: "\u2192"
                          }
                        ),
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                          "button",
                          {
                            onClick: () => handleDeleteTask(task.id),
                            title: "\u5220\u9664",
                            style: { background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: "10px", marginLeft: "3px" },
                            children: "\u2715"
                          }
                        )
                      ] })
                    ] })
                  ]
                },
                task.id
              );
            }) })
          ]
        },
        col.id
      );
    }) }),
    createModalCol && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
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
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u6DFB\u52A0\u4EFB\u52A1\u5361\u7247" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { cursor: "pointer", color: "#666" }, onClick: () => setCreateModalCol(null), children: "\u2715" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "input",
        {
          type: "text",
          value: formTitle,
          onChange: (e) => setFormTitle(e.target.value),
          placeholder: "\u4EFB\u52A1\u540D\u79F0 (\u5FC5\u586B)...",
          style: { background: "#151517", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", padding: "6px 8px", color: "#fff", fontSize: "12.5px", outline: "none" }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "input",
        {
          type: "text",
          value: formDesc,
          onChange: (e) => setFormDesc(e.target.value),
          placeholder: "\u4EFB\u52A1\u6267\u884C\u76EE\u6807\u4E0E\u8BE6\u7EC6\u8BF4\u660E (\u9009\u586B)...",
          style: { background: "#151517", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", padding: "6px 8px", color: "#fff", fontSize: "12px", outline: "none" }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "12px", fontSize: "12px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: "var(--dsw-alias-label-secondary)" }, children: "\u8D23\u4EFB\u4EBA:" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              type: "radio",
              name: "assignee",
              value: "human",
              checked: formAssignee === "human",
              onChange: () => setFormAssignee("human")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u{1F464} \u4EBA\u7C7B\u6267\u884C (\u8BA1\u65F6\u6253\u52FE)" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              type: "radio",
              name: "assignee",
              value: "ai",
              checked: formAssignee === "ai",
              onChange: () => setFormAssignee("ai")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u{1F916} AI \u6D3E\u53D1\u6267\u884C" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: "8px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "select",
          {
            value: formPriority,
            onChange: (e) => setFormPriority(e.target.value),
            style: { flex: 1, background: "#151517", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", padding: "5px", color: "#fff", fontSize: "12px" },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "P0", children: "P0 (\u7D27\u6025\u5FC5\u505A)" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "P1", children: "P1 (\u5E38\u89C4\u91CD\u8981)" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "P2", children: "P2 (\u5EF6\u540E\u8BA1\u5212)" })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "number",
            value: formMinutes,
            onChange: (e) => setFormMinutes(Math.max(1, Number(e.target.value) || 25)),
            placeholder: "\u9884\u4F30\u8017\u65F6 (\u5206)",
            style: { width: "90px", background: "#151517", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", padding: "5px", color: "#fff", fontSize: "12px" }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "text",
            value: formTags,
            onChange: (e) => setFormTags(e.target.value),
            placeholder: "\u6807\u7B7E (\u7A7A\u683C\u5206\u9694)",
            style: { flex: 1, background: "#151517", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", padding: "5px", color: "#fff", fontSize: "12px" }
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "6px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => setCreateModalCol(null), style: { padding: "4px 10px", background: "transparent", border: "1px solid #333", color: "#aaa", borderRadius: "4px", cursor: "pointer" }, children: "\u53D6\u6D88" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: handleSaveTask, style: { padding: "4px 14px", background: "#3b5bfd", border: "none", color: "#fff", borderRadius: "4px", cursor: "pointer", fontWeight: 600 }, children: "\u4FDD\u5B58" })
      ] })
    ] }) }),
    failModalTask && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1e3
    }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      width: "400px",
      background: "var(--dsw-alias-bg-layer-1, #1a1a1c)",
      border: "1px solid rgba(239, 68, 68, 0.4)",
      borderRadius: "8px",
      padding: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "10px"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: "14px", fontWeight: 600, color: "#ef4444" }, children: "\u4EFB\u52A1\u6D41\u8F6C\u81F3\u3010\u5931\u8D25 / \u963B\u585E\u3011" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: "12px", color: "#aaa" }, children: [
        "\u4EFB\u52A1: ",
        failModalTask.title
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "textarea",
        {
          value: failReason,
          onChange: (e) => setFailReason(e.target.value),
          placeholder: "\u8BF7\u8F93\u5165\u5931\u5206\u70B9\u3001\u5361\u70B9\u6216\u5931\u8D25\u539F\u56E0\uFF0C\u65B9\u4FBF\u540E\u7EED\u9488\u5BF9\u6027\u590D\u76D8...",
          rows: 3,
          style: { background: "#151517", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", padding: "6px 8px", color: "#fff", fontSize: "12px", resize: "none" }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", justifyContent: "flex-end", gap: "8px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => setFailModalTask(null), style: { padding: "4px 10px", background: "transparent", border: "1px solid #333", color: "#aaa", borderRadius: "4px", cursor: "pointer" }, children: "\u53D6\u6D88" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: handleCommitFailed, style: { padding: "4px 14px", background: "#ef4444", border: "none", color: "#fff", borderRadius: "4px", cursor: "pointer", fontWeight: 600 }, children: "\u786E\u8BA4\u5931\u8D25" })
      ] })
    ] }) }),
    showAddColModal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1e3
    }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      width: "320px",
      background: "var(--dsw-alias-bg-layer-1, #1a1a1c)",
      border: "1px solid var(--dsw-alias-border-l3, rgba(255,255,255,0.16))",
      borderRadius: "8px",
      padding: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "10px"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: "13.5px", fontWeight: 600, color: "#eee" }, children: "\u65B0\u589E\u81EA\u5B9A\u4E49\u770B\u677F\u5217" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "input",
        {
          type: "text",
          value: newColTitle,
          onChange: (e) => setNewColTitle(e.target.value),
          placeholder: "\u8F93\u5165\u5217\u540D\u79F0 (\u5982: \u590D\u5BA1\u4E2D\u3001\u6682\u5B58)...",
          style: { background: "#151517", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", padding: "6px 8px", color: "#fff", fontSize: "12px", outline: "none" }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", justifyContent: "flex-end", gap: "8px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => setShowAddColModal(false), style: { padding: "4px 10px", background: "transparent", border: "1px solid #333", color: "#aaa", borderRadius: "4px", cursor: "pointer" }, children: "\u53D6\u6D88" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: handleAddCustomColumn, style: { padding: "4px 12px", background: "#3b5bfd", border: "none", color: "#fff", borderRadius: "4px", cursor: "pointer", fontWeight: 600 }, children: "\u786E\u5B9A\u6DFB\u52A0" })
      ] })
    ] }) })
  ] });
}

// src/client.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var inject = ["slots", "sessions", "workspaces", "uiWorkspace"];
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
      (props) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CanvasViewBridge, { ...props, cordisCtx: ctx })
    )
  );
  setupDynamicViewManager(ctx);
}
function CanvasViewBridge({ sessionId, useWorkspaces, inputActions, cordisCtx }) {
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
  (0, import_react2.useEffect)(() => {
    if (!cordisCtx.sessions?.list) return;
    const unsubscribe = cordisCtx.sessions.list.subscribe(() => {
      if (workspaceId && cwd) {
        fetch("/api/workspace-canvas/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, cwd })
        }).then((res) => res.json()).then((res) => {
          if (res.ok && res.status.tasksData) {
            setTasksData(res.status.tasksData);
          }
        }).catch(() => {
        });
      }
    });
    return () => unsubscribe();
  }, [cordisCtx, workspaceId, cwd]);
  const handleSave = async (updatedData) => {
    setTasksData(updatedData);
    await fetch("/api/workspace-canvas/save-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, cwd, tasksData: updatedData })
    });
  };
  const executeAutoSendPrompt = (targetText) => {
    const chatTab = document.querySelector('button[role="tab"]');
    if (chatTab) chatTab.click();
    if (inputActions && typeof inputActions.setDraft === "function") {
      inputActions.setDraft(targetText);
    }
    let attempts = 0;
    const submitInterval = setInterval(() => {
      attempts++;
      if (inputActions && typeof inputActions.setDraft === "function") {
        inputActions.setDraft(targetText);
      }
      if (inputActions && typeof inputActions.submit === "function") {
        try {
          inputActions.submit();
        } catch (e) {
        }
      }
      const sendButton = document.querySelector('button[class*="primary"][aria-label*="Send"], button[class*="primary"][aria-label*="\u53D1\u9001"], button[aria-label="Send"], button[aria-label="\u53D1\u9001"]');
      if (sendButton && !sendButton.disabled) {
        sendButton.click();
        clearInterval(submitInterval);
      }
      if (attempts >= 8) {
        clearInterval(submitInterval);
      }
    }, 150);
  };
  const handleSendToAi = (prompt) => {
    executeAutoSendPrompt(prompt);
  };
  const handleDispatchAiSession = async (task) => {
    try {
      const dispatchPrompt = [
        `\u3010\u6D3E\u53D1\u540E\u53F0\u5B50 Agent \u6267\u884C\u4EFB\u52A1\u3011`,
        `\u4EFB\u52A1 ID\uFF1A${task.id}`,
        `\u4EFB\u52A1\u540D\u79F0\uFF1A${task.title}`,
        task.desc ? `\u4EFB\u52A1\u8BF4\u660E\uFF1A${task.desc}` : "",
        task.targetMinutes ? `\u5EFA\u8BAE\u9650\u65F6\uFF1A${task.targetMinutes} \u5206\u949F` : "",
        `\u5DE5\u4F5C\u533A\u6839\u76EE\u5F55\uFF1A${cwd}`,
        `----------------------------------------`,
        `\u6267\u884C\u8981\u6C42\uFF1A`,
        `\u8BF7\u4F7F\u7528 subagent \u5DE5\u5177\u542F\u52A8\u4E00\u4E2A\u540E\u53F0\u72EC\u7ACB\u5B50 Agent\uFF08\u53C2\u6570\u5FC5\u987B\u5305\u542B run_in_background: true\uFF09\u53BB\u63A8\u8FDB\u8BE5\u4EFB\u52A1\uFF0C\u4E0D\u963B\u585E\u5F53\u524D\u4F1A\u8BDD\u7EE7\u7EED\u5904\u7406\u5176\u4ED6\u4EFB\u52A1\u3002`,
        `\u5B50 Agent \u7684\u72EC\u7ACB\u63D0\u793A\u8BCD\u8981\u6C42\uFF1A`,
        `1. \u4E13\u6CE8\u5B8C\u6210\u5DE5\u4F5C\u533A\u4EFB\u52A1 "${task.title}"\uFF1B`,
        `2. \u5B8C\u6210\u540E\u76F4\u63A5\u8C03\u7528\u5DE5\u5177\u4FEE\u6539 ./tasks.json \u5C06 [ID: ${task.id}] \u7684 columnId \u66F4\u65B0\u4E3A "done"\uFF1B`,
        `3. \u82E5\u6267\u884C\u53D7\u963B\u9700\u8981\u4EBA\u7C7B\u4ECB\u5165\uFF0C\u5728 ./tasks.json \u4E2D\u5C06\u672C\u4EFB\u52A1\u6807\u8BB0 waitingHumanAction \u8BF4\u660E\u963B\u65AD\u539F\u56E0\uFF1B`,
        `4. \u4E25\u91CD\u5F02\u5E38\u5219\u5C06 columnId \u66F4\u65B0\u4E3A "failed" \u5E76\u9644\u5E26 reason\u3002`,
        `\u542F\u52A8\u5B50 Agent \u540E\uFF0C\u8BF7\u53EA\u7B80\u77ED\u56DE\u590D 1 \u53E5\u8BDD\u544A\u77E5\u5DF2\u5728\u540E\u53F0\u6D3E\u53D1\u51FA\u5B50 Agent\u3002`
      ].filter(Boolean).join("\n");
      executeAutoSendPrompt(dispatchPrompt);
      return sessionId;
    } catch (err) {
      console.error("[dsh-workspace-canvas] dispatch failed:", err);
      throw err;
    }
  };
  const handleOpenSession = (targetSessionId) => {
    if (cordisCtx.sessions?.open) {
      cordisCtx.sessions.open(targetSessionId);
      const chatTab = document.querySelector('button[role="tab"]');
      if (chatTab) chatTab.click();
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
      onReloadStatus: loadStatus,
      onDispatchAiSession: handleDispatchAiSession,
      onOpenSession: handleOpenSession
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
    /* \u89E3\u51B3\u53F3\u4FA7\u6F0F\u5230\u663E\u793A\u5668\u5916\u5EF6\u7684\u95EE\u9898\uFF1A\u5F3A\u5236\u4E3B\u89C6\u533A\u5B89\u5168\u5185\u51F9\u5E76\u7559\u8DB3\u53F3\u4FA7\u4F59\u91CF */
    div[class*="viewArea"],
    div[class*="scrollBody"] {
      box-sizing: border-box !important;
      max-width: 100% !important;
      overflow-x: hidden !important;
    }

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
