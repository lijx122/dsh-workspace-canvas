import React, { useEffect, useState, useRef } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { TaskView, type TasksData } from './TaskView'

export const inject = ['slots']

const VIEW_ID = 'dsh-task-canvas'
const STORAGE_KEY_PREFIX = 'dsh.workspace.pinned_views:'

export function apply(ctx: Context) {
  // 1. 向 DSH 原生 conversation.view 插槽注入 Task 视图
  ctx.slots.inject('conversation.view', () =>
    ctx.slots.register(
      {
        name: 'conversation.view',
        id: VIEW_ID,
        order: 15,
        label: 'Task'
      },
      CanvasViewBridge
    )
  )

  // 2. 挂载全局按需常驻加号 (+) 菜单管理器
  setupDynamicViewManager()
}

/**
 * 桥接组件：负责获取当前会话所在的 Workspace，读取状态并渲染 TaskView
 */
function CanvasViewBridge({ sessionId, useWorkspaces }: { sessionId: string; useWorkspaces: any }) {
  const workspace = useWorkspaces((state: any) =>
    state.items?.find((item: any) => item.sessionIds?.includes(sessionId))
  )

  const [loading, setLoading] = useState(true)
  const [tasksData, setTasksData] = useState<TasksData | null>(null)
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
  const handleSave = async (updatedData: TasksData) => {
    setTasksData(updatedData)
    await fetch('/api/workspace-canvas/save-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, cwd, tasksData: updatedData })
    })
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
    />
  )
}

/**
 * 顶部 Tab 栏动态管理器：
 * 1. 在 [role="tablist"] 右侧注入 [+] 加号按钮与管理浮层
 * 2. 默认在工作区不常驻 Task 按钮，只有点击 [+] 选择开启「任务看板 (Task)」后才常驻
 * 3. 支持随时取消常驻，状态按当前工作区持久化到 localStorage
 */
function setupDynamicViewManager() {
  if (typeof document === 'undefined') return

  // 注入样式控制显隐与 [+] 按钮样式
  const styleEl = document.createElement('style')
  styleEl.id = 'dsh-workspace-canvas-manager-styles'
  styleEl.textContent = `
    /* 默认隐藏 Task 按钮，只有当当前工作区已启用时显示 */
    body:not([data-dsh-has-task="true"]) button[role="tab"]:is([data-view-id="dsh-task-canvas"]) {
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
  `
  document.head.appendChild(styleEl)

  // 轮询与观察 DOM，在 [role="tablist"] 内挂载 [+] 按钮并标记按钮属性
  const syncTabBar = () => {
    const tablist = document.querySelector('[role="tablist"]')
    if (!tablist) return

    // 为每个 tab 打上 data-view-id 方便选择器识别
    const tabs = tablist.querySelectorAll('button[role="tab"]')
    tabs.forEach(tab => {
      const text = tab.textContent?.trim()
      if (text === 'Task') {
        tab.setAttribute('data-view-id', VIEW_ID)
      }
    })

    // 读取当前工作区是否有开启 task
    const isTaskEnabled = localStorage.getItem('dsh.canvas.task_pinned') === 'true'
    document.body.setAttribute('data-dsh-has-task', isTaskEnabled ? 'true' : 'false')

    // 注入 [+] 按钮（若尚未注入）
    if (!tablist.querySelector('.dsh-view-add-btn')) {
      const addBtn = document.createElement('button')
      addBtn.className = 'dsh-view-add-btn'
      addBtn.title = '管理当前会话常驻视图 (Task 看板等)'
      addBtn.textContent = '+'
      addBtn.type = 'button'

      // 菜单状态与浮层
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

        const currentPinned = localStorage.getItem('dsh.canvas.task_pinned') === 'true'

        menuEl = document.createElement('div')
        menuEl.className = 'dsh-view-menu-popover'
        menuEl.innerHTML = `
          <div style="font-size: 11px; color: var(--dsw-alias-label-tertiary, #686872); padding: 4px 8px; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.06)); margin-bottom: 4px;">
            会话视图管理
          </div>
          <div class="dsh-view-menu-item" id="menuToggleTask">
            <span>任务看板 (Task)</span>
            <span class="dsh-view-menu-check">${currentPinned ? '✔' : ''}</span>
          </div>
        `

        menuEl.onclick = (ev) => ev.stopPropagation()

        const toggleItem = menuEl.querySelector('#menuToggleTask') as HTMLElement
        if (toggleItem) {
          toggleItem.onclick = () => {
            const next = !currentPinned
            localStorage.setItem('dsh.canvas.task_pinned', next ? 'true' : 'false')
            document.body.setAttribute('data-dsh-has-task', next ? 'true' : 'false')
            closeMenu()

            // 如果开启了常驻，且界面上有 Task tab，自动点击切换过去
            if (next) {
              const taskTab = tablist.querySelector('button[data-view-id="dsh-task-canvas"]') as HTMLButtonElement
              if (taskTab) taskTab.click()
            }
          }
        }

        // 挂载到父级相对定位容器
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

  // 观察与防抖挂载
  const observer = new MutationObserver(() => syncTabBar())
  observer.observe(document.body, { childList: true, subtree: true })
  syncTabBar()
}
