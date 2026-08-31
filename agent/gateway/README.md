# gateway

App 办公入口：`POST /api/office`，本机 `127.0.0.1:3081`。  
Caddy 把 `https://api.hispurring.com/api/office` 和 `/office-files/` 反代到这里。不要暴露 3080 / 3081 到安全组。

```json
{ "prompt": "写一页纳斯达克上市流程 PDF", "kind": "pdf" }
```

`kind` 为 `pdf` 或 `pptx`。成功返回 `{ ok, url, bytes, fileName }`。

密钥与 dsh 相同，读 `agent/runtime/spur-profile/.env` 的 `DEEPSEEK_*`。
