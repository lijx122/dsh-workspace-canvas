import React, { useEffect, useState, useRef } from 'react'

export interface KanbanColumn {
  id: string
  title: string
  color?: string
}

export interface KanbanTaskItem {
  id: string
  columnId: string
  title: string
  desc?: string
  priority?: 'P0' | 'P1' | 'P2'
  tags?: string[]
  targetMinutes?: number
  actualMinutes?: number
  source?: 'ai' | 'manual'
  createdAt?: string
  reason?: string // 失败原因或复盘要点
}

export interface CanvasBoardData {
  version?: string
  type?: 'standard_5cols' | 'custom' | string
  meta?: {
    title: string
    description?: string
    updatedAt?: string
  }
  columns: KanbanColumn[]
  tasks: KanbanTaskItem[]
}

const DEFAULT_5_COLS: KanbanColumn[] = [
  { id: 'planned', title: '待规划', color: '#64748b' },
  { id: 'todo', title: '待办', color: '#38bdf8' },
  { id: 'in_progress', title: '进行中', color: '#eab308' },
  { id: 'done', title: '完成', color: '#10b981' },
  { id: 'failed', title: '失败', color: '#ef4444' }
]

export function TaskView({
  workspaceId,
  cwd,
  initialData,
  viewConfig,
  onSave,
  onSendToAi,
  onReloadStatus
}: {
  workspaceId: string
  cwd: string
  initialData: any
  viewConfig?: any
  onSave: (data: any) => Promise<void>
  onSendToAi?: (prompt: string) => void
  onReloadStatus?: () => Promise<void>
}) {
  // 数据格式自适应：如果有 columns 和 tasks 则为通用看板
  const normalizeData = (raw: any): CanvasBoardData | null => {
    if (!raw) return null
    if (Array.isArray(raw.columns) && Array.isArray(raw.tasks)) {
      return raw as CanvasBoardData
    }
    return null
  }

  const [data, setData] = useState<CanvasBoardData | null>(() => normalizeData(initialData))
  useEffect(() => {
    setData(normalizeData(initialData))
  }, [initialData])

  const [templates, setTemplates] = useState<any[]>([])
  const [syncing, setSyncing] = useState<boolean>(false)

  // 专注计时器状态
  const [activeTimerTask, setActiveTimerTask] = useState<KanbanTaskItem | null>(null)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0)
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false)

  // 任务创建/编辑弹窗
  const [createModalCol, setCreateModalCol] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<KanbanTaskItem | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formPriority, setFormPriority] = useState<'P0' | 'P1' | 'P2'>('P1')
  const [formMinutes, setFormMinutes] = useState<number>(25)
  const [formTags, setFormTags] = useState('')

  // 失败标记弹窗
  const [failModalTask, setFailModalTask] = useState<KanbanTaskItem | null>(null)
  const [failReason, setFailReason] = useState('')

  // 自定义增删列状态
  const [showAddColModal, setShowAddColModal] = useState(false)
  const [newColTitle, setNewColTitle] = useState('')

  // 无数据时拉取系统提供的模板供用户二选一初始化
  useEffect(() => {
    if (!data) {
      fetch('/api/workspace-canvas/templates')
        .then(res => res.json())
        .then(res => {
          if (res.ok) setTemplates(res.templates || [])
        })
        .catch(console.error)
    }
  }, [data])

  // 应用所选模板初始化
  const handleApplyTemplate = async (templateId: string) => {
    setSyncing(true)
    try {
      const res = await fetch('/api/workspace-canvas/apply-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, cwd, templateId })
      })
      const result = await res.json()
      if (result.ok) {
        setData(result.tasksData)
        if (onReloadStatus) await onReloadStatus()
      }
    } finally {
      setSyncing(false)
    }
  }

  // 倒计时计时心跳
  useEffect(() => {
    let timer: any = null
    if (isTimerRunning && secondsRemaining > 0) {
      timer = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            setIsTimerRunning(false)
            if (activeTimerTask) {
              handleTimerAutoComplete(activeTimerTask.id, activeTimerTask.targetMinutes || 25)
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [isTimerRunning, secondsRemaining, activeTimerTask])

  // 倒计时结束：自动流转到 [完成] 列
  const handleTimerAutoComplete = (taskId: string, targetMin: number) => {
    updateBoard(prev => ({
      ...prev,
      tasks: prev.tasks.map(t =>
        t.id === taskId
          ? { ...t, columnId: 'done', actualMinutes: targetMin }
          : t
      )
    }))
    alert(`🎉 限时结束！任务已自动标记流转至【完成】！`)
  }

  // 启动某任务计时
  const handleStartTimer = (task: KanbanTaskItem) => {
    if (activeTimerTask?.id === task.id && isTimerRunning) {
      setIsTimerRunning(false)
      return
    }
    const mins = task.targetMinutes || 25
    setActiveTimerTask(task)
    setSecondsRemaining(mins * 60)
    setIsTimerRunning(true)
  }

  // 提前完成计时
  const handleFinishTimerEarly = () => {
    if (!activeTimerTask) return
    const targetMin = activeTimerTask.targetMinutes || 25
    const elapsedSec = targetMin * 60 - secondsRemaining
    const actualMin = Math.max(1, Math.round(elapsedSec / 60))

    updateBoard(prev => ({
      ...prev,
      tasks: prev.tasks.map(t =>
        t.id === activeTimerTask.id
          ? { ...t, columnId: 'done', actualMinutes: actualMin }
          : t
      )
    }))

    setIsTimerRunning(false)
    setActiveTimerTask(null)
    setSecondsRemaining(0)
  }

  // 统一保存更新看板
  const updateBoard = async (updater: (prev: CanvasBoardData) => CanvasBoardData) => {
    if (!data) return
    const next = updater(data)
    setData(next)
    setSyncing(true)
    try {
      await onSave(next)
    } finally {
      setTimeout(() => setSyncing(false), 300)
    }
  }

  // 快速移动列
  const handleMoveColumn = (taskId: string, targetColId: string) => {
    if (targetColId === 'failed') {
      const task = data?.tasks.find(t => t.id === taskId)
      if (task) {
        setFailModalTask(task)
        setFailReason('')
        return
      }
    }
    updateBoard(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => (t.id === taskId ? { ...t, columnId: targetColId } : t))
    }))
  }

  // 提交失败并记录原因
  const handleCommitFailed = () => {
    if (!failModalTask) return
    updateBoard(prev => ({
      ...prev,
      tasks: prev.tasks.map(t =>
        t.id === failModalTask.id
          ? { ...t, columnId: 'failed', reason: failReason.trim() || '未标注失败原因' }
          : t
      )
    }))
    setFailModalTask(null)
    setFailReason('')
  }

  // 保存新建任务
  const handleSaveTask = () => {
    if (!formTitle.trim()) return
    const tags = formTags.trim() ? formTags.split(/[,，\s]+/) : []

    if (editingTask) {
      updateBoard(prev => ({
        ...prev,
        tasks: prev.tasks.map(t =>
          t.id === editingTask.id
            ? {
                ...t,
                title: formTitle.trim(),
                desc: formDesc.trim() || undefined,
                priority: formPriority,
                targetMinutes: formMinutes,
                tags: tags.length ? tags : undefined
              }
            : t
        )
      }))
    } else {
      const newTask: KanbanTaskItem = {
        id: `task-${Date.now()}`,
        columnId: createModalCol || (data?.columns[0]?.id ?? 'planned'),
        title: formTitle.trim(),
        desc: formDesc.trim() || undefined,
        priority: formPriority,
        targetMinutes: formMinutes,
        tags: tags.length ? tags : undefined,
        source: 'manual',
        createdAt: new Date().toISOString()
      }
      updateBoard(prev => ({
        ...prev,
        tasks: [newTask, ...prev.tasks]
      }))
    }

    setCreateModalCol(null)
    setEditingTask(null)
    setFormTitle('')
    setFormDesc('')
    setFormTags('')
  }

  // 删除任务
  const handleDeleteTask = (taskId: string) => {
    if (!confirm('确定删除该任务卡片吗？')) return
    updateBoard(prev => ({
      ...prev,
      tasks: prev.tasks.filter(t => t.id !== taskId)
    }))
  }

  // 新增自定义列
  const handleAddCustomColumn = () => {
    if (!newColTitle.trim()) return
    const newColId = `col-${Date.now()}`
    updateBoard(prev => ({
      ...prev,
      columns: [...prev.columns, { id: newColId, title: newColTitle.trim(), color: '#38bdf8' }]
    }))
    setNewColTitle('')
    setShowAddColModal(false)
  }

  // 删除自定义列
  const handleDeleteColumn = (colId: string) => {
    if (!confirm('确定删除该列吗？该列内的任务将自动移至第一列。')) return
    updateBoard(prev => {
      const remainingCols = prev.columns.filter(c => c.id !== colId)
      const fallbackColId = remainingCols[0]?.id ?? 'planned'
      return {
        ...prev,
        columns: remainingCols,
        tasks: prev.tasks.map(t => (t.columnId === colId ? { ...t, columnId: fallbackColId } : t))
      }
    })
  }

  // 格式化时间
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // 向 AI 发送复盘诊断
  const handleDispatchAiPrompt = (task: KanbanTaskItem) => {
    const prompt = [
      `【工作区任务复盘与执行诊断】`,
      `工作区路径：${cwd}`,
      `任务名称：${task.title}`,
      `当前状态：${task.columnId === 'done' ? '已完成' : task.columnId === 'failed' ? '失败/阻塞' : '进行中'}`,
      task.reason ? `失败卡点或原因：${task.reason}` : '',
      task.desc ? `任务说明：${task.desc}` : '',
      task.actualMinutes ? `实际执行耗时：${task.actualMinutes} 分钟` : '',
      `----------------------------------------`,
      `请结合当前任务情况给出：`,
      `1. 针对该任务的执行难点或失败原因的改进对策；`,
      `2. 是否需要将该任务拆解为下一步的具体可执行子任务并写回 tasks.json。`
    ].filter(Boolean).join('\n')

    if (onSendToAi) {
      onSendToAi(prompt)
    } else {
      navigator.clipboard?.writeText(prompt)
      alert('✨ 复盘提示已复制到剪贴板！可直接粘贴到底部输入框。')
    }
  }

  // 1. 无数据时：展示专属二选一模板选用页
  if (!data) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '32px',
        color: 'var(--dsw-alias-label-primary, #f0f0f2)',
        background: 'var(--dsw-alias-bg-base, #151517)',
        gap: '20px',
        userSelect: 'none'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--dsw-alias-label-tertiary, #686872)', marginBottom: '4px' }}>
            工作区：{cwd || workspaceId}
          </div>
          <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '6px' }}>为此工作区启用 Task 看板</h2>
          <p style={{ fontSize: '12.5px', color: 'var(--dsw-alias-label-secondary, #a0a0a8)' }}>
            当前工作区目录下未找到 tasks.json，请选择看板模板初始化：
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '16px', maxWidth: '640px', width: '100%' }}>
          {templates.map(tpl => (
            <div
              key={tpl.id}
              onClick={() => handleApplyTemplate(tpl.id)}
              style={{
                background: 'var(--dsw-alias-bg-layer-1, #1a1a1c)',
                border: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1))',
                borderRadius: '8px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'border-color 150ms ease, transform 150ms ease'
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--dsw-alias-brand-primary, #4d6bfe)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--dsw-alias-border-l2, rgba(255,255,255,0.1))')}
            >
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>{tpl.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--dsw-alias-label-secondary, #a0a0a8)', lineHeight: 1.45 }}>{tpl.description}</div>
              <div style={{ marginTop: '12px', fontSize: '11.5px', color: 'var(--dsw-alias-brand-primary, #4d6bfe)', fontWeight: 600 }}>选用并生成 tasks.json →</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 计算任务统计
  const totalCount = data.tasks.length
  const doneCount = data.tasks.filter(t => t.columnId === 'done').length
  const failedCount = data.tasks.filter(t => t.columnId === 'failed').length
  const inProgressCount = data.tasks.filter(t => t.columnId === 'in_progress').length
  const workspaceTitle = cwd.split(/[\/\\]/).pop() || workspaceId

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      background: 'var(--dsw-alias-bg-base, #151517)',
      padding: '12px 28px 16px 20px',
      gap: '12px',
      color: 'var(--dsw-alias-label-primary, #f0f0f2)',
      fontFamily: 'var(--dsw-font-family, sans-serif)',
      fontSize: '13px',
      userSelect: 'none',
      overflowX: 'hidden',
      overflowY: 'auto'
    }}>
      {/* 顶部操作条与指标 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        background: 'var(--dsw-alias-bg-layer-1, #1a1a1c)',
        border: '1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.06))',
        borderRadius: '8px',
        gap: '12px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#3b82f6',
            background: 'rgba(59, 130, 246, 0.12)',
            padding: '2px 7px',
            borderRadius: '4px',
            whiteSpace: 'nowrap'
          }}>
            {data.type === 'standard_5cols' ? '五列流转看板' : '自定义看板'}
          </span>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>{data.meta?.title || workspaceTitle}</span>
          <span style={{ fontSize: '11.5px', color: 'var(--dsw-alias-label-tertiary, #686872)' }}>
            ({cwd})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <span style={{ fontSize: '11.5px', color: 'var(--dsw-alias-label-secondary, #a0a0a8)' }}>
            总计 {totalCount} · 达成 {doneCount} · 推进中 {inProgressCount} {failedCount > 0 ? `· 阻塞 ${failedCount}` : ''}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--dsw-alias-label-tertiary, #686872)' }}>
            {syncing ? '同步 tasks.json...' : '已就绪'}
          </span>
          <button
            onClick={() => setShowAddColModal(true)}
            style={{
              height: '24px',
              padding: '0 8px',
              fontSize: '11.5px',
              color: 'var(--dsw-alias-label-secondary, #a0a0a8)',
              background: 'transparent',
              border: '1px dashed var(--dsw-alias-border-l2, rgba(255,255,255,0.15))',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            + 加列
          </button>
        </div>
      </div>

      {/* 限时专注计时器横幅 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '9px 14px',
        background: activeTimerTask ? 'linear-gradient(135deg, #1c2333 0%, #151a24 100%)' : 'var(--dsw-alias-bg-layer-2, #212124)',
        border: `1px solid ${activeTimerTask ? 'var(--dsw-alias-brand-primary, #4d6bfe)' : 'var(--dsw-alias-border-l2, rgba(255,255,255,0.1))'}`,
        borderRadius: '8px',
        boxShadow: activeTimerTask ? '0 0 12px rgba(59, 130, 246, 0.25)' : 'none',
        transition: 'all 200ms ease',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <span style={{ fontSize: '16px' }}>⏱</span>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--dsw-alias-label-secondary, #a0a0a8)' }}>
              {activeTimerTask ? `限时专注进行中` : '点击任意任务卡片上的 [⏱] 图标载入专注倒计时'}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: activeTimerTask ? '#60a5fa' : '#f0f0f2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeTimerTask ? activeTimerTask.title : '计时结束后将自动标记任务流转至【完成】'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {activeTimerTask && (
            <div style={{
              fontSize: '22px',
              fontFamily: 'ui-monospace, monospace',
              fontWeight: 700,
              color: secondsRemaining <= 300 ? '#ef4444' : '#38bdf8',
              letterSpacing: '1px'
            }}>
              {formatTime(secondsRemaining)}
            </div>
          )}

          {activeTimerTask && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setIsTimerRunning(prev => !prev)}
                style={{
                  height: '26px',
                  padding: '0 10px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: '#fff',
                  background: isTimerRunning ? '#eab308' : 'var(--dsw-alias-button-info-fill, #3b5bfd)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {isTimerRunning ? '暂停' : '继续'}
              </button>
              <button
                onClick={handleFinishTimerEarly}
                style={{
                  height: '26px',
                  padding: '0 10px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: '#10b981',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                交卷完成 ✔
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 核心看板泳道（自适应列数：标准五列或自定义列） */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${data.columns.length}, minmax(190px, 1fr))`,
        gap: '10px',
        flex: 1,
        minHeight: 0,
        boxSizing: 'border-box',
        overflowX: 'auto',
        overflowY: 'hidden',
        paddingBottom: '4px'
      }}>
        {data.columns.map(col => {
          const colTasks = data.tasks.filter(t => t.columnId === col.id)
          const colColor = col.color || (col.id === 'done' ? '#10b981' : col.id === 'failed' ? '#ef4444' : col.id === 'in_progress' ? '#eab308' : '#38bdf8')

          return (
            <div
              key={col.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--dsw-alias-bg-layer-1, #1a1a1c)',
                border: '1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.06))',
                borderRadius: '8px',
                minHeight: 0,
                overflow: 'hidden'
              }}
            >
              {/* 列头 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.06))',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: colColor }} />
                  <span style={{ fontSize: '12.5px', fontWeight: 600 }}>{col.title}</span>
                  <span style={{
                    fontSize: '11px',
                    padding: '0 6px',
                    borderRadius: '999px',
                    background: 'var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.05))',
                    color: 'var(--dsw-alias-label-secondary, #a0a0a8)'
                  }}>
                    {colTasks.length}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {data.type === 'custom' && data.columns.length > 1 && (
                    <button
                      onClick={() => handleDeleteColumn(col.id)}
                      title="删除此列"
                      style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: '11px' }}
                    >
                      ✕
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setCreateModalCol(col.id)
                      setEditingTask(null)
                      setFormTitle('')
                      setFormDesc('')
                      setFormTags('')
                    }}
                    title="向此列添加任务"
                    style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '14px' }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* 任务卡片列表 */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '8px',
                overflowY: 'auto',
                flex: 1,
                minHeight: 0
              }}>
                {colTasks.map(task => {
                  const isTimerTarget = activeTimerTask?.id === task.id
                  const isDone = task.columnId === 'done'
                  const isFailed = task.columnId === 'failed'

                  return (
                    <div
                      key={task.id}
                      style={{
                        background: 'var(--dsw-alias-bg-base, #151517)',
                        border: `1px solid ${isTimerTarget ? '#4d6bfe' : isFailed ? 'rgba(239, 68, 68, 0.4)' : isDone ? 'rgba(16, 185, 129, 0.25)' : 'var(--dsw-alias-border-l2, rgba(255,255,255,0.1))'}`,
                        borderRadius: '6px',
                        padding: '9px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        opacity: isDone ? 0.6 : 1,
                        transition: 'border-color 150ms ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{
                          fontSize: '12.5px',
                          fontWeight: 500,
                          lineHeight: 1.4,
                          color: isDone ? '#888' : isFailed ? '#fca5a5' : '#eee',
                          textDecoration: isDone ? 'line-through' : 'none',
                          wordBreak: 'break-word'
                        }}>
                          {task.title}
                        </span>

                        <span style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          padding: '0 4px',
                          borderRadius: '3px',
                          flexShrink: 0,
                          color: task.priority === 'P0' ? '#ef4444' : task.priority === 'P1' ? '#eab308' : '#888',
                          background: task.priority === 'P0' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.05)'
                        }}>
                          {task.priority || 'P1'}
                        </span>
                      </div>

                      {task.desc && (
                        <div style={{ fontSize: '11.5px', color: 'var(--dsw-alias-label-secondary, #a0a0a8)', lineHeight: 1.45 }}>
                          {task.desc}
                        </div>
                      )}

                      {task.reason && (
                        <div style={{ fontSize: '11px', color: '#f87171', background: 'rgba(239, 68, 68, 0.08)', padding: '3px 6px', borderRadius: '4px' }}>
                          ⚠ 失败原因: {task.reason}
                        </div>
                      )}

                      {task.tags && task.tags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {task.tags.map(tag => (
                            <span key={tag} style={{
                              fontSize: '10px',
                              color: '#94a3b8',
                              background: 'var(--dsw-alias-bg-layer-2, #212124)',
                              border: '1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.06))',
                              padding: '0 4px',
                              borderRadius: '3px'
                            }}>
                              {tag.startsWith('#') ? tag : `#${tag}`}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 卡片底栏与流转操作 */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '10.5px',
                        color: 'var(--dsw-alias-label-tertiary, #686872)',
                        paddingTop: '4px',
                        borderTop: '1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.06))',
                        marginTop: '2px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            onClick={() => handleStartTimer(task)}
                            title="限时专注计时"
                            style={{ background: 'transparent', border: 'none', color: isTimerTarget ? '#eab308' : '#38bdf8', cursor: 'pointer', fontSize: '11px' }}
                          >
                            ⏱ {task.targetMinutes || 25}m
                          </button>
                          <button
                            onClick={() => handleDispatchAiPrompt(task)}
                            title="向 AI 发送复盘诊断"
                            style={{ background: 'transparent', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: '11px' }}
                          >
                            ✨ 复盘
                          </button>
                        </div>

                        {/* 流转下拉/快捷菜单 */}
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <select
                            value={task.columnId}
                            onChange={e => handleMoveColumn(task.id, e.target.value)}
                            style={{
                              background: '#1a1a1c',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '3px',
                              color: '#ccc',
                              fontSize: '10.5px',
                              outline: 'none',
                              padding: '1px 2px'
                            }}
                          >
                            {data.columns.map(c => (
                              <option key={c.id} value={c.id}>{c.title}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            title="删除"
                            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '10px' }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* 创建 / 编辑任务弹窗 */}
      {createModalCol && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            width: '420px',
            background: 'var(--dsw-alias-bg-layer-1, #1a1a1c)',
            border: '1px solid var(--dsw-alias-border-l3, rgba(255,255,255,0.16))',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ fontSize: '14px', fontWeight: 600, display: 'flex', justifyContent: 'space-between', color: '#f0f0f2' }}>
              <span>添加任务卡片</span>
              <span style={{ cursor: 'pointer', color: '#666' }} onClick={() => setCreateModalCol(null)}>✕</span>
            </div>

            <input
              type="text"
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              placeholder="任务名称 (必填)..."
              style={{ background: '#151517', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 8px', color: '#fff', fontSize: '12.5px', outline: 'none' }}
            />

            <input
              type="text"
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              placeholder="要点或说明 (选填)..."
              style={{ background: '#151517', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 8px', color: '#fff', fontSize: '12px', outline: 'none' }}
            />

            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={formPriority}
                onChange={e => setFormPriority(e.target.value as any)}
                style={{ flex: 1, background: '#151517', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '5px', color: '#fff', fontSize: '12px' }}
              >
                <option value="P0">P0 (紧急必做)</option>
                <option value="P1">P1 (常规重要)</option>
                <option value="P2">P2 (延后计划)</option>
              </select>

              <input
                type="number"
                value={formMinutes}
                onChange={e => setFormMinutes(Math.max(1, Number(e.target.value) || 25))}
                placeholder="预计限时 (分)"
                style={{ width: '100px', background: '#151517', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '5px', color: '#fff', fontSize: '12px' }}
              />

              <input
                type="text"
                value={formTags}
                onChange={e => setFormTags(e.target.value)}
                placeholder="标签 (空格分隔)"
                style={{ flex: 1, background: '#151517', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '5px', color: '#fff', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
              <button onClick={() => setCreateModalCol(null)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #333', color: '#aaa', borderRadius: '4px', cursor: 'pointer' }}>取消</button>
              <button onClick={handleSaveTask} style={{ padding: '4px 14px', background: '#3b5bfd', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 标记失败原因弹窗 */}
      {failModalTask && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            width: '400px',
            background: 'var(--dsw-alias-bg-layer-1, #1a1a1c)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#ef4444' }}>
              任务流转至【失败 / 阻塞】
            </div>
            <div style={{ fontSize: '12px', color: '#aaa' }}>
              任务: {failModalTask.title}
            </div>
            <textarea
              value={failReason}
              onChange={e => setFailReason(e.target.value)}
              placeholder="请输入失分点、卡点或失败原因，方便后续针对性复盘..."
              rows={3}
              style={{ background: '#151517', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 8px', color: '#fff', fontSize: '12px', resize: 'none' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setFailModalTask(null)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #333', color: '#aaa', borderRadius: '4px', cursor: 'pointer' }}>取消</button>
              <button onClick={handleCommitFailed} style={{ padding: '4px 14px', background: '#ef4444', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>确认失败</button>
            </div>
          </div>
        </div>
      )}

      {/* 新增列弹窗 */}
      {showAddColModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            width: '320px',
            background: 'var(--dsw-alias-bg-layer-1, #1a1a1c)',
            border: '1px solid var(--dsw-alias-border-l3, rgba(255,255,255,0.16))',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#eee' }}>新增自定义看板列</div>
            <input
              type="text"
              value={newColTitle}
              onChange={e => setNewColTitle(e.target.value)}
              placeholder="输入列名称 (如: 复审中、暂存)..."
              style={{ background: '#151517', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 8px', color: '#fff', fontSize: '12px', outline: 'none' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setShowAddColModal(false)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #333', color: '#aaa', borderRadius: '4px', cursor: 'pointer' }}>取消</button>
              <button onClick={handleAddCustomColumn} style={{ padding: '4px 12px', background: '#3b5bfd', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>确定添加</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
