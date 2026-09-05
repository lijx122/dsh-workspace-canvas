// src/index.ts
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile, access } from "node:fs/promises";
var __dirname = dirname(fileURLToPath(import.meta.url));
var TEMPLATES_DIR = resolve(__dirname, "../templates");
var inject = ["webServer", "workspaceRegistry"];
function apply(ctx) {
  ctx.effect(() => {
    return ctx.webServer.register({
      kind: "prefix",
      path: "/api/workspace-canvas",
      handler: async (req, res) => {
        const url = new URL(req.url ?? "/", `http://${req.headers.host || "localhost"}`);
        const pathname = url.pathname;
        const action = pathname.replace(/^\/api\/workspace-canvas\/?/, "");
        const sendJson = (status, data) => {
          res.writeHead(status, {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*"
          });
          res.end(JSON.stringify(data));
        };
        try {
          if (req.method === "GET" && action === "templates") {
            const shenlun = JSON.parse(await readFile(resolve(TEMPLATES_DIR, "shenlun-task.json"), "utf8"));
            const general = JSON.parse(await readFile(resolve(TEMPLATES_DIR, "general-task.json"), "utf8"));
            return sendJson(200, { ok: true, templates: [shenlun, general] });
          }
          if (req.method === "POST") {
            const buffers = [];
            for await (const chunk of req) {
              buffers.push(chunk);
            }
            const bodyStr = Buffer.concat(buffers).toString("utf8");
            const body = bodyStr ? JSON.parse(bodyStr) : {};
            const workspaceId = body.workspaceId;
            let workspaceCwd = body.cwd;
            if (!workspaceCwd && workspaceId && ctx.workspaceRegistry) {
              const ws = ctx.workspaceRegistry.get(workspaceId);
              if (ws) workspaceCwd = ws.path;
            }
            if (!workspaceCwd) {
              return sendJson(400, { ok: false, error: "\u672A\u627E\u5230\u6307\u5B9A\u5DE5\u4F5C\u533A\u76EE\u5F55" });
            }
            if (action === "status") {
              const checkExists = async (relPath) => {
                try {
                  await access(resolve(workspaceCwd, relPath));
                  return true;
                } catch {
                  return false;
                }
              };
              const hasTasks = await checkExists("tasks.json");
              const hasDesign = await checkExists("design");
              const hasVideo = await checkExists("video");
              const hasStock = await checkExists("watchlist.json");
              let tasksData = null;
              if (hasTasks) {
                try {
                  tasksData = JSON.parse(await readFile(resolve(workspaceCwd, "tasks.json"), "utf8"));
                } catch (e) {
                }
              }
              return sendJson(200, {
                ok: true,
                status: {
                  hasTasks,
                  hasDesign,
                  hasVideo,
                  hasStock,
                  tasksData
                }
              });
            }
            if (action === "save-tasks") {
              const tasksData = body.tasksData;
              if (!tasksData) {
                return sendJson(400, { ok: false, error: "\u7F3A\u5C11 tasksData \u6570\u636E" });
              }
              const targetPath = resolve(workspaceCwd, "tasks.json");
              await writeFile(targetPath, JSON.stringify(tasksData, null, 2), "utf8");
              return sendJson(200, { ok: true });
            }
            if (action === "apply-template") {
              const templateId = body.templateId;
              let templatePath = resolve(TEMPLATES_DIR, "general-task.json");
              if (templateId === "template-task-shenlun") {
                templatePath = resolve(TEMPLATES_DIR, "shenlun-task.json");
              }
              const templateContent = JSON.parse(await readFile(templatePath, "utf8"));
              const targetPath = resolve(workspaceCwd, "tasks.json");
              await writeFile(targetPath, JSON.stringify(templateContent.data, null, 2), "utf8");
              return sendJson(200, { ok: true, tasksData: templateContent.data });
            }
          }
          return sendJson(404, { ok: false, error: `\u672A\u77E5\u64CD\u4F5C: ${action}` });
        } catch (err) {
          console.error("[dsh-workspace-canvas] API error:", err);
          return sendJson(500, { ok: false, error: err.message || "\u5185\u90E8\u670D\u52A1\u5F02\u5E38" });
        }
      }
    });
  });
}
export {
  apply,
  inject
};
