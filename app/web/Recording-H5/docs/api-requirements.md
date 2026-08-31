# 录音戒指 H5 后端接口梳理

当前前端 mock 集中在 `src/mock/recordings.ts`，页面统一通过 `src/services/recordingService.ts` 取数。后续切真实接口时，建议保持下面的数据结构，前端只替换 service 层。

## MVP 建议接口数量

建议后端先提供 6 个核心接口：

1. `GET /api/recordings`：录音列表
2. `GET /api/recordings/{recordingId}`：录音详情与纪要
3. `GET /api/recordings/{recordingId}/transcript`：逐字稿
4. `GET /api/recordings/{recordingId}/audio-url`：音频播放地址
5. `POST /api/assistant/chat/stream`：AI 对话流式输出，建议 SSE
6. `GET /api/assistant/reminders`：智能体提醒卡片列表

可选接口：

- `GET /api/assistant/prompts`：AI 快捷问题配置。如果快捷词固定，也可以先前端配置。
- `GET /api/devices`、`POST /api/devices/bind`：如果 H5 要展示或绑定录音戒指设备，再补设备接口。

## 1. 录音列表

`GET /api/recordings`

用途：录音纪要首页，按日期分组展示录音卡片。

Query：

```txt
pageSize=20
cursor=xxx
dateFrom=2026-06-01
dateTo=2026-06-30
keyword=供应商
```

Response：

```json
{
  "groups": [
    {
      "key": "2026-06-24",
      "title": "今天 6月24日 周三",
      "records": [
        {
          "id": "rec_001",
          "title": "新录音06241130",
          "date": "06-24 11:30",
          "dayLabel": "今天 6月24日 周三",
          "duration": "00:22",
          "source": "APP",
          "location": "地址地址",
          "unread": true
        }
      ]
    }
  ],
  "nextCursor": null
}
```

## 2. 录音详情与纪要

`GET /api/recordings/{recordingId}`

用途：录音详情页，展示标题、元信息、标签、参会人、AI 纪要。

Response：

```json
{
  "id": "rec_001",
  "title": "新录音06241130",
  "date": "06-24 11:30",
  "dayLabel": "今天 6月24日 周三",
  "duration": "00:22",
  "source": "APP",
  "location": "地址地址",
  "tags": ["电容压感", "电容传感"],
  "speakers": [
    { "id": "sales", "name": "超哥", "role": "销售部", "color": "#ff6b35" }
  ],
  "summarySections": [
    {
      "title": "交流对象",
      "bullets": ["来自苏州的芯片方案供应商团队。"]
    }
  ]
}
```

## 3. 逐字稿

`GET /api/recordings/{recordingId}/transcript`

用途：逐字稿详情页，按说话人和时间段展示转写内容。

Response：

```json
{
  "segments": [
    {
      "id": "seg_001",
      "speakerId": "sales",
      "time": "00:00",
      "text": "OK，大家听一下，我们这次开会...",
      "highlight": null,
      "edited": false
    }
  ]
}
```

## 4. 音频播放地址

`GET /api/recordings/{recordingId}/audio-url`

用途：详情页和逐字稿页播放器。建议返回短时效 URL，避免直接暴露永久音频地址。

Response：

```json
{
  "audioUrl": "https://cdn.example.com/audio/rec_001.m4a?sign=xxx",
  "durationMs": 22000,
  "expiresAt": "2026-06-30T08:00:00Z",
  "waveform": [0.12, 0.42, 0.31]
}
```

## 5. AI 对话流式接口

建议用 SSE。因为对话会有生成过程，H5 上直接等完整 JSON 会显得卡。实现上有两种：

- 推荐：`POST /api/assistant/chat/stream`，请求体传上下文，响应 `text/event-stream`。前端用 `fetch + ReadableStream` 读取。
- 备选：`POST /api/assistant/chat` 创建任务，返回 `conversationId`，再用 `GET /api/assistant/chat/stream?conversationId=xxx` 接 `EventSource`。原生 `EventSource` 只支持 GET。

### Request

```http
POST /api/assistant/chat/stream
Content-Type: application/json
Accept: text/event-stream
```

```json
{
  "query": "整理3天的录音文件",
  "conversationId": "conv_001",
  "recordingIds": ["rec_001", "rec_002"],
  "dateRange": {
    "from": "2026-06-24",
    "to": "2026-06-26"
  },
  "scene": "recording_summary"
}
```

### SSE Response

Header：

```http
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

事件建议：

```txt
event: message_start
data: {"conversationId":"conv_001","messageId":"msg_001","role":"assistant"}

event: delta
data: {"messageId":"msg_001","text":"以下是为您整理的"}

event: delta
data: {"messageId":"msg_001","text":"三条录音文件："}

event: record_card
data: {"messageId":"msg_001","title":"录音0626","bullets":["内容内容内容","内容内容内容"]}

event: record_card
data: {"messageId":"msg_001","title":"录音0625","bullets":["内容内容内容"]}

event: done
data: {"messageId":"msg_001","finishReason":"stop"}
```

错误事件：

```txt
event: error
data: {"code":"MODEL_TIMEOUT","message":"生成超时，请稍后重试"}
```

前端最终会组装成：

```json
{
  "id": "msg_001",
  "role": "assistant",
  "text": "以下是为您整理的三条录音文件：",
  "relatedRecords": [
    {
      "title": "录音0626",
      "bullets": ["内容内容内容", "内容内容内容"]
    }
  ]
}
```

## 6. 智能体提醒列表

`GET /api/assistant/reminders`

用途：智能体页瀑布流提醒卡片。

Query：

```txt
dateFrom=2026-06-01
dateTo=2026-06-30
pageSize=20
cursor=xxx
```

Response：

```json
{
  "items": [
    {
      "id": "reminder_001",
      "title": "提醒提醒提醒提醒提醒",
      "bullets": ["内容内容内容内容", "内容内容内容内容"],
      "duration": "00:22",
      "date": "06-24 11:30",
      "location": "地址地址",
      "recordingId": "rec_001"
    }
  ],
  "nextCursor": null
}
```

## 状态码约定

- `200`：成功
- `400`：参数错误
- `401`：未登录或 token 失效
- `404`：资源不存在
- `429`：请求过快，尤其 AI 对话
- `500`：服务异常

错误响应：

```json
{
  "code": "INVALID_PARAMS",
  "message": "dateFrom 格式不正确"
}
```
