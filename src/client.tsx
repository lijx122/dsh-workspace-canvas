import React, { useEffect, useState, useRef } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { TaskView, type TasksData } from './TaskView'

export const inject = ['slots']

const VIEW_ID_TASK = 'dsh-task-canvas'
const VIEW_ID_DESIGN = 'ipollowork-design-studio'
const VIEW_ID_VIDEO = 'ipollowork-video-studio'

export function apply(ctx: Context) {
  // 1. 向 DSH 原生 conversation.view 插槽注入 Task 视图
  ctx.slots.inject('conversation.view', () =>
    ctx.slots.register(
      {
        name: 'conversation.view',
        id: VIEW_ID_TASK,
        order: 15,
        label: 'Task'
      },
      CanvasViewBridge
    )
  )

  // 2. 挂载全局按需常驻加号 (+) 菜单管理器 (统一收纳 Task, Design, Video)
  setupDynamicViewManager()
}

/**
 * 桥接组件：负责获取当前会话所在的 Workspace，读取状态并渲染 TaskView
 */
function CanvasViewBridge({ sessionId, useWorkspaces, inputActions }: { sessionId: string; useWorkspaces: any; inputActions?: any }) {
  const workspace = useWorkspaces((state: any) =>
    state.items?.find((item: any) => item.sessionIds?.includes(sessionId))
  )

  const [loading, setLoading] = useState(true)
  const [tasksData, setTasksData] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)

  const workspaceId = workspace ? String(workspace.workspaceId) : ''
  const cwd = workspace ? workspace.path : ''

  // 加载数据
  const loadStatus = async () => {
    if (!workspaceId && !cwd) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/workspace-canvas/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, cwd })
      })
      const result = await res.json()
      if (result.ok) {
        setTasksData(result.status.tasksData || null)
      } else {
        setError(result.error || '无法获取工作区状态')
      }
    } catch (err: any) {
      setError(err.message || '网络请求失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [workspaceId, cwd])

  // 保存数据回工作区 tasks.json
  const handleSave = async (updatedData: any) => {
    setTasksData(updatedData)
    await fetch('/api/workspace-canvas/save-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, cwd, tasksData: updatedData })
    })
  }

  // 桥接向 AI 发送复盘指令并切回对话
  const handleSendToAi = (prompt: string) => {
    if (inputActions && typeof inputActions.setDraft === 'function') {
      inputActions.setDraft(prompt)
      const chatTab = document.querySelector('button[role="tab"]') as HTMLButtonElement
      if (chatTab) chatTab.click()
    } else {
      navigator.clipboard?.writeText(prompt)
      alert('✨ 复盘诊断提问已自动复制到剪贴板！可直接粘贴到底部输入框发送给 AI。')
    }
  }

  if (!workspace) {
    return (
      <div style={{
        display: 'grid',
        placeContent: 'center',
        height: '100%',
        color: 'var(--dsw-alias-label-secondary, #a0a0a8)',
        fontSize: '13px'
      }}>
        请在已注册的 DSH 工作区会话中打开 Task 看板
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{
        display: 'grid',
        placeContent: 'center',
        height: '100%',
        color: 'var(--dsw-alias-label-tertiary, #686872)',
        fontSize: '12px'
      }}>
        正在加载工作区看板状态...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        display: 'grid',
        placeContent: 'center',
        height: '100%',
        color: 'var(--dsw-alias-state-error-primary, #ef4444)',
        fontSize: '13px'
      }}>
        {error}
      </div>
    )
  }

  return (
    <TaskView
      workspaceId={workspaceId}
      cwd={cwd}
      initialData={tasksData}
      onSave={handleSave}
      onSendToAi={handleSendToAi}
    />
  )
}

/**
 * 顶部 Tab 栏统一动态管理器：
 * 1. 默认收纳 [Task]、[Design]、[Video]，避免无用时占据顶部空间
 * 2. 在 [role="tablist"] 右侧注入 [+] 加号按钮与浮层菜单
 * 3. 用户在 [+] 菜单中按需勾选常驻哪项，哪项就显示在顶部，并支持一键取消常驻
 */
function setupDynamicViewManager() {
  if (typeof document === 'undefined') return

  // 注入样式控制显隐与 [+] 按钮样式
  const styleEl = document.createElement('style')
  styleEl.id = 'dsh-workspace-canvas-manager-styles'
  styleEl.textContent = `
    /* 默认隐藏未勾选常驻的扩展视图，仅在对应开关为 true 时展示 */
    body:not([data-dsh-show-task="true"]) button[role="tab"][data-view-kind="task"] {
      display: none !important;
    }
    body:not([data-dsh-show-design="true"]) button[role="tab"][data-view-kind="design"] {
      display: none !important;
    }
    body:not([data-dsh-show-video="true"]) button[role="tab"][data-view-kind="video"] {
      display: none !important;
    }

    /* [+] 加号管理按钮样式 */
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

    /* 弹出式管理菜单 */
    .dsh-view-menu-popover {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 6px;
      width: 196px;
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
    .dsh-view-menu-header {
      font-size: 11px;
      font-weight: 600;
      color: var(--dsw-alias-label-tertiary, #686872);
      padding: 4px 8px;
      border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.06));
      margin-bottom: 4px;
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
  `
  document.head.appendChild(styleEl)

  // 同步 Tab 栏标识与显隐属性
  const syncTabBar = () => {
    const tablist = document.querySelector('[role="tablist"]')
    if (!tablist) return

    // 标记各 tab 的类型
    const tabs = tablist.querySelectorAll('button[role="tab"]')
    tabs.forEach(tab => {
      const text = tab.textContent?.trim()
      if (text === 'Task') {
        tab.setAttribute('data-view-kind', 'task')
      } else if (text === 'Design') {
        tab.setAttribute('data-view-kind', 'design')
      } else if (text === 'Video') {
        tab.setAttribute('data-view-kind', 'video')
      }
    })

    // 读取开关状态
    const showTask = localStorage.getItem('dsh.canvas.show_task') === 'true'
    const showDesign = localStorage.getItem('dsh.canvas.show_design') === 'true'
    const showVideo = localStorage.getItem('dsh.canvas.show_video') === 'true'

    document.body.setAttribute('data-dsh-show-task', showTask ? 'true' : 'false')
    document.body.setAttribute('data-dsh-show-design', showDesign ? 'true' : 'false')
    document.body.setAttribute('data-dsh-show-video', showVideo ? 'true' : 'false')

    // 注入 [+] 按钮（若尚未注入）
    if (!tablist.querySelector('.dsh-view-add-btn')) {
      const addBtn = document.createElement('button')
      addBtn.className = 'dsh-view-add-btn'
      addBtn.title = '管理常驻视图 (Task / Design / Video)'
      addBtn.textContent = '+'
      addBtn.type = 'button'

      let menuEl: HTMLDivElement | null = null

      const closeMenu = () => {
        if (menuEl) {
          menuEl.remove()
          menuEl = null
        }
      }

      addBtn.onclick = (e) => {
        e.stopPropagation()
        if (menuEl) {
          closeMenu()
          return
        }

        const curTask = localStorage.getItem('dsh.canvas.show_task') === 'true'
        const curDesign = localStorage.getItem('dsh.canvas.show_design') === 'true'
        const curVideo = localStorage.getItem('dsh.canvas.show_video') === 'true'

        menuEl = document.createElement('div')
        menuEl.className = 'dsh-view-menu-popover'
        menuEl.innerHTML = `
          <div class="dsh-view-menu-header">按需常驻扩展视图</div>
          <div class="dsh-view-menu-item" id="itemToggleTask">
            <span>📋 任务看板 (Task)</span>
            <span class="dsh-view-menu-check">${curTask ? '✔' : ''}</span>
          </div>
          <div class="dsh-view-menu-item" id="itemToggleDesign">
            <span>🎨 设计工坊 (Design)</span>
            <span class="dsh-view-menu-check">${curDesign ? '✔' : ''}</span>
          </div>
          <div class="dsh-view-menu-item" id="itemToggleVideo">
            <span>🎬 视频制作 (Video)</span>
            <span class="dsh-view-menu-check">${curVideo ? '✔' : ''}</span>
          </div>
        `

        menuEl.onclick = (ev) => ev.stopPropagation()

        // 点击切换开关
        const bindToggle = (id: string, storageKey: string, bodyAttr: string, kind: string, current: boolean) => {
          const item = menuEl?.querySelector(id) as HTMLElement | null
          if (item) {
            item.onclick = () => {
              const next = !current
              localStorage.setItem(storageKey, next ? 'true' : 'false')
              document.body.setAttribute(bodyAttr, next ? 'true' : 'false')
              closeMenu()

              // 开启时自动切过去
              if (next) {
                const targetTab = tablist.querySelector(`button[data-view-kind="${kind}"]`) as HTMLButtonElement
                if (targetTab) targetTab.click()
              }
            }
          }
        }

        bindToggle('#itemToggleTask', 'dsh.canvas.show_task', 'data-dsh-show-task', 'task', curTask)
        bindToggle('#itemToggleDesign', 'dsh.canvas.show_design', 'data-dsh-show-design', 'design', curDesign)
        bindToggle('#itemToggleVideo', 'dsh.canvas.show_video', 'data-dsh-show-video', 'video', curVideo)

        // 挂载到父容器
        const parent = tablist.parentElement || tablist
        if (getComputedStyle(parent).position === 'static') {
          (parent as HTMLElement).style.position = 'relative'
        }
        parent.appendChild(menuEl)

        const onDocClick = () => {
          closeMenu()
          document.removeEventListener('click', onDocClick)
        }
        setTimeout(() => document.addEventListener('click', onDocClick), 10)
      }

      tablist.appendChild(addBtn)
    }
  }

  const observer = new MutationObserver(() => syncTabBar())
  observer.observe(document.body, { childList: true, subtree: true })
  syncTabBar()
}
