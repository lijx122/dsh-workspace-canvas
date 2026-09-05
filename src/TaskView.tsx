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
  note?: string
}

export interface Checkpoint {
  date: string
  criteria: string
  action: string
}

export interface DailyExecutionHistory {
  date: string // YYYY-MM-DD
  dayOfWeek: string // 1-7
  items: PlanItem[]
  reflection?: string
}

export interface GongkaoPlanData {
  profile: {
    target: string
    stage: string
    currentWeek: string
    examDate: string // YYYY-MM-DD
    coreRule: string
  }
  lastActiveDate: string // YYYY-MM-DD，用于每日跨天自动归档与进度清空
  weeklySchedule: Record<string, PlanItem[]>
  checkpoints: Checkpoint[]
  history?: DailyExecutionHistory[]
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
  onSave,
  onSendToAi
}: {
  workspaceId: string
  cwd: string
  initialData: any
  onSave: (data: any) => Promise<void>
  onSendToAi?: (prompt: string) => void
}) {
  const todayStr = getTodayDateString()
  const todayWeekDay = getTodayDayOfWeek()

  // 跨天自动归档与清空机制
  const processDayRollover = (raw: any): GongkaoPlanData | null => {
    if (!raw || !raw.weeklySchedule) return null
    const plan = raw as GongkaoPlanData

    // 如果上次记录的日期不是今天，说明发生了跨天！
    if (plan.lastActiveDate && plan.lastActiveDate !== todayStr) {
      // 1. 将旧日期的作答情况存入 history 历史记录
      const lastDayWeek = String(new Date(plan.lastActiveDate).getDay() || 7)
      const lastDayItems = plan.weeklySchedule[lastDayWeek] || []
      const historyList = plan.history || []

      // 避免重复归档同一天
      if (!historyList.some(h => h.date === plan.lastActiveDate)) {
        historyList.unshift({
          date: plan.lastActiveDate,
          dayOfWeek: lastDayWeek,
          items: JSON.parse(JSON.stringify(lastDayItems))
        })
      }

      // 2. 清空所有星期的勾选状态，让今天焕然一新！
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
        history: historyList.slice(0, 30) // 保留最近30天历史
      }
    }

    if (!plan.lastActiveDate) {
      plan.lastActiveDate = todayStr
    }

    return plan
  }

  const [data, setData] = useState<GongkaoPlanData | null>(() => processDayRollover(initialData))

  // 计时器状态
  const [activeTimerTask, setActiveTimerTask] = useState<PlanItem | null>(null)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0)
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false)
  const [syncing, setSyncing] = useState<boolean>(false)

  // 快速复盘弹窗
  const [reviewModalTask, setReviewModalTask] = useState<PlanItem | null>(null)
  const [reviewScore, setReviewScore] = useState<string>('')
  const [reviewMissedWords, setReviewMissedWords] = useState<string>('')
  const [reviewNote, setReviewNote] = useState<string>('')

  // 首次拉取模板如果未初始化
  useEffect(() => {
    if (!data) {
      fetch('/api/workspace-canvas/templates')
        .then(res => res.json())
        .then(res => {
          if (res.ok && res.templates?.length) {
            const defaultTpl = res.templates.find((t: any) => t.id === 'template-task-shenlun') || res.templates[0]
            if (defaultTpl) {
              const initialized = processDayRollover(defaultTpl.data)
              setData(initialized)
              if (initialized) onSave(initialized)
            }
          }
        })
        .catch(console.error)
    }
  }, [data])

  // 倒计时逻辑
  useEffect(() => {
    let timer: any = null
    if (isTimerRunning && secondsRemaining > 0) {
      timer = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            setIsTimerRunning(false)
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

  // 计时结束自动勾选完成
  const handleAutoFinish = (taskId: string, targetMin: number) => {
    updateDaySchedule(items =>
      items.map(it => (it.id === taskId ? { ...it, done: true, actualMinutes: targetMin } : it))
    )
  }

  // 启动计时
  const handleStartTaskTimer = (task: PlanItem) => {
    if (activeTimerTask?.id === task.id && isTimerRunning) {
      setIsTimerRunning(false)
      return
    }
    setActiveTimerTask(task)
    setSecondsRemaining(task.targetMinutes * 60)
    setIsTimerRunning(true)
  }

  // 提前交卷
  const handleFinishTimerEarly = () => {
    if (!activeTimerTask) return
    const elapsedSec = activeTimerTask.targetMinutes * 60 - secondsRemaining
    const actualMin = Math.max(1, Math.round(elapsedSec / 60))
    updateDaySchedule(items =>
      items.map(it => (it.id === activeTimerTask.id ? { ...it, done: true, actualMinutes: actualMin } : it))
    )
    setIsTimerRunning(false)
    setActiveTimerTask(null)
    setSecondsRemaining(0)
  }

  // 更新今日计划列表
  const updateDaySchedule = async (updater: (items: PlanItem[]) => PlanItem[]) => {
    if (!data) return
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

  const handleToggleDone = (taskId: string, done: boolean) => {
    updateDaySchedule(items => items.map(it => (it.id === taskId ? { ...it, done } : it)))
  }

  // 格式化时间
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // 生成结构化 AI 诊断提问并填入底部会话框
  const handleDispatchReviewToAi = () => {
    if (!reviewModalTask) return

    const actualTime = reviewModalTask.actualMinutes || reviewModalTask.targetMinutes
    const timeStatus = actualTime <= reviewModalTask.targetMinutes ? `正常限时内完成 (限时${reviewModalTask.targetMinutes}m/实耗${actualTime}m)` : `超时完成 (限时${reviewModalTask.targetMinutes}m/实耗${actualTime}m)`;

    const prompt = [
      `【${todayStr} 公考作答复盘与诊断请求】`,
      `科目模块：${reviewModalTask.module}`,
      `作答题目/计划项：${reviewModalTask.title}`,
      `用时情况：${timeStatus}`,
      reviewScore ? `自我预估得分/正确率：${reviewScore}` : '',
      reviewMissedWords ? `听课/对答案对照漏掉的核心采分词：${reviewMissedWords}` : '',
      reviewNote ? `作答卡点与思维盲区：${reviewNote}` : '',
      `----------------------------------------`,
      `请考公指导私教结合我的画像（申论容易强行套分类漏词、资料分析需提速），针对上述作答情况给出：`,
      `1. 该题失分/超时的核心认知偏差（为什么当时没有想到材料原词/快速算法？）`,
      `2. 下次面对同类题目的 30 秒机械性破题动作清单`,
      `3. 这道题是否需要加入周六的「错题二刷斩杀清单」？`
    ].filter(Boolean).join('\n')

    // 更新到卡片 note 记录
    updateDaySchedule(items =>
      items.map(it => (it.id === reviewModalTask.id ? {
        ...it,
        note: `自测: ${reviewScore || '已对答案'} · 漏词: ${reviewMissedWords || '无'} · 反思: ${reviewNote || '正常'}`
      } : it))
    )

    // 调用全局 DSH 注入的发送通道
    if (onSendToAi) {
      onSendToAi(prompt)
    } else {
      // 备用：若未桥接则复制到剪贴板并提示
      navigator.clipboard?.writeText(prompt)
      alert('✨ 复盘诊断提问已复制到剪贴板！可直接粘贴到底部输入框发送给 AI。')
    }

    setReviewModalTask(null)
    setReviewScore('')
    setReviewMissedWords('')
    setReviewNote('')
  }

  if (!data) {
    return (
      <div style={{ display: 'grid', placeContent: 'center', height: '100%', color: '#94a3b8' }}>
        正在初始化公考备战计划看板...
      </div>
    )
  }

  // 纯粹只展示今日作息安排
  const todayTasks = data.weeklySchedule[todayWeekDay] || []
  const completedCount = todayTasks.filter(t => t.done).length
  const totalCount = todayTasks.length
  const dayProgressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const daysLeft = calculateDaysLeft(data.profile.examDate || '2026-11-28')

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
      {/* 顶部目标与今日战斗横幅 */}
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
          <span style={{ fontSize: '12.5px', fontWeight: 600 }}>{data.profile.target}</span>
          <span style={{ fontSize: '11.5px', color: '#eab308', marginLeft: '6px' }}>
            ⚡ 铁律：{data.profile.coreRule}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', color: 'var(--dsw-alias-label-tertiary, #686872)' }}>
            {syncing ? '同步中...' : '每日自动归档清空'}
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

      {/* 专注作答与计时器横幅 */}
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
              {activeTimerTask ? `今日正在限时执行 · ${activeTimerTask.module}` : '点击下方任意任务项旁的 [⏱ 开始专注] 载入倒计时'}
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

      {/* 今日进度提示条 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, padding: '2px 4px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f2' }}>
          今日固定执行计划 (P1 作息表)
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--dsw-alias-label-secondary, #a0a0a8)' }}>
          <span>今日进度:</span>
          <div style={{ width: '100px', height: '5px', background: 'var(--dsw-alias-bg-layer-3, #2a2a2e)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${dayProgressPct}%`, background: '#10b981', transition: 'width 200ms' }} />
          </div>
          <span style={{ fontWeight: 600, color: '#10b981' }}>{completedCount} / {totalCount} ({dayProgressPct}%)</span>
        </div>
      </div>

      {/* 今日固定计划执行列表 */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        flex: 1,
        minHeight: 0,
        overflowY: 'auto'
      }}>
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
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
                  {item.note && (
                    <span style={{ fontSize: '11px', color: '#60a5fa' }}>
                      📝 {item.note}
                    </span>
                  )}
                </div>

                {item.resource && (
                  <span style={{ fontSize: '11px', color: 'var(--dsw-alias-label-tertiary, #686872)', whiteSpace: 'nowrap', marginLeft: 'auto' }}>
                    🔗 {item.resource}
                  </span>
                )}
              </div>

              {/* 右侧限时目标、计时与向AI复盘按钮 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                {item.done ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                      ✔ 已完成 {item.actualMinutes ? `(${item.actualMinutes}m)` : ''}
                    </span>

                    {/* 向 AI 发起复盘交互 */}
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
                      title="向下方 Agent 发送本题的作答效果诊断与复盘请求"
                    >
                      ✨ 反思复盘
                    </button>
                  </div>
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

      {/* 关键检查点提示栏 */}
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
        <span style={{ fontWeight: 700, color: 'var(--dsw-alias-label-secondary, #a0a0a8)' }}>关键节点:</span>
        {data.checkpoints.map((cp, idx) => (
          <span key={idx}>
            <b style={{ color: '#94a3b8' }}>{cp.date}</b>: {cp.criteria}
          </span>
        ))}
      </div>

      {/* 智能复盘诊断弹窗：把作答效果结构化沉淀并推送给 AI */}
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
            width: '440px',
            background: 'var(--dsw-alias-bg-layer-1, #1a1a1c)',
            border: '1px solid var(--dsw-alias-border-l3, rgba(255,255,255,0.16))',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ fontSize: '14px', fontWeight: 600, display: 'flex', justifyContent: 'space-between', color: '#f0f0f2' }}>
              <span>向 AI 发送本题作答复盘</span>
              <span style={{ cursor: 'pointer', color: 'var(--dsw-alias-label-tertiary)' }} onClick={() => setReviewModalTask(null)}>✕</span>
            </div>

            <div style={{ fontSize: '12px', color: '#38bdf8', padding: '6px 8px', background: 'rgba(56, 189, 248, 0.08)', borderRadius: '4px' }}>
              题目: {reviewModalTask.title} (实际耗时: {reviewModalTask.actualMinutes || reviewModalTask.targetMinutes} 分钟)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11.5px', color: 'var(--dsw-alias-label-secondary)' }}>预估得分 / 正确率 (如: 14/20 或 85%):</label>
              <input
                type="text"
                value={reviewScore}
                onChange={e => setReviewScore(e.target.value)}
                placeholder="例如: 15/20分，或 4/5题"
                style={{
                  background: 'var(--dsw-alias-bg-base, #151517)',
                  border: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1))',
                  borderRadius: '5px',
                  padding: '6px 8px',
                  color: '#fff',
                  fontSize: '12.5px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11.5px', color: 'var(--dsw-alias-label-secondary)' }}>听课对照漏掉的采分词 / 关键失分点:</label>
              <input
                type="text"
                value={reviewMissedWords}
                onChange={e => setReviewMissedWords(e.target.value)}
                placeholder="例如: 漏掉了'情理融合'、'刚柔并济'采分词"
                style={{
                  background: 'var(--dsw-alias-bg-base, #151517)',
                  border: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1))',
                  borderRadius: '5px',
                  padding: '6px 8px',
                  color: '#fff',
                  fontSize: '12.5px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11.5px', color: 'var(--dsw-alias-label-secondary)' }}>个人思考盲区或作答卡点:</label>
              <textarea
                value={reviewNote}
                onChange={e => setReviewNote(e.target.value)}
                placeholder="例如: 读材料时没有看出第三段的对策映射，花了太多时间在强行分类小标题上..."
                rows={3}
                style={{
                  background: 'var(--dsw-alias-bg-base, #151517)',
                  border: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1))',
                  borderRadius: '5px',
                  padding: '6px 8px',
                  color: '#fff',
                  fontSize: '12px',
                  outline: 'none',
                  resize: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
              <button
                onClick={() => setReviewModalTask(null)}
                style={{
                  padding: '5px 12px',
                  background: 'transparent',
                  border: '1px solid var(--dsw-alias-border-l2)',
                  color: 'var(--dsw-alias-label-secondary)',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                取消
              </button>
              <button
                onClick={handleDispatchReviewToAi}
                style={{
                  padding: '5px 14px',
                  background: 'var(--dsw-alias-button-info-fill)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                推送给 AI 复盘 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
