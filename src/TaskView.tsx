import React, { useEffect, useState, useRef } from 'react'

export interface PlanItem {
  id: string
  timeSlot?: string
  module?: string
  title: string
  targetMinutes?: number
  done: boolean
  resource?: string
  actualMinutes?: number
  note?: string
}

export interface KanbanColumn {
  id: string
  title: string
}

export interface KanbanTaskItem {
  id: string
  columnId: string
  title: string
  desc?: string
  priority: 'P0' | 'P1' | 'P2'
  tags?: string[]
  source?: 'ai' | 'manual'
  createdAt?: string
}

export interface GenericKanbanData {
  plan: {
    target: string
    currentStage?: string
    focusTaskId?: string
  }
  columns: KanbanColumn[]
  tasks: KanbanTaskItem[]
}

export interface Checkpoint {
  date: string
  criteria: string
  action: string
}

export interface GongkaoPlanData {
  profile: {
    target: string
    stage: string
    currentWeek: string
    examDate: string
    coreRule: string
  }
  lastActiveDate: string
  weeklySchedule: Record<string, PlanItem[]>
  checkpoints: Checkpoint[]
  history?: Array<{
    date: string
    dayOfWeek: string
    items: PlanItem[]
  }>
}

const WEEK_NAMES: Record<string, string> = {
  '1': '周一',
  '2': '周二',
  '3': '周三',
  '4': '周四',
  '5': '周五',
  '6': '周六',
  '7': '周日'
}

function getTodayDateString(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getTodayDayOfWeek(): string {
  const d = new Date().getDay()
  return d === 0 ? '7' : String(d)
}

function calculateDaysLeft(targetDateStr: string): number {
  try {
    const target = new Date(targetDateStr).getTime()
    const now = new Date().getTime()
    const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24))
    return Math.max(0, diff)
  } catch {
    return 68
  }
}

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
  const todayStr = getTodayDateString()
  const todayWeekDay = getTodayDayOfWeek()

  // 跨天检测（专用于公考打卡计划）
  const processDayRollover = (plan: GongkaoPlanData): GongkaoPlanData => {
    if (plan.lastActiveDate && plan.lastActiveDate !== todayStr) {
      const lastDayWeek = String(new Date(plan.lastActiveDate).getDay() || 7)
      const lastDayItems = plan.weeklySchedule[lastDayWeek] || []
      const historyList = plan.history || []

      if (!historyList.some(h => h.date === plan.lastActiveDate)) {
        historyList.unshift({
          date: plan.lastActiveDate,
          dayOfWeek: lastDayWeek,
          items: JSON.parse(JSON.stringify(lastDayItems))
        })
      }

      const resetSchedule: Record<string, PlanItem[]> = {}
      for (const [dayKey, items] of Object.entries(plan.weeklySchedule)) {
        resetSchedule[dayKey] = items.map(it => ({
          ...it,
          done: false,
          actualMinutes: undefined,
          note: undefined
        }))
      }

      return {
        ...plan,
        lastActiveDate: todayStr,
        weeklySchedule: resetSchedule,
        history: historyList.slice(0, 30)
      }
    }

    if (!plan.lastActiveDate) {
      plan.lastActiveDate = todayStr
    }

    return plan
  }

  // 响应父级传入的 initialData
  const [data, setData] = useState<any>(() => {
    if (initialData?.weeklySchedule) {
      return processDayRollover(initialData as GongkaoPlanData)
    }
    return initialData || null
  })

  useEffect(() => {
    if (initialData?.weeklySchedule) {
      setData(processDayRollover(initialData as GongkaoPlanData))
    } else {
      setData(initialData || null)
    }
  }, [initialData])

  const [templates, setTemplates] = useState<any[]>([])
  const [syncing, setSyncing] = useState<boolean>(false)

  // 计时器状态
  const [activeTimerTask, setActiveTimerTask] = useState<any | null>(null)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0)
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false)

  // 快速复盘弹窗
  const [reviewModalTask, setReviewModalTask] = useState<any | null>(null)
  const [reviewScore, setReviewScore] = useState<string>('')
  const [reviewMissedWords, setReviewMissedWords] = useState<string>('')
  const [reviewNote, setReviewNote] = useState<string>('')

  // 仅在无数据时拉取模板供用户自主选择初始化
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

  // 应用模板初始化此工作区
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
        if (result.tasksData?.weeklySchedule) {
          setData(processDayRollover(result.tasksData))
        } else {
          setData(result.tasksData)
        }
        if (onReloadStatus) await onReloadStatus()
      }
    } finally {
      setSyncing(false)
    }
  }

  // 倒计时心跳
  useEffect(() => {
    let timer: any = null
    if (isTimerRunning && secondsRemaining > 0) {
      timer = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            setIsTimerRunning(false)
            if (activeTimerTask) {
              handleAutoFinish(activeTimerTask.id, activeTimerTask.targetMinutes || 25)
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [isTimerRunning, secondsRemaining, activeTimerTask])

  const handleAutoFinish = (taskId: string, targetMin: number) => {
    if (data?.weeklySchedule) {
      updateDaySchedule(items =>
        items.map(it => (it.id === taskId ? { ...it, done: true, actualMinutes: targetMin } : it))
      )
    } else if (data?.tasks) {
      updateKanbanData(prev => ({
        ...prev,
        tasks: prev.tasks.map((t: any) => (t.id === taskId ? { ...t, columnId: 'done' } : t))
      }))
    }
  }

  const handleStartTaskTimer = (task: any) => {
    if (activeTimerTask?.id === task.id && isTimerRunning) {
      setIsTimerRunning(false)
      return
    }
    const mins = task.targetMinutes || 25
    setActiveTimerTask(task)
    setSecondsRemaining(mins * 60)
    setIsTimerRunning(true)
  }

  const handleFinishTimerEarly = () => {
    if (!activeTimerTask) return
    const targetMin = activeTimerTask.targetMinutes || 25
    const elapsedSec = targetMin * 60 - secondsRemaining
    const actualMin = Math.max(1, Math.round(elapsedSec / 60))

    if (data?.weeklySchedule) {
      updateDaySchedule(items =>
        items.map(it => (it.id === activeTimerTask.id ? { ...it, done: true, actualMinutes: actualMin } : it))
      )
    } else if (data?.tasks) {
      updateKanbanData(prev => ({
        ...prev,
        tasks: prev.tasks.map((t: any) => (t.id === activeTimerTask.id ? { ...t, columnId: 'done' } : t))
      }))
    }

    setIsTimerRunning(false)
    setActiveTimerTask(null)
    setSecondsRemaining(0)
  }

  // 保存与更新
  const updateDaySchedule = async (updater: (items: PlanItem[]) => PlanItem[]) => {
    if (!data?.weeklySchedule) return
    const currentList = data.weeklySchedule[todayWeekDay] || []
    const updatedList = updater(currentList)
    const nextData: GongkaoPlanData = {
      ...data,
      lastActiveDate: todayStr,
      weeklySchedule: {
        ...data.weeklySchedule,
        [todayWeekDay]: updatedList
      }
    }
    setData(nextData)
    setSyncing(true)
    try {
      await onSave(nextData)
    } finally {
      setTimeout(() => setSyncing(false), 300)
    }
  }

  const updateKanbanData = async (updater: (prev: GenericKanbanData) => GenericKanbanData) => {
    if (!data?.columns) return
    const next = updater(data)
    setData(next)
    setSyncing(true)
    try {
      await onSave(next)
    } finally {
      setTimeout(() => setSyncing(false), 300)
    }
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const handleDispatchReviewToAi = () => {
    if (!reviewModalTask) return
    const actualTime = reviewModalTask.actualMinutes || reviewModalTask.targetMinutes || 25
    const prompt = [
      `【${todayStr} 作答复盘与诊断请求】`,
      `工作区路径：${cwd}`,
      `作答题目/项：${reviewModalTask.title}`,
      `用时情况：耗时 ${actualTime} 分钟`,
      reviewScore ? `自测得分/正确率：${reviewScore}` : '',
      reviewMissedWords ? `遗漏采分词/盲区：${reviewMissedWords}` : '',
      reviewNote ? `反思与卡点记录：${reviewNote}` : '',
      `----------------------------------------`,
      `请结合当前工作区任务与目标，给出 2 点关键提升建议及是否需要加入错题复盘。`
    ].filter(Boolean).join('\n')

    if (onSendToAi) {
      onSendToAi(prompt)
    } else {
      navigator.clipboard?.writeText(prompt)
      alert('✨ 复盘诊断提问已复制到剪贴板！')
    }

    setReviewModalTask(null)
    setReviewScore('')
    setReviewMissedWords('')
    setReviewNote('')
  }

  // 1. 无数据时：展示专属当前工作区的模板选用页，不硬编码默认数据
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', maxWidth: '620px', width: '100%' }}>
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
              <div style={{ fontSize: '13.5px', fontWeight: 600, marginBottom: '6px' }}>{tpl.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--dsw-alias-label-secondary, #a0a0a8)', lineHeight: 1.45 }}>{tpl.description}</div>
              <div style={{ marginTop: '12px', fontSize: '11.5px', color: 'var(--dsw-alias-brand-primary, #4d6bfe)', fontWeight: 600 }}>选用并生成 tasks.json →</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 2. 公考单日定时计划模式（当数据具有 weeklySchedule）
  if (data.weeklySchedule) {
    const gongkaoData = data as GongkaoPlanData
    const todayTasks = gongkaoData.weeklySchedule[todayWeekDay] || []
    const completedCount = todayTasks.filter(t => t.done).length
    const totalCount = todayTasks.length
    const dayProgressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
    const daysLeft = calculateDaysLeft(gongkaoData.profile.examDate || '2026-11-28')

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: 'var(--dsw-alias-bg-base, #151517)',
        padding: '12px 18px',
        gap: '10px',
        color: 'var(--dsw-alias-label-primary, #f0f0f2)',
        fontFamily: 'var(--dsw-font-family, sans-serif)',
        fontSize: '13px',
        userSelect: 'none',
        overflowY: 'auto'
      }}>
        {/* 顶部目标与今日横幅 */}
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
              {todayStr} · {WEEK_NAMES[todayWeekDay]}
            </span>
            <span style={{ fontSize: '12.5px', fontWeight: 600 }}>{gongkaoData.profile.target}</span>
            {gongkaoData.profile.coreRule && (
              <span style={{ fontSize: '11.5px', color: '#eab308', marginLeft: '6px' }}>
                ⚡ {gongkaoData.profile.coreRule}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <span style={{ fontSize: '11px', color: 'var(--dsw-alias-label-tertiary, #686872)' }}>
              {syncing ? '同步 tasks.json...' : '按当前工作区加载'}
            </span>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#ef4444',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              padding: '2px 8px',
              borderRadius: '12px'
            }}>
              距笔试约 {daysLeft} 天
            </span>
          </div>
        </div>

        {/* 专注计时器 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: activeTimerTask ? 'linear-gradient(135deg, #1c2333 0%, #151a24 100%)' : 'var(--dsw-alias-bg-layer-2, #212124)',
          border: `1px solid ${activeTimerTask ? 'var(--dsw-alias-brand-primary, #4d6bfe)' : 'var(--dsw-alias-border-l2, rgba(255,255,255,0.1))'}`,
          borderRadius: '8px',
          boxShadow: activeTimerTask ? '0 0 12px rgba(59, 130, 246, 0.25)' : 'none',
          transition: 'all 200ms ease',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <span style={{ fontSize: '18px' }}>⏱</span>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--dsw-alias-label-secondary, #a0a0a8)' }}>
                {activeTimerTask ? `限时专注中 · ${activeTimerTask.module || '专项'}` : '点击任意计划项旁的 [⏱ 开始专注] 载入计时'}
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: activeTimerTask ? '#60a5fa' : '#f0f0f2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeTimerTask ? activeTimerTask.title : '未启动计时器（倒计时结束后自动标记完成）'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
            {activeTimerTask && (
              <div style={{
                fontSize: '24px',
                fontFamily: 'ui-monospace, monospace',
                fontWeight: 700,
                color: secondsRemaining <= 300 ? '#ef4444' : '#38bdf8',
                letterSpacing: '1px'
              }}>
                {formatTime(secondsRemaining)}
              </div>
            )}

            {activeTimerTask && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setIsTimerRunning(prev => !prev)}
                  style={{
                    height: '28px',
                    padding: '0 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#fff',
                    background: isTimerRunning ? '#eab308' : 'var(--dsw-alias-button-info-fill, #3b5bfd)',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  {isTimerRunning ? '暂停' : '继续'}
                </button>
                <button
                  onClick={handleFinishTimerEarly}
                  style={{
                    height: '28px',
                    padding: '0 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#10b981',
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  提前交卷/完成 ✔
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 计划进度行 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, padding: '2px 4px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f2' }}>
            今日计划清单 (工作区: {cwd.split(/[\/\\]/).pop()})
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--dsw-alias-label-secondary, #a0a0a8)' }}>
            <span>今日进度:</span>
            <div style={{ width: '100px', height: '5px', background: 'var(--dsw-alias-bg-layer-3, #2a2a2e)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${dayProgressPct}%`, background: '#10b981', transition: 'width 200ms' }} />
            </div>
            <span style={{ fontWeight: 600, color: '#10b981' }}>{completedCount} / {totalCount} ({dayProgressPct}%)</span>
          </div>
        </div>

        {/* 计划清单 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {todayTasks.map(item => {
            const isItemActiveTimer = activeTimerTask?.id === item.id
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: item.done ? 'rgba(255, 255, 255, 0.02)' : isItemActiveTimer ? 'rgba(59, 130, 246, 0.08)' : 'var(--dsw-alias-bg-layer-1, #1a1a1c)',
                  border: `1px solid ${isItemActiveTimer ? 'var(--dsw-alias-brand-primary, #4d6bfe)' : item.done ? 'var(--dsw-alias-border-l1, rgba(255,255,255,0.04))' : 'var(--dsw-alias-border-l2, rgba(255,255,255,0.08))'}`,
                  borderRadius: '6px',
                  gap: '12px',
                  transition: 'all 120ms ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={e => {
                      updateDaySchedule(items => items.map(it => (it.id === item.id ? { ...it, done: e.target.checked } : it)))
                    }}
                    style={{ width: '15px', height: '15px', accentColor: '#10b981', cursor: 'pointer' }}
                  />

                  {item.timeSlot && (
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: item.module?.includes('申论') ? '#a78bfa' : item.module?.includes('资料') ? '#38bdf8' : '#94a3b8',
                      background: 'rgba(255, 255, 255, 0.05)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      whiteSpace: 'nowrap'
                    }}>
                      {item.timeSlot} {item.module ? `· ${item.module}` : ''}
                    </span>
                  )}

                  <span style={{
                    fontSize: '12.5px',
                    fontWeight: 500,
                    color: item.done ? 'var(--dsw-alias-label-secondary, #a0a0a8)' : 'var(--dsw-alias-label-primary, #f0f0f2)',
                    textDecoration: item.done ? 'line-through' : 'none',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {item.title}
                  </span>

                  {item.resource && (
                    <span style={{ fontSize: '11px', color: 'var(--dsw-alias-label-tertiary, #686872)', whiteSpace: 'nowrap', marginLeft: 'auto' }}>
                      🔗 {item.resource}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  {item.done ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                        ✔ 完成 {item.actualMinutes ? `(${item.actualMinutes}m)` : ''}
                      </span>
                      <button
                        onClick={() => setReviewModalTask(item)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          height: '24px',
                          padding: '0 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#a78bfa',
                          background: 'rgba(167, 139, 250, 0.12)',
                          border: '1px solid rgba(167, 139, 250, 0.3)',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        ✨ 反思复盘
                      </button>
                    </div>
                  ) : (
                    <>
                      <span style={{ fontSize: '11.5px', color: 'var(--dsw-alias-label-secondary, #a0a0a8)' }}>
                        {item.targetMinutes ? `限时 ${item.targetMinutes}m` : '待执行'}
                      </span>
                      <button
                        onClick={() => handleStartTaskTimer(item)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          height: '24px',
                          padding: '0 8px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          color: isItemActiveTimer ? '#eab308' : '#38bdf8',
                          background: isItemActiveTimer ? 'rgba(234, 179, 8, 0.12)' : 'rgba(56, 189, 248, 0.12)',
                          border: `1px solid ${isItemActiveTimer ? 'rgba(234, 179, 8, 0.3)' : 'rgba(56, 189, 248, 0.25)'}`,
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        {isItemActiveTimer && isTimerRunning ? '⏸ 计时中' : '⏱ 开始专注'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* 复盘弹窗 */}
        {reviewModalTask && (
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
                <span>向 AI 发送作答复盘</span>
                <span style={{ cursor: 'pointer', color: 'var(--dsw-alias-label-tertiary)' }} onClick={() => setReviewModalTask(null)}>✕</span>
              </div>
              <input
                type="text"
                value={reviewScore}
                onChange={e => setReviewScore(e.target.value)}
                placeholder="自测得分 / 正确率 (如: 15/20)"
                style={{ background: '#151517', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 8px', color: '#fff', fontSize: '12px' }}
              />
              <input
                type="text"
                value={reviewMissedWords}
                onChange={e => setReviewMissedWords(e.target.value)}
                placeholder="漏掉的采分词 / 失分点"
                style={{ background: '#151517', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 8px', color: '#fff', fontSize: '12px' }}
              />
              <textarea
                value={reviewNote}
                onChange={e => setReviewNote(e.target.value)}
                placeholder="作答卡点与反思记录..."
                rows={3}
                style={{ background: '#151517', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 8px', color: '#fff', fontSize: '12px', resize: 'none' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button onClick={() => setReviewModalTask(null)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #333', color: '#aaa', borderRadius: '4px', cursor: 'pointer' }}>取消</button>
                <button onClick={handleDispatchReviewToAi} style={{ padding: '4px 12px', background: '#3b5bfd', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>发送给 AI</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // 3. 通用四列看板模式（当 tasks.json 具有 columns 与 tasks）
  const kanbanData = data as GenericKanbanData
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: 'var(--dsw-alias-bg-base, #151517)',
      padding: '12px 18px',
      gap: '10px',
      color: 'var(--dsw-alias-label-primary, #f0f0f2)',
      fontFamily: 'var(--dsw-font-family, sans-serif)',
      fontSize: '13px',
      userSelect: 'none'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-1, #1a1a1c)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, background: 'rgba(59,130,246,0.15)', color: '#60a5fa', padding: '2px 6px', borderRadius: '4px' }}>
            通用看板
          </span>
          <span style={{ fontWeight: 600 }}>{kanbanData.plan?.target || '项目任务看板'}</span>
          <span style={{ fontSize: '11.5px', color: '#888' }}>({cwd})</span>
        </div>
        <span style={{ fontSize: '11px', color: '#666' }}>{syncing ? '同步中...' : '已加载工作区 tasks.json'}</span>
      </div>

      {/* 四列通用泳道 */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kanbanData.columns.length}, 1fr)`, gap: '10px', flex: 1, minHeight: 0 }}>
        {kanbanData.columns.map(col => {
          const colTasks = kanbanData.tasks.filter(t => t.columnId === col.id)
          return (
            <div key={col.id} style={{ display: 'flex', flexDirection: 'column', background: 'var(--dsw-alias-bg-layer-1, #1a1a1c)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '12.5px' }}>{col.title}</span>
                <span style={{ fontSize: '11px', color: '#888', background: 'rgba(255,255,255,0.05)', padding: '0 6px', borderRadius: '10px' }}>{colTasks.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px', overflowY: 'auto', flex: 1 }}>
                {colTasks.map(t => (
                  <div key={t.id} style={{ background: '#151517', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 500, fontSize: '12.5px', color: t.columnId === 'done' ? '#777' : '#eee', textDecoration: t.columnId === 'done' ? 'line-through' : 'none' }}>{t.title}</span>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: t.priority === 'P0' ? '#ef4444' : '#eab308' }}>{t.priority}</span>
                    </div>
                    {t.desc && <div style={{ fontSize: '11.5px', color: '#888' }}>{t.desc}</div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#555', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '4px' }}>
                      <span>{t.source === 'ai' ? '✨ AI' : '👤 人工'}</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {col.id !== 'todo' && <button onClick={() => updateKanbanData(prev => ({ ...prev, tasks: prev.tasks.map(it => it.id === t.id ? { ...it, columnId: 'todo' } : it) }))} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '10.5px' }}>待办</button>}
                        {col.id !== 'in_progress' && <button onClick={() => updateKanbanData(prev => ({ ...prev, tasks: prev.tasks.map(it => it.id === t.id ? { ...it, columnId: 'in_progress' } : it) }))} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '10.5px' }}>推进</button>}
                        {col.id !== 'done' && <button onClick={() => updateKanbanData(prev => ({ ...prev, tasks: prev.tasks.map(it => it.id === t.id ? { ...it, columnId: 'done' } : it) }))} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '10.5px' }}>完成</button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
