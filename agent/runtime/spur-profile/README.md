# spur-profile

Harness 挂载面：不改上游 `deepseek-harness/` 源码。

- `cordis.patch.yml` — 硅基流动走 `llm-pi-ai`（OpenAI 兼容），默认 `deepseek-ai/DeepSeek-V3`
- `.env.example` — 与 `audio-agent` 相同的 `DEEPSEEK_*`；复制为 `.env` 填密钥

换基座见 `agent/docs/llm-base.md`。`baseURL` 不写进 yaml 密钥。

办公 PDF / PPT 由 `spur-office-sandbox` 挂载。`system-prompt.persona` 要求自然语言分流到 `create_pdf` / `create_pptx`，用户不必说工具名。重启：`./run-web.sh`
