import type { Context } from '@deepseek-ai/cordis'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile, writeFile, access } from 'node:fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATES_DIR = resolve(__dirname, '../templates')

export const inject = ['webServer', 'workspaceRegistry']

export interface WorkspaceStatusResult {
  hasTasks: boolean
  hasDesign: boolean
  hasVideo: boolean
  hasStock: boolean
  tasksData?: any
}

export function apply(ctx: Context) {
  // 注册 HTTP API 服务供前端 client 调用
  ctx.effect(() => {
    return ctx.webServer.register({
      kind: 'prefix',
      path: '/api/workspace-canvas',
      handler: async (req, res) => {
        const url = new URL(req.url ?? '/', `http://${req.headers.host || 'localhost'}`)
        const pathname = url.pathname
        const action = pathname.replace(/^\/api\/workspace-canvas\/?/, '')

        // 统一响应辅助函数
        const sendJson = (status: number, data: any) => {
          res.writeHead(status, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          })
          res.end(JSON.stringify(data))
        }

        try {
          if (req.method === 'GET' && action === 'templates') {
            // 获取内置模板列表
            const shenlun = JSON.parse(await readFile(resolve(TEMPLATES_DIR, 'shenlun-task.json'), 'utf8'))
            const general = JSON.parse(await readFile(resolve(TEMPLATES_DIR, 'general-task.json'), 'utf8'))
            return sendJson(200, { ok: true, templates: [shenlun, general] })
          }

          if (req.method === 'POST') {
            // 解析 POST 请求体
            const buffers: Buffer[] = []
            for await (const chunk of req) {
              buffers.push(chunk)
            }
            const bodyStr = Buffer.concat(buffers).toString('utf8')
            const body = bodyStr ? JSON.parse(bodyStr) : {}

            const workspaceId = body.workspaceId
            let workspaceCwd = body.cwd
            if (!workspaceCwd && workspaceId && ctx.workspaceRegistry) {
              const ws = ctx.workspaceRegistry.get(workspaceId)
              if (ws) workspaceCwd = ws.path
            }

            if (!workspaceCwd) {
              return sendJson(400, { ok: false, error: '未找到指定工作区目录' })
            }

            if (action === 'status') {
              // 检测工作区指纹
              const checkExists = async (relPath: string) => {
                try {
                  await access(resolve(workspaceCwd, relPath))
                  return true
                } catch {
                  return false
                }
              }

              const hasTasks = await checkExists('tasks.json')
              const hasDesign = await checkExists('design')
              const hasVideo = await checkExists('video')
              const hasStock = await checkExists('watchlist.json')

              let tasksData = null
              if (hasTasks) {
                try {
                  tasksData = JSON.parse(await readFile(resolve(workspaceCwd, 'tasks.json'), 'utf8'))
                } catch (e) {
                  // 容错保持 null
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
              })
            }

            if (action === 'save-tasks') {
              // 保存/更新 tasks.json
              const tasksData = body.tasksData
              if (!tasksData) {
                return sendJson(400, { ok: false, error: '缺少 tasksData 数据' })
              }
              const targetPath = resolve(workspaceCwd, 'tasks.json')
              await writeFile(targetPath, JSON.stringify(tasksData, null, 2), 'utf8')
              return sendJson(200, { ok: true })
            }

            if (action === 'apply-template') {
              // 将选定模板初始化写入工作区
              const templateId = body.templateId
              let templatePath = resolve(TEMPLATES_DIR, 'general-task.json')
              if (templateId === 'template-task-shenlun') {
                templatePath = resolve(TEMPLATES_DIR, 'shenlun-task.json')
              }
              const templateContent = JSON.parse(await readFile(templatePath, 'utf8'))
              const targetPath = resolve(workspaceCwd, 'tasks.json')
              await writeFile(targetPath, JSON.stringify(templateContent.data, null, 2), 'utf8')
              return sendJson(200, { ok: true, tasksData: templateContent.data })
            }
          }

          return sendJson(404, { ok: false, error: `未知操作: ${action}` })
        } catch (err: any) {
          console.error('[dsh-workspace-canvas] API error:', err)
          return sendJson(500, { ok: false, error: err.message || '内部服务异常' })
        }
      }
    })
  })
}
