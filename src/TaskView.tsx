import React, { useEffect, useState, useRef } from 'react'

export interface PlanItem {
  id: string
  timeSlot: string
  module: string
  title: string
  targetMinutes: number
  done: boolean
  resource?: string
  actualMinutes?: number
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
    daysLeft: number
    coreRule: string
  }
  weeklySchedule: Record<string, PlanItem[]>
  checkpoints: Checkpoint[]
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

export function TaskView({
  workspaceId,
  cwd,
  initialData,
  onSave
}: {
  workspaceId: string
  cwd: string
  initialData: any
  onSave: (data: any) => Promise<void>
}) {
  const normalizeData = (raw: any): GongkaoPlanData | null => {
    if (!raw) return null
    if (raw.weeklySchedule) return raw as GongkaoPlanData
    return null
  }

  const [data, setData] = useState<GongkaoPlanData | null>(() => normalizeData(initialData))
  const [activeDay, setActiveDay] = useState<string>(() => {
    const d = new Date().getDay()
    return d === 0 ? '7' : String(d)
  })

  // 计时器状态
  const [activeTimerTask, setActiveTimerTask] = useState<PlanItem | null>(null)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0)
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false)
  const [syncing, setSyncing] = useState<boolean>(false)

  // 首次拉取模板如果未初始化
  useEffect(() => {
    if (!data) {
      fetch('/api/workspace-canvas/templates')
        .then(res => res.json())
        .then(res => {
          if (res.ok && res.templates?.length) {
            const defaultTpl = res.templates.find((t: any) => t.id === 'template-task-shenlun') || res.templates[0]
            if (defaultTpl) setData(defaultTpl.data)
          }
        })
        .catch(console.error)
    }
  }, [data])

  // 倒计时心跳
  useEffect(() => {
    let timer: any = null
    if (isTimerRunning && secondsRemaining > 0) {
      timer = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            setIsTimerRunning(false)
            // 计时结束：自动标记完成！
            if (activeTimerTask) {
              handleAutoFinish(activeTimerTask.id, activeTimerTask.targetMinutes)
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [isTimerRunning, secondsRemaining, activeTimerTask])

  // 自动完成
  const handleAutoFinish = (taskId: string, targetMin: number) => {
    updateDaySchedule(items =>
      items.map(it => (it.id === taskId ? { ...it, done: true, actualMinutes: targetMin } : it))
    )
    alert(`🎉 恭喜！任务 [${activeTimerTask?.title}] 限时完成，已自动勾选！`)
  }

  // 启动某任务计时
  const handleStartTaskTimer = (task: PlanItem) => {
    if (activeTimerTask?.id === task.id && isTimerRunning) {
      setIsTimerRunning(false)
      return
    }
    setActiveTimerTask(task)
    setSecondsRemaining(task.targetMinutes * 60)
    setIsTimerRunning(true)
  }

  // 手动结束/提前交卷
  const handleFinishTimerEarly = () => {
    if (!activeTimerTask) return
    const elapsedSec = (activeTimerTask.targetMinutes * 60) - secondsRemaining
    const actualMin = Math.max(1, Math.round(elapsedSec / 60))
    updateDaySchedule(items =>
      items.map(it => (it.id === activeTimerTask.id ? { ...it, done: true, actualMinutes: actualMin } : it))
    )
    setIsTimerRunning(false)
    setActiveTimerTask(null)
    setSecondsRemaining(0)
  }

  // 更新当前星期几的计划
  const updateDaySchedule = async (updater: (items: PlanItem[]) => PlanItem[]) => {
    if (!data) return
    const currentList = data.weeklySchedule[activeDay] || []
    const updatedList = updater(currentList)
    const nextData: GongkaoPlanData = {
      ...data,
      weeklySchedule: {
        ...data.weeklySchedule,
        [activeDay]: updatedList
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

  // 单独勾选切换
  const handleToggleDone = (taskId: string, done: boolean) => {
    updateDaySchedule(items =>
      items.map(it => (it.id === taskId ? { ...it, done } : it))
    )
  }

  // 格式化秒数为 MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  if (!data) {
    return (
      <div style={{ display: 'grid', placeContent: 'center', height: '100%', color: '#94a3b8' }}>
        正在初始化公考备战计划看板...
      </div>
    )
  }

  const dayTasks = data.weeklySchedule[activeDay] || []
  const completedCount = dayTasks.filter(t => t.done).length
  const totalCount = dayTasks.length
  const dayProgressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

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
      {/* 顶部目标与铁律横幅 */}
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
            {data.profile.stage}
          </span>
          <span style={{ fontSize: '12.5px', fontWeight: 600 }}>{data.profile.target}</span>
          <span style={{ fontSize: '11.5px', color: '#eab308', marginLeft: '6px' }}>
            ⚡ 铁律：{data.profile.coreRule}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', color: 'var(--dsw-alias-label-tertiary, #686872)' }}>
            {syncing ? '同步 tasks.json...' : '已同步计划'}
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
            距笔试约 68 天
          </span>
        </div>
      </div>

      {/* 专属作答/背诵限时计时器 (核心交互：点击任务开始计时，结束自动勾选完成) */}
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
              {activeTimerTask ? `正在专注限时执行 · ${activeTimerTask.module}` : '点击下方任意任务项旁的 [⏱ 开始专注] 载入计时'}
            </div>
            <div style={{ fontSize: '13.5px', fontWeight: 600, color: activeTimerTask ? '#60a5fa' : '#f0f0f2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeTimerTask ? activeTimerTask.title : '未启动计时器（计时结束后将自动标记该项完成）'}
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

      {/* 周一至周日固定计划切换 Tab */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, marginTop: '2px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {Object.entries(WEEK_NAMES).map(([key, label]) => {
            const isCur = key === activeDay
            const countDone = (data.weeklySchedule[key] || []).filter(t => t.done).length
            const countAll = (data.weeklySchedule[key] || []).length
            return (
              <button
                key={key}
                onClick={() => setActiveDay(key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '28px',
                  padding: '0 12px',
                  fontSize: '12px',
                  fontWeight: isCur ? 700 : 500,
                  color: isCur ? '#f0f0f2' : 'var(--dsw-alias-label-secondary, #a0a0a8)',
                  background: isCur ? 'var(--dsw-alias-bg-layer-2, #212124)' : 'transparent',
                  border: `1px solid ${isCur ? 'var(--dsw-alias-border-l3, rgba(255,255,255,0.16))' : 'transparent'}`,
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                <span>{label}</span>
                {countAll > 0 && (
                  <span style={{ fontSize: '10.5px', color: countDone === countAll ? '#10b981' : 'var(--dsw-alias-label-tertiary, #686872)' }}>
                    {countDone}/{countAll}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--dsw-alias-label-secondary, #a0a0a8)' }}>
          <span>今日进度:</span>
          <div style={{ width: '80px', height: '5px', background: 'var(--dsw-alias-bg-layer-3, #2a2a2e)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${dayProgressPct}%`, background: '#10b981', transition: 'width 200ms' }} />
          </div>
          <span style={{ fontWeight: 600, color: '#10b981' }}>{completedCount} / {totalCount} ({dayProgressPct}%)</span>
        </div>
      </div>

      {/* 固定计划清单执行列表 (单行紧凑，完成一项勾选一项) */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        flex: 1,
        minHeight: 0,
        overflowY: 'auto'
      }}>
        {dayTasks.map(item => {
          const isItemActiveTimer = activeTimerTask?.id === item.id
          return (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 12px',
                background: item.done ? 'rgba(255, 255, 255, 0.02)' : isItemActiveTimer ? 'rgba(59, 130, 246, 0.08)' : 'var(--dsw-alias-bg-layer-1, #1a1a1c)',
                border: `1px solid ${isItemActiveTimer ? 'var(--dsw-alias-brand-primary, #4d6bfe)' : item.done ? 'var(--dsw-alias-border-l1, rgba(255,255,255,0.04))' : 'var(--dsw-alias-border-l2, rgba(255,255,255,0.08))'}`,
                borderRadius: '6px',
                gap: '12px',
                transition: 'all 120ms ease'
              }}
            >
              {/* 左侧勾选与标题 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={e => handleToggleDone(item.id, e.target.checked)}
                  style={{ width: '15px', height: '15px', accentColor: '#10b981', cursor: 'pointer' }}
                />

                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: item.module.includes('申论') ? '#a78bfa' : item.module.includes('资料') ? '#38bdf8' : item.module.includes('数量') ? '#fbbf24' : '#94a3b8',
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  whiteSpace: 'nowrap'
                }}>
                  {item.timeSlot} · {item.module}
                </span>

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
                  <span style={{ fontSize: '11px', color: 'var(--dsw-alias-label-tertiary, #686872)', whiteSpace: 'nowrap' }}>
                    🔗 {item.resource}
                  </span>
                )}
              </div>

              {/* 右侧限时目标与计时交互 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                {item.done ? (
                  <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                    ✔ 已完成 {item.actualMinutes ? `(用时 ${item.actualMinutes}m)` : ''}
                  </span>
                ) : (
                  <>
                    <span style={{ fontSize: '11.5px', color: 'var(--dsw-alias-label-secondary, #a0a0a8)' }}>
                      限时 {item.targetMinutes} 分钟
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

      {/* 底部三个关键战略检查点提示 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '6px 12px',
        background: 'rgba(255, 255, 255, 0.02)',
        borderTop: '1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.06))',
        fontSize: '11px',
        color: 'var(--dsw-alias-label-tertiary, #686872)',
        flexShrink: 0
      }}>
        <span style={{ fontWeight: 700, color: 'var(--dsw-alias-label-secondary, #a0a0a8)' }}>关键检查点:</span>
        {data.checkpoints.map((cp, idx) => (
          <span key={idx}>
            <b style={{ color: '#94a3b8' }}>{cp.date}</b>: {cp.criteria}
          </span>
        ))}
      </div>
    </div>
  )
}
