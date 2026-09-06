import React, { useEffect, useState, useRef } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { TaskView, type CanvasBoardData } from './TaskView'

export const inject = ['slots', 'sessions', 'workspaces']

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

  // 2. 挂载全局按需常驻加号 (+) 菜单管理器 (以工作区为粒度独立隔离)
  setupDynamicViewManager(ctx)
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
      key={`${workspaceId}_${cwd}`}
      workspaceId={workspaceId}
      cwd={cwd}
      initialData={tasksData}
      onSave={handleSave}
      onSendToAi={handleSendToAi}
      onReloadStatus={loadStatus}
    />
  )
}

/**
 * 获取当前活动会话所属的工作区标识（优先 workspaceId，无工作区会话为 default）
 */
function getCurrentWorkspaceScope(ctx?: Context): string {
  try {
    if (ctx?.sessions && ctx?.workspaces) {
      const currentSessionId = ctx.sessions.list?.getSnapshot?.()?.current
      if (currentSessionId) {
        const wsSnapshot = ctx.workspaces.list?.getSnapshot?.()
        const found = wsSnapshot?.items?.find((item: any) => item.sessionIds?.includes(currentSessionId))
        if (found?.workspaceId) return String(found.workspaceId)
      }
    }
  } catch (e) {
    // 降级使用 default
  }
  return 'default'
}

/**
 * 顶部 Tab 栏统一动态管理器：
 * 1. 修复同行排版：严格对齐 DSH 原生 .tab 样式与尺寸，禁止换行
 * 2. 工作区独立隔离：每个工作区的视图常驻状态（Task / Design / Video）彼此完全隔离
 * 3. 约束外层容器边距与滚动，彻底避免右侧漏出显示器外延
 */
function setupDynamicViewManager(ctx: Context) {
  if (typeof document === 'undefined') return

  const styleEl = document.createElement('style')
  styleEl.id = 'dsh-workspace-canvas-manager-styles'
  styleEl.textContent = `
    /* 解决右侧漏到显示器外延的问题：强制主视区安全内凹并留足右侧余量 */
    div[class*="viewArea"],
    div[class*="scrollBody"] {
      box-sizing: border-box !important;
      max-width: 100% !important;
      overflow-x: hidden !important;
    }

    /* 保证 [role="tablist"] 内的所有标签强制同一行排版、禁止折行换行 */
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

    /* 默认隐藏未在当前工作区勾选常驻的扩展视图，仅在对应作用域开关为 true 时展示 */
    body:not([data-dsh-show-task="true"]) button[role="tab"][data-view-kind="task"] {
      display: none !important;
    }
    body:not([data-dsh-show-design="true"]) button[role="tab"][data-view-kind="design"] {
      display: none !important;
    }
    body:not([data-dsh-show-video="true"]) button[role="tab"][data-view-kind="video"] {
      display: none !important;
    }

    /* 确保注入的 tab 按钮与原生 tab 样式 100% 同行对齐 */
    button[role="tab"] {
      flex-shrink: 0 !important;
      white-space: nowrap !important;
    }

    /* [+] 加号管理按钮样式：高度对齐，紧跟在 tablist 末尾 */
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

    /* 弹出式管理菜单 */
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
  `
  document.head.appendChild(styleEl)

  // 同步 Tab 栏标识与当前工作区专属的显隐属性
  const syncTabBar = () => {
    const tablist = document.querySelector('[role="tablist"]')
    if (!tablist) return

    // 获取当前活动工作区的独立 scope key
    const wsScope = getCurrentWorkspaceScope(ctx)

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

    // 基于当前工作区读取独立配置
    const showTask = localStorage.getItem(`dsh.canvas.${wsScope}.show_task`) === 'true'
    const showDesign = localStorage.getItem(`dsh.canvas.${wsScope}.show_design`) === 'true'
    const showVideo = localStorage.getItem(`dsh.canvas.${wsScope}.show_video`) === 'true'

    document.body.setAttribute('data-dsh-show-task', showTask ? 'true' : 'false')
    document.body.setAttribute('data-dsh-show-design', showDesign ? 'true' : 'false')
    document.body.setAttribute('data-dsh-show-video', showVideo ? 'true' : 'false')

    // 注入 [+] 按钮（若尚未注入）
    if (!tablist.querySelector('.dsh-view-add-btn')) {
      const addBtn = document.createElement('button')
      addBtn.className = 'dsh-view-add-btn'
      addBtn.title = 'Add views'
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

        const currentScope = getCurrentWorkspaceScope(ctx)
        const curTask = localStorage.getItem(`dsh.canvas.${currentScope}.show_task`) === 'true'
        const curDesign = localStorage.getItem(`dsh.canvas.${currentScope}.show_design`) === 'true'
        const curVideo = localStorage.getItem(`dsh.canvas.${currentScope}.show_video`) === 'true'

        menuEl = document.createElement('div')
        menuEl.className = 'dsh-view-menu-popover'
        menuEl.innerHTML = `
          <div class="dsh-view-menu-item" id="itemToggleTask">
            <span>Task</span>
            <span class="dsh-view-menu-check">${curTask ? '✔' : ''}</span>
          </div>
          <div class="dsh-view-menu-item" id="itemToggleDesign">
            <span>Design</span>
            <span class="dsh-view-menu-check">${curDesign ? '✔' : ''}</span>
          </div>
          <div class="dsh-view-menu-item" id="itemToggleVideo">
            <span>Video</span>
            <span class="dsh-view-menu-check">${curVideo ? '✔' : ''}</span>
          </div>
        `

        menuEl.onclick = (ev) => ev.stopPropagation()

        // 绑定工作区独立切换
        const bindToggle = (id: string, prop: string, bodyAttr: string, kind: string, currentVal: boolean) => {
          const item = menuEl?.querySelector(id) as HTMLElement | null
          if (item) {
            item.onclick = () => {
              const next = !currentVal
              localStorage.setItem(`dsh.canvas.${currentScope}.${prop}`, next ? 'true' : 'false')
              document.body.setAttribute(bodyAttr, next ? 'true' : 'false')
              closeMenu()

              if (next) {
                const targetTab = tablist.querySelector(`button[data-view-kind="${kind}"]`) as HTMLButtonElement
                if (targetTab) targetTab.click()
              }
            }
          }
        }

        bindToggle('#itemToggleTask', 'show_task', 'data-dsh-show-task', 'task', curTask)
        bindToggle('#itemToggleDesign', 'show_design', 'data-dsh-show-design', 'design', curDesign)
        bindToggle('#itemToggleVideo', 'show_video', 'data-dsh-show-video', 'video', curVideo)

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

  if (ctx.sessions?.list) {
    ctx.sessions.list.subscribe(() => syncTabBar())
  }
  if (ctx.workspaces?.list) {
    ctx.workspaces.list.subscribe(() => syncTabBar())
  }

  syncTabBar()
}
