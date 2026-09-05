import React, { useEffect, useState, useRef } from 'react'

export interface TaskItem {
  id: string
  columnId: string
  title: string
  desc?: string
  priority: 'P0' | 'P1' | 'P2'
  tags?: string[]
  source?: 'ai' | 'manual'
  createdAt?: string
}

export interface TasksData {
  plan: {
    target: string
    currentStage: string
    focusTaskId?: string
  }
  columns: Array<{ id: string; title: string }>
  tasks: TaskItem[]
}

export function TaskView({
  workspaceId,
  cwd,
  initialData,
  onSave
}: {
  workspaceId: string
  cwd: string
  initialData: TasksData | null
  onSave: (data: TasksData) => Promise<void>
}) {
  const [data, setData] = useState<TasksData | null>(initialData)
  const [templates, setTemplates] = useState<any[]>([])
  const [syncing, setSyncing] = useState(false)
  const [modalCol, setModalCol] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPriority, setNewPriority] = useState<'P0' | 'P1' | 'P2'>('P1')
  const [newTags, setNewTags] = useState('')

  // 如果没有数据，拉取模板供用户首次选择
  useEffect(() => {
    if (!data) {
      fetch('/api/workspace-canvas/templates')
        .then(res => res.json())
        .then(res => {
          if (res.ok) setTemplates(res.templates)
        })
        .catch(console.error)
    }
  }, [data])

  // 应用模板
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
      }
    } finally {
      setSyncing(false)
    }
  }

  // 保存数据
  const updateData = async (updater: (prev: TasksData) => TasksData) => {
    if (!data) return
    const next = updater(data)
    setData(next)
    setSyncing(true)
    try {
      await onSave(next)
    } finally {
      setTimeout(() => setSyncing(false), 400)
    }
  }

  // 状态流转
  const handleMoveTask = (taskId: string, targetColId: string) => {
    updateData(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => (t.id === taskId ? { ...t, columnId: targetColId } : t))
    }))
  }

  // 勾选完成
  const handleToggleCheck = (taskId: string, currentDone: boolean) => {
    handleMoveTask(taskId, currentDone ? 'todo' : 'done')
  }

  // 创建任务
  const handleCreateTask = () => {
    if (!newTitle.trim() || !modalCol) return
    const tags = newTags.trim() ? newTags.split(/[,，\s]+/) : []
    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      columnId: modalCol,
      title: newTitle.trim(),
      desc: newDesc.trim() || undefined,
      priority: newPriority,
      tags: tags.length ? tags : undefined,
      source: 'manual',
      createdAt: new Date().toISOString()
    }
    updateData(prev => ({
      ...prev,
      tasks: [newTask, ...prev.tasks]
    }))
    setModalCol(null)
    setNewTitle('')
    setNewDesc('')
    setNewTags('')
  }

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
        gap: '20px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>初始化工作区任务看板</h2>
          <p style={{ fontSize: '13px', color: 'var(--dsw-alias-label-secondary, #a0a0a8)' }}>
            当前工作区尚未建立 tasks.json，请选择预置模板一键就绪
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', maxWidth: '640px', width: '100%' }}>
          {templates.map(tpl => (
            <div
              key={tpl.id}
              onClick={() => handleApplyTemplate(tpl.id)}
              style={{
                background: 'var(--dsw-alias-bg-layer-1, #1a1a1c)',
                border: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1))',
                borderRadius: '10px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'border-color 150ms ease, transform 150ms ease'
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--dsw-alias-brand-primary, #4d6bfe)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--dsw-alias-border-l2, rgba(255,255,255,0.1))')}
            >
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>{tpl.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--dsw-alias-label-secondary, #a0a0a8)', lineHeight: 1.45 }}>{tpl.description}</div>
              <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--dsw-alias-brand-primary, #4d6bfe)', fontWeight: 600 }}>点击选用此模板 →</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 指标统计
  const total = data.tasks.length
  const completed = data.tasks.filter(t => t.columnId === 'done').length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const focusTask = data.tasks.find(t => t.id === data.plan.focusTaskId)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: 'var(--dsw-alias-bg-base, #151517)',
      padding: '12px 16px',
      gap: '10px',
      userSelect: 'none',
      color: 'var(--dsw-alias-label-primary, #f0f0f2)',
      fontFamily: 'var(--dsw-font-family, sans-serif)',
      fontSize: '13px'
    }}>
      {/* 顶部状态与聚焦栏 */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '8px 12px',
        background: 'var(--dsw-alias-bg-layer-1, #1a1a1c)',
        border: '1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.06))',
        borderRadius: '8px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--dsw-alias-state-business-primary, #3b82f6)',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '4px',
            padding: '1px 6px',
            whiteSpace: 'nowrap'
          }}>
            {data.plan.currentStage}
          </span>
          <span style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {data.plan.target}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--dsw-alias-label-secondary, #a0a0a8)', flexShrink: 0 }}>
            <div style={{ width: '80px', height: '4px', background: 'var(--dsw-alias-bg-layer-3, #2a2a2e)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--dsw-alias-brand-primary, #4d6bfe)', borderRadius: '2px', transition: 'width 200ms' }} />
            </div>
            <span>{completed} / {total}</span>
          </div>
        </div>

        {focusTask && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            maxWidth: '380px',
            flex: 1,
            background: 'var(--dsw-alias-bg-layer-2, #212124)',
            border: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1))',
            borderRadius: '6px',
            padding: '3px 8px',
            minWidth: 0
          }}>
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--dsw-alias-state-warn-primary, #eab308)',
              background: 'rgba(234, 179, 8, 0.12)',
              padding: '1px 5px',
              borderRadius: '3px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}>
              今日聚焦
            </span>
            <span style={{ fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {focusTask.title}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--dsw-alias-label-tertiary, #686872)' }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: syncing ? 'var(--dsw-alias-brand-primary, #4d6bfe)' : 'var(--dsw-alias-state-success-primary, #10b981)'
            }} />
            <span>{syncing ? '同步中...' : '已同步 tasks.json'}</span>
          </div>

          <button
            onClick={() => setModalCol('todo')}
            style={{
              height: '26px',
              padding: '0 10px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#fff',
              background: 'var(--dsw-alias-button-info-fill, #3b5bfd)',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            + 任务
          </button>
        </div>
      </header>

      {/* 4 列任务泳道区 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${data.columns.length}, 1fr)`,
        gap: '10px',
        flex: 1,
        minHeight: 0
      }}>
        {data.columns.map(col => {
          const colTasks = data.tasks.filter(t => t.columnId === col.id)
          return (
            <div key={col.id} style={{
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--dsw-alias-bg-layer-1, #1a1a1c)',
              border: '1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.06))',
              borderRadius: '8px',
              minHeight: 0,
              overflow: 'hidden'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.06))',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background:
                      col.id === 'done' ? 'var(--dsw-alias-state-success-primary, #10b981)' :
                      col.id === 'in_progress' ? 'var(--dsw-alias-state-warn-primary, #eab308)' :
                      col.id === 'todo' ? 'var(--dsw-alias-state-business-primary, #3b82f6)' :
                      'var(--dsw-alias-label-tertiary, #686872)'
                  }} />
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
                <button
                  onClick={() => setModalCol(col.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--dsw-alias-label-tertiary, #686872)',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  +
                </button>
              </div>

              {/* 卡片列表 */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '8px',
                overflowY: 'auto',
                flex: 1,
                minHeight: 0
              }}>
                {colTasks.map(t => {
                  const isDone = t.columnId === 'done'
                  return (
                    <div key={t.id} style={{
                      background: 'var(--dsw-alias-bg-base, #151517)',
                      border: `1px solid ${t.id === data.plan.focusTaskId ? 'var(--dsw-alias-brand-primary, #4d6bfe)' : 'var(--dsw-alias-border-l2, rgba(255,255,255,0.1))'}`,
                      borderRadius: '7px',
                      padding: '9px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      opacity: isDone ? 0.6 : 1
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', flex: 1, minWidth: 0 }}>
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={() => handleToggleCheck(t.id, isDone)}
                            style={{ marginTop: '2px', cursor: 'pointer', accentColor: 'var(--dsw-alias-state-success-primary, #10b981)' }}
                          />
                          <span style={{
                            fontSize: '12.5px',
                            fontWeight: 500,
                            lineHeight: 1.4,
                            textDecoration: isDone ? 'line-through' : 'none',
                            color: isDone ? 'var(--dsw-alias-label-secondary, #a0a0a8)' : 'var(--dsw-alias-label-primary, #f0f0f2)'
                          }}>
                            {t.title}
                          </span>
                        </div>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          padding: '0 4px',
                          borderRadius: '3px',
                          flexShrink: 0,
                          color: t.priority === 'P0' ? 'var(--dsw-alias-state-error-primary, #ef4444)' : t.priority === 'P1' ? 'var(--dsw-alias-state-warn-primary, #eab308)' : 'var(--dsw-alias-label-secondary, #a0a0a8)',
                          background: t.priority === 'P0' ? 'rgba(239, 68, 68, 0.12)' : t.priority === 'P1' ? 'rgba(234, 179, 8, 0.12)' : 'rgba(255, 255, 255, 0.06)'
                        }}>
                          {t.priority}
                        </span>
                      </div>

                      {t.desc && (
                        <div style={{ fontSize: '11.5px', color: 'var(--dsw-alias-label-secondary, #a0a0a8)', marginLeft: '18px', lineHeight: 1.45 }}>
                          {t.desc}
                        </div>
                      )}

                      {t.tags && t.tags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginLeft: '18px' }}>
                          {t.tags.map(tag => (
                            <span key={tag} style={{
                              fontSize: '10px',
                              color: 'var(--dsw-alias-label-secondary, #a0a0a8)',
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

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '10.5px',
                        color: 'var(--dsw-alias-label-tertiary, #686872)',
                        paddingTop: '4px',
                        borderTop: '1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.06))',
                        marginLeft: '18px'
                      }}>
                        <span>{t.source === 'ai' ? '✨ AI' : '👤 人工'}</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {col.id !== 'todo' && <button onClick={() => handleMoveTask(t.id, 'todo')} style={{ background: 'transparent', border: 'none', color: 'var(--dsw-alias-label-secondary)', cursor: 'pointer', fontSize: '10.5px' }}>待办</button>}
                          {col.id !== 'in_progress' && <button onClick={() => handleMoveTask(t.id, 'in_progress')} style={{ background: 'transparent', border: 'none', color: 'var(--dsw-alias-label-secondary)', cursor: 'pointer', fontSize: '10.5px' }}>推进</button>}
                          {col.id !== 'done' && <button onClick={() => handleMoveTask(t.id, 'done')} style={{ background: 'transparent', border: 'none', color: 'var(--dsw-alias-label-secondary)', cursor: 'pointer', fontSize: '10.5px' }}>完成</button>}
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

      {/* 快速添加任务弹窗 */}
      {modalCol && (
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
            border: '1px solid var(--dsw-alias-border-l3, rgba(255,255,255,0.16))',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ fontSize: '14px', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
              <span>添加任务</span>
              <span style={{ cursor: 'pointer', color: 'var(--dsw-alias-label-tertiary)' }} onClick={() => setModalCol(null)}>✕</span>
            </div>

            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="任务名称..."
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

            <input
              type="text"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="要点或补充说明..."
              style={{
                background: 'var(--dsw-alias-bg-base, #151517)',
                border: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1))',
                borderRadius: '5px',
                padding: '6px 8px',
                color: '#fff',
                fontSize: '12px',
                outline: 'none'
              }}
            />

            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={newPriority}
                onChange={e => setNewPriority(e.target.value as any)}
                style={{
                  flex: 1,
                  background: 'var(--dsw-alias-bg-base, #151517)',
                  border: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1))',
                  borderRadius: '5px',
                  padding: '5px',
                  color: '#fff',
                  fontSize: '12px'
                }}
              >
                <option value="P0">P0 (最高)</option>
                <option value="P1">P1 (重要)</option>
                <option value="P2">P2 (普通)</option>
              </select>
              <input
                type="text"
                value={newTags}
                onChange={e => setNewTags(e.target.value)}
                placeholder="标签以空格分隔"
                style={{
                  flex: 2,
                  background: 'var(--dsw-alias-bg-base, #151517)',
                  border: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1))',
                  borderRadius: '5px',
                  padding: '5px 8px',
                  color: '#fff',
                  fontSize: '12px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
              <button
                onClick={() => setModalCol(null)}
                style={{
                  padding: '4px 10px',
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
                onClick={handleCreateTask}
                style={{
                  padding: '4px 12px',
                  background: 'var(--dsw-alias-button-info-fill)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
