---
name: dsh-canvas-task
description: 操作与维护工作区 Task 动态流转看板数据 (tasks.json)。当用户要求安排任务、拆解任务、流转任务状态、标记失败阻塞、向人类交接求助或更新看板时触发。
---

# Task 动态看板操作技能 (dsh-canvas-task)

当前工作区启用了顶层动态 Task 协作看板，其单一真实数据源为工作区根目录下的 `./tasks.json`。

## 一、核心操作守则与边界
1. **单一真相源**：所有任务状态读取与持久化一律针对根目录 `./tasks.json`。
2. **人机协作双轨制**：
   - 任务责任归属 `assignee` 必须明确为 `'human'` 或 `'ai'`。
   - **人类任务 (`assignee: 'human'`)**：人类负责动笔、专注或线下执行，由人类打勾。
   - **AI 任务 (`assignee: 'ai'`)**：AI 独立负责执行，AI 完成后由 AI 将其移至 `done`。
3. **人机接力交接棒 (Human-in-the-Loop)**：
   - 当 AI 在长任务中遭遇**无法自主绕过的阻断**（如：滑块人机验证、微信扫码登录、短信验证码、关键意向裁决）时：
     - **严禁直接报错退出或空转等待超时**；
     - 必须将当前任务在 `tasks.json` 中标记为 `waiting_human`；
     - 必须写入 `waitingHumanAction`，明确告知人类需要在外部完成什么具体动作（例如：*"已调起微信扫码窗口，请在手机上确认登录后打勾"*）；
     - 当人类完成并在看板点击【✔ 我已处理】后，会话将收到恢复通知继续推进。
4. **失败必附原因**：当任务移入 `failed` 时，必须附带 `reason` 字段说明具体阻断点。

## 二、标准数据契约 (tasks.json Schema)
```json
{
  "version": "1.0.0",
  "type": "standard_5cols",
  "meta": {
    "title": "工作区核心任务看板",
    "updatedAt": "2026-09-06T10:00:00Z"
  },
  "columns": [
    { "id": "planned", "title": "待规划", "color": "#64748b" },
    { "id": "todo", "title": "待办", "color": "#38bdf8" },
    { "id": "in_progress", "title": "进行中", "color": "#eab308" },
    { "id": "done", "title": "完成", "color": "#10b981" },
    { "id": "failed", "title": "失败", "color": "#ef4444" }
  ],
  "tasks": [
    {
      "id": "task-1725538000000",
      "columnId": "in_progress",
      "title": "任务名称",
      "desc": "详细要点或交付标准",
      "assignee": "ai",
      "priority": "P0",
      "targetMinutes": 30,
      "tags": ["核心模块"],
      "claimedSessionId": "session-xxxx",
      "waitingHumanAction": "仅当遇阻需要人类干预时填写具体说明，解除时置为 undefined",
      "reason": "仅当 columnId 为 failed 时必填",
      "source": "ai",
      "createdAt": "2026-09-06T10:00:00Z"
    }
  ]
}
```

## 三、常用场景动作指引

### 1. 任务拆解与派发
- 当用户要求拆解大目标时，将其拆分为清晰可执行的小卡片，赋予唯一的 `task-${Date.now()}-${idx}`；
- 区分哪些需要人类亲自做（`assignee: 'human'`），哪些交给 AI 完成（`assignee: 'ai'`）；
- 更新 `./tasks.json` 后，简明回复 1~2 句话告知人类已同步至看板。

### 2. 遭遇人工验证阻断（呼叫人类接力）
- 若遇到验证码/扫码等硬性卡点：
  1. 调用 `edit` 或 `write` 将目标任务属性变更为：
     `"columnId": "in_progress"`
     `"waitingHumanAction": "请在弹出的登录界面扫码完成微信授权验证"`
  2. 简短向用户发出提示，并等待人类在看板点击【我已处理】后的唤醒通知。

### 3. 收到人类唤醒通知后恢复执行
- 当会话收到人类已经处理好的通知：
  1. 清理 `waitingHumanAction`；
  2. 验证环境是否已就绪（如扫码凭据已落地）；
  3. 继续往下执行后续步骤，并在全部跑通后将任务流转至 `done`。
