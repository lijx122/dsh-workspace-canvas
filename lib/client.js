// src/client.tsx
import { useEffect as useEffect2, useState as useState2 } from "react";

// src/TaskView.tsx
import { useEffect, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
function TaskView({
  workspaceId,
  cwd,
  initialData,
  onSave
}) {
  const [data, setData] = useState(initialData);
  const [templates, setTemplates] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [modalCol, setModalCol] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState("P1");
  const [newTags, setNewTags] = useState("");
  useEffect(() => {
    if (!data) {
      fetch("/api/workspace-canvas/templates").then((res) => res.json()).then((res) => {
        if (res.ok) setTemplates(res.templates);
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
      }
    } finally {
      setSyncing(false);
    }
  };
  const updateData = async (updater) => {
    if (!data) return;
    const next = updater(data);
    setData(next);
    setSyncing(true);
    try {
      await onSave(next);
    } finally {
      setTimeout(() => setSyncing(false), 400);
    }
  };
  const handleMoveTask = (taskId, targetColId) => {
    updateData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => t.id === taskId ? { ...t, columnId: targetColId } : t)
    }));
  };
  const handleToggleCheck = (taskId, currentDone) => {
    handleMoveTask(taskId, currentDone ? "todo" : "done");
  };
  const handleCreateTask = () => {
    if (!newTitle.trim() || !modalCol) return;
    const tags = newTags.trim() ? newTags.split(/[,，\s]+/) : [];
    const newTask = {
      id: `task-${Date.now()}`,
      columnId: modalCol,
      title: newTitle.trim(),
      desc: newDesc.trim() || void 0,
      priority: newPriority,
      tags: tags.length ? tags : void 0,
      source: "manual",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    updateData((prev) => ({
      ...prev,
      tasks: [newTask, ...prev.tasks]
    }));
    setModalCol(null);
    setNewTitle("");
    setNewDesc("");
    setNewTags("");
  };
  if (!data) {
    return /* @__PURE__ */ jsxs("div", { style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      padding: "32px",
      color: "var(--dsw-alias-label-primary, #f0f0f2)",
      background: "var(--dsw-alias-bg-base, #151517)",
      gap: "20px"
    }, children: [
      /* @__PURE__ */ jsxs("div", { style: { textAlign: "center" }, children: [
        /* @__PURE__ */ jsx("h2", { style: { fontSize: "18px", fontWeight: 600, marginBottom: "8px" }, children: "\u521D\u59CB\u5316\u5DE5\u4F5C\u533A\u4EFB\u52A1\u770B\u677F" }),
        /* @__PURE__ */ jsx("p", { style: { fontSize: "13px", color: "var(--dsw-alias-label-secondary, #a0a0a8)" }, children: "\u5F53\u524D\u5DE5\u4F5C\u533A\u5C1A\u672A\u5EFA\u7ACB tasks.json\uFF0C\u8BF7\u9009\u62E9\u9884\u7F6E\u6A21\u677F\u4E00\u952E\u5C31\u7EEA" })
      ] }),
      /* @__PURE__ */ jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px", maxWidth: "640px", width: "100%" }, children: templates.map((tpl) => /* @__PURE__ */ jsxs(
        "div",
        {
          onClick: () => handleApplyTemplate(tpl.id),
          style: {
            background: "var(--dsw-alias-bg-layer-1, #1a1a1c)",
            border: "1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1))",
            borderRadius: "10px",
            padding: "16px",
            cursor: "pointer",
            transition: "border-color 150ms ease, transform 150ms ease"
          },
          onMouseEnter: (e) => e.currentTarget.style.borderColor = "var(--dsw-alias-brand-primary, #4d6bfe)",
          onMouseLeave: (e) => e.currentTarget.style.borderColor = "var(--dsw-alias-border-l2, rgba(255,255,255,0.1))",
          children: [
            /* @__PURE__ */ jsx("div", { style: { fontSize: "14px", fontWeight: 600, marginBottom: "6px" }, children: tpl.name }),
            /* @__PURE__ */ jsx("div", { style: { fontSize: "12px", color: "var(--dsw-alias-label-secondary, #a0a0a8)", lineHeight: 1.45 }, children: tpl.description }),
            /* @__PURE__ */ jsx("div", { style: { marginTop: "12px", fontSize: "11px", color: "var(--dsw-alias-brand-primary, #4d6bfe)", fontWeight: 600 }, children: "\u70B9\u51FB\u9009\u7528\u6B64\u6A21\u677F \u2192" })
          ]
        },
        tpl.id
      )) })
    ] });
  }
  const total = data.tasks.length;
  const completed = data.tasks.filter((t) => t.columnId === "done").length;
  const pct = total > 0 ? Math.round(completed / total * 100) : 0;
  const focusTask = data.tasks.find((t) => t.id === data.plan.focusTaskId);
  return /* @__PURE__ */ jsxs("div", { style: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    width: "100%",
    background: "var(--dsw-alias-bg-base, #151517)",
    padding: "12px 16px",
    gap: "10px",
    userSelect: "none",
    color: "var(--dsw-alias-label-primary, #f0f0f2)",
    fontFamily: "var(--dsw-font-family, sans-serif)",
    fontSize: "13px"
  }, children: [
    /* @__PURE__ */ jsxs("header", { style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
      padding: "8px 12px",
      background: "var(--dsw-alias-bg-layer-1, #1a1a1c)",
      border: "1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.06))",
      borderRadius: "8px",
      flexShrink: 0
    }, children: [
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }, children: [
        /* @__PURE__ */ jsx("span", { style: {
          fontSize: "11px",
          fontWeight: 600,
          color: "var(--dsw-alias-state-business-primary, #3b82f6)",
          background: "rgba(59, 130, 246, 0.1)",
          border: "1px solid rgba(59, 130, 246, 0.2)",
          borderRadius: "4px",
          padding: "1px 6px",
          whiteSpace: "nowrap"
        }, children: data.plan.currentStage }),
        /* @__PURE__ */ jsx("span", { style: { fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: data.plan.target }),
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "var(--dsw-alias-label-secondary, #a0a0a8)", flexShrink: 0 }, children: [
          /* @__PURE__ */ jsx("div", { style: { width: "80px", height: "4px", background: "var(--dsw-alias-bg-layer-3, #2a2a2e)", borderRadius: "2px", overflow: "hidden" }, children: /* @__PURE__ */ jsx("div", { style: { height: "100%", width: `${pct}%`, background: "var(--dsw-alias-brand-primary, #4d6bfe)", borderRadius: "2px", transition: "width 200ms" } }) }),
          /* @__PURE__ */ jsxs("span", { children: [
            completed,
            " / ",
            total
          ] })
        ] })
      ] }),
      focusTask && /* @__PURE__ */ jsxs("div", { style: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        maxWidth: "380px",
        flex: 1,
        background: "var(--dsw-alias-bg-layer-2, #212124)",
        border: "1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1))",
        borderRadius: "6px",
        padding: "3px 8px",
        minWidth: 0
      }, children: [
        /* @__PURE__ */ jsx("span", { style: {
          fontSize: "10px",
          fontWeight: 700,
          color: "var(--dsw-alias-state-warn-primary, #eab308)",
          background: "rgba(234, 179, 8, 0.12)",
          padding: "1px 5px",
          borderRadius: "3px",
          whiteSpace: "nowrap",
          flexShrink: 0
        }, children: "\u4ECA\u65E5\u805A\u7126" }),
        /* @__PURE__ */ jsx("span", { style: { fontSize: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: focusTask.title })
      ] }),
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }, children: [
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "var(--dsw-alias-label-tertiary, #686872)" }, children: [
          /* @__PURE__ */ jsx("span", { style: {
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: syncing ? "var(--dsw-alias-brand-primary, #4d6bfe)" : "var(--dsw-alias-state-success-primary, #10b981)"
          } }),
          /* @__PURE__ */ jsx("span", { children: syncing ? "\u540C\u6B65\u4E2D..." : "\u5DF2\u540C\u6B65 tasks.json" })
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => setModalCol("todo"),
            style: {
              height: "26px",
              padding: "0 10px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#fff",
              background: "var(--dsw-alias-button-info-fill, #3b5bfd)",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer"
            },
            children: "+ \u4EFB\u52A1"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { style: {
      display: "grid",
      gridTemplateColumns: `repeat(${data.columns.length}, 1fr)`,
      gap: "10px",
      flex: 1,
      minHeight: 0
    }, children: data.columns.map((col) => {
      const colTasks = data.tasks.filter((t) => t.columnId === col.id);
      return /* @__PURE__ */ jsxs("div", { style: {
        display: "flex",
        flexDirection: "column",
        background: "var(--dsw-alias-bg-layer-1, #1a1a1c)",
        border: "1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.06))",
        borderRadius: "8px",
        minHeight: 0,
        overflow: "hidden"
      }, children: [
        /* @__PURE__ */ jsxs("div", { style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 10px",
          borderBottom: "1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.06))",
          flexShrink: 0
        }, children: [
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "6px" }, children: [
            /* @__PURE__ */ jsx("span", { style: {
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: col.id === "done" ? "var(--dsw-alias-state-success-primary, #10b981)" : col.id === "in_progress" ? "var(--dsw-alias-state-warn-primary, #eab308)" : col.id === "todo" ? "var(--dsw-alias-state-business-primary, #3b82f6)" : "var(--dsw-alias-label-tertiary, #686872)"
            } }),
            /* @__PURE__ */ jsx("span", { style: { fontSize: "12.5px", fontWeight: 600 }, children: col.title }),
            /* @__PURE__ */ jsx("span", { style: {
              fontSize: "11px",
              padding: "0 6px",
              borderRadius: "999px",
              background: "var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.05))",
              color: "var(--dsw-alias-label-secondary, #a0a0a8)"
            }, children: colTasks.length })
          ] }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => setModalCol(col.id),
              style: {
                background: "transparent",
                border: "none",
                color: "var(--dsw-alias-label-tertiary, #686872)",
                fontSize: "14px",
                cursor: "pointer"
              },
              children: "+"
            }
          )
        ] }),
        /* @__PURE__ */ jsx("div", { style: {
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          padding: "8px",
          overflowY: "auto",
          flex: 1,
          minHeight: 0
        }, children: colTasks.map((t) => {
          const isDone = t.columnId === "done";
          return /* @__PURE__ */ jsxs("div", { style: {
            background: "var(--dsw-alias-bg-base, #151517)",
            border: `1px solid ${t.id === data.plan.focusTaskId ? "var(--dsw-alias-brand-primary, #4d6bfe)" : "var(--dsw-alias-border-l2, rgba(255,255,255,0.1))"}`,
            borderRadius: "7px",
            padding: "9px 10px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            opacity: isDone ? 0.6 : 1
          }, children: [
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }, children: [
              /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "flex-start", gap: "6px", flex: 1, minWidth: 0 }, children: [
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "checkbox",
                    checked: isDone,
                    onChange: () => handleToggleCheck(t.id, isDone),
                    style: { marginTop: "2px", cursor: "pointer", accentColor: "var(--dsw-alias-state-success-primary, #10b981)" }
                  }
                ),
                /* @__PURE__ */ jsx("span", { style: {
                  fontSize: "12.5px",
                  fontWeight: 500,
                  lineHeight: 1.4,
                  textDecoration: isDone ? "line-through" : "none",
                  color: isDone ? "var(--dsw-alias-label-secondary, #a0a0a8)" : "var(--dsw-alias-label-primary, #f0f0f2)"
                }, children: t.title })
              ] }),
              /* @__PURE__ */ jsx("span", { style: {
                fontSize: "10px",
                fontWeight: 600,
                padding: "0 4px",
                borderRadius: "3px",
                flexShrink: 0,
                color: t.priority === "P0" ? "var(--dsw-alias-state-error-primary, #ef4444)" : t.priority === "P1" ? "var(--dsw-alias-state-warn-primary, #eab308)" : "var(--dsw-alias-label-secondary, #a0a0a8)",
                background: t.priority === "P0" ? "rgba(239, 68, 68, 0.12)" : t.priority === "P1" ? "rgba(234, 179, 8, 0.12)" : "rgba(255, 255, 255, 0.06)"
              }, children: t.priority })
            ] }),
            t.desc && /* @__PURE__ */ jsx("div", { style: { fontSize: "11.5px", color: "var(--dsw-alias-label-secondary, #a0a0a8)", marginLeft: "18px", lineHeight: 1.45 }, children: t.desc }),
            t.tags && t.tags.length > 0 && /* @__PURE__ */ jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: "4px", marginLeft: "18px" }, children: t.tags.map((tag) => /* @__PURE__ */ jsx("span", { style: {
              fontSize: "10px",
              color: "var(--dsw-alias-label-secondary, #a0a0a8)",
              background: "var(--dsw-alias-bg-layer-2, #212124)",
              border: "1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.06))",
              padding: "0 4px",
              borderRadius: "3px"
            }, children: tag.startsWith("#") ? tag : `#${tag}` }, tag)) }),
            /* @__PURE__ */ jsxs("div", { style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "10.5px",
              color: "var(--dsw-alias-label-tertiary, #686872)",
              paddingTop: "4px",
              borderTop: "1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.06))",
              marginLeft: "18px"
            }, children: [
              /* @__PURE__ */ jsx("span", { children: t.source === "ai" ? "\u2728 AI" : "\u{1F464} \u4EBA\u5DE5" }),
              /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: "4px" }, children: [
                col.id !== "todo" && /* @__PURE__ */ jsx("button", { onClick: () => handleMoveTask(t.id, "todo"), style: { background: "transparent", border: "none", color: "var(--dsw-alias-label-secondary)", cursor: "pointer", fontSize: "10.5px" }, children: "\u5F85\u529E" }),
                col.id !== "in_progress" && /* @__PURE__ */ jsx("button", { onClick: () => handleMoveTask(t.id, "in_progress"), style: { background: "transparent", border: "none", color: "var(--dsw-alias-label-secondary)", cursor: "pointer", fontSize: "10.5px" }, children: "\u63A8\u8FDB" }),
                col.id !== "done" && /* @__PURE__ */ jsx("button", { onClick: () => handleMoveTask(t.id, "done"), style: { background: "transparent", border: "none", color: "var(--dsw-alias-label-secondary)", cursor: "pointer", fontSize: "10.5px" }, children: "\u5B8C\u6210" })
              ] })
            ] })
          ] }, t.id);
        }) })
      ] }, col.id);
    }) }),
    modalCol && /* @__PURE__ */ jsx("div", { style: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1e3
    }, children: /* @__PURE__ */ jsxs("div", { style: {
      width: "400px",
      background: "var(--dsw-alias-bg-layer-1, #1a1a1c)",
      border: "1px solid var(--dsw-alias-border-l3, rgba(255,255,255,0.16))",
      borderRadius: "8px",
      padding: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "10px"
    }, children: [
      /* @__PURE__ */ jsxs("div", { style: { fontSize: "14px", fontWeight: 600, display: "flex", justifyContent: "space-between" }, children: [
        /* @__PURE__ */ jsx("span", { children: "\u6DFB\u52A0\u4EFB\u52A1" }),
        /* @__PURE__ */ jsx("span", { style: { cursor: "pointer", color: "var(--dsw-alias-label-tertiary)" }, onClick: () => setModalCol(null), children: "\u2715" })
      ] }),
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "text",
          value: newTitle,
          onChange: (e) => setNewTitle(e.target.value),
          placeholder: "\u4EFB\u52A1\u540D\u79F0...",
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
      ),
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "text",
          value: newDesc,
          onChange: (e) => setNewDesc(e.target.value),
          placeholder: "\u8981\u70B9\u6216\u8865\u5145\u8BF4\u660E...",
          style: {
            background: "var(--dsw-alias-bg-base, #151517)",
            border: "1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1))",
            borderRadius: "5px",
            padding: "6px 8px",
            color: "#fff",
            fontSize: "12px",
            outline: "none"
          }
        }
      ),
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: "8px" }, children: [
        /* @__PURE__ */ jsxs(
          "select",
          {
            value: newPriority,
            onChange: (e) => setNewPriority(e.target.value),
            style: {
              flex: 1,
              background: "var(--dsw-alias-bg-base, #151517)",
              border: "1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1))",
              borderRadius: "5px",
              padding: "5px",
              color: "#fff",
              fontSize: "12px"
            },
            children: [
              /* @__PURE__ */ jsx("option", { value: "P0", children: "P0 (\u6700\u9AD8)" }),
              /* @__PURE__ */ jsx("option", { value: "P1", children: "P1 (\u91CD\u8981)" }),
              /* @__PURE__ */ jsx("option", { value: "P2", children: "P2 (\u666E\u901A)" })
            ]
          }
        ),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            value: newTags,
            onChange: (e) => setNewTags(e.target.value),
            placeholder: "\u6807\u7B7E\u4EE5\u7A7A\u683C\u5206\u9694",
            style: {
              flex: 2,
              background: "var(--dsw-alias-bg-base, #151517)",
              border: "1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1))",
              borderRadius: "5px",
              padding: "5px 8px",
              color: "#fff",
              fontSize: "12px",
              outline: "none"
            }
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "6px" }, children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => setModalCol(null),
            style: {
              padding: "4px 10px",
              background: "transparent",
              border: "1px solid var(--dsw-alias-border-l2)",
              color: "var(--dsw-alias-label-secondary)",
              borderRadius: "5px",
              cursor: "pointer"
            },
            children: "\u53D6\u6D88"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: handleCreateTask,
            style: {
              padding: "4px 12px",
              background: "var(--dsw-alias-button-info-fill)",
              border: "none",
              color: "#fff",
              borderRadius: "5px",
              cursor: "pointer",
              fontWeight: 600
            },
            children: "\u4FDD\u5B58"
          }
        )
      ] })
    ] }) })
  ] });
}

// src/client.tsx
import { jsx as jsx2 } from "react/jsx-runtime";
var inject = ["slots"];
function apply(ctx) {
  ctx.slots.inject(
    "conversation.view",
    () => ctx.slots.register(
      {
        name: "conversation.view",
        id: "dsh-task-canvas",
        order: 15,
        label: "Task"
      },
      CanvasViewBridge
    )
  );
  setupDynamicTabVisibility(ctx);
}
function CanvasViewBridge({ sessionId, useWorkspaces }) {
  const workspace = useWorkspaces(
    (state) => state.items?.find((item) => item.sessionIds?.includes(sessionId))
  );
  const [loading, setLoading] = useState2(true);
  const [tasksData, setTasksData] = useState2(null);
  const [error, setError] = useState2(null);
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
  useEffect2(() => {
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
    return /* @__PURE__ */ jsx2("div", { style: {
      display: "grid",
      placeContent: "center",
      height: "100%",
      color: "var(--dsw-alias-label-secondary, #a0a0a8)",
      fontSize: "13px"
    }, children: "\u8BF7\u5728\u5DF2\u6CE8\u518C\u7684 DSH \u5DE5\u4F5C\u533A\u4F1A\u8BDD\u4E2D\u6253\u5F00 Task \u770B\u677F" });
  }
  if (loading) {
    return /* @__PURE__ */ jsx2("div", { style: {
      display: "grid",
      placeContent: "center",
      height: "100%",
      color: "var(--dsw-alias-label-tertiary, #686872)",
      fontSize: "12px"
    }, children: "\u6B63\u5728\u52A0\u8F7D\u5DE5\u4F5C\u533A\u770B\u677F\u72B6\u6001..." });
  }
  if (error) {
    return /* @__PURE__ */ jsx2("div", { style: {
      display: "grid",
      placeContent: "center",
      height: "100%",
      color: "var(--dsw-alias-state-error-primary, #ef4444)",
      fontSize: "13px"
    }, children: error });
  }
  return /* @__PURE__ */ jsx2(
    TaskView,
    {
      workspaceId,
      cwd,
      initialData: tasksData,
      onSave: handleSave
    }
  );
}
function setupDynamicTabVisibility(ctx) {
  const styleEl = document.createElement("style");
  styleEl.id = "dsh-workspace-canvas-styles";
  styleEl.textContent = `
    /* \u81EA\u5B9A\u4E49 Tab \u89C6\u89C9\u5FAE\u8C03\uFF0C\u5B8C\u7F8E\u8D34\u5408 DSH \u89C4\u8303 */
    button[data-view-id="dsh-task-canvas"] {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
  `;
  document.head.appendChild(styleEl);
}
export {
  apply,
  inject
};
