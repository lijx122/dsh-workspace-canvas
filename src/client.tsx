import React, { useEffect, useState, useRef } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { TaskView, type TasksData } from './TaskView'

export const inject = ['slots']

export function apply(ctx: Context) {
  // 向 DSH 原生 conversation.view 插槽注入 Task 视图
  ctx.slots.inject('conversation.view', () =>
    ctx.slots.register(
      {
        name: 'conversation.view',
        id: 'dsh-task-canvas',
        order: 15,
        label: 'Task'
      },
      CanvasViewBridge
    )
  )

  // 动态控制 Tab 显隐：根据工作区特征控制顶部按钮是否展示
  setupDynamicTabVisibility(ctx)
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
 * 动态 Tab 显隐逻辑：
 * 探测当前工作区特征，如果工作区没有特定文件，允许通过轻量样式规则进行过滤
 */
function setupDynamicTabVisibility(ctx: Context) {
  // 注入轻量样式规则，支持通过给 html / body 注入属性进行条件控制
  const styleEl = document.createElement('style')
  styleEl.id = 'dsh-workspace-canvas-styles'
  styleEl.textContent = `
    /* 自定义 Tab 视觉微调，完美贴合 DSH 规范 */
    button[data-view-id="dsh-task-canvas"] {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
  `
  document.head.appendChild(styleEl)
}
