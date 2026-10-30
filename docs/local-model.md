# 本机 LM Studio / Bionic 调用路径

本次实际探测结果（2026-10-30）：

- 桌面程序：`F:\LMstudio\Bionic\Bionic.exe`
- 调用工具：`C:\Users\Administrator\.lmstudio\bin\lms.exe`
- 已加载模型 ID：`3.8`（调用时使用此 ID，不猜模型名称）
- 模型文件标识：`qwen/3.8-Q8/RVN-Q8_0-multilingual-mtp.gguf`
- 元数据：27B、Q8_0、architecture qwen35、displayName RVN Multilingual Mtp；这些是本机返回值，不据此推断外部产品命名。

## 无 HTTP 服务的实际可用路径

```powershell
& "$env:USERPROFILE\.lmstudio\bin\lms.exe" ps --json
& "$env:USERPROFILE\.lmstudio\bin\lms.exe" chat 3.8 --dont-fetch-catalog --reasoning off --prompt '只返回JSON：生成一篇中文Markdown测试笔记'
```

这是本次已验证的路径。无需开启 HTTP 服务，也不改变 Bionic 的启动设置。项目生成脚本用 `spawn` 参数数组调用，不通过 shell 拼接用户内容。可设置 `LMS_PATH` 和 `LMS_MODEL` 覆盖默认值。

```powershell
node scripts/generate-fixtures.mjs
node scripts/benchmark.mjs 5000
```

生成器仅发送人工构造的测试任务，不读取或上传用户正式笔记。原始返回、24篇模型种子、大库样本和测量报告位于 `dist/fixtures/`。需要不同规模可运行 benchmark 的数量参数。它会改写该隔离测试库内同名 sample 文件，不涉及正式 vault。

## 可选 HTTP 路径

官方兼容接口通常为 `GET http://127.0.0.1:1234/v1/models` 与 `POST http://127.0.0.1:1234/v1/chat/completions`，模型字段应填实际返回的 ID。参见 https://lmstudio.ai/docs/developer/openai-compat/chat-completions 。

本次发现 HTTP 服务未开启；尝试启动服务的命令被自动审批阻止，因此未验证 HTTP 推理，没有更改为监听局域网，也没有建立自启动项。后续如需 HTTP，可在 Bionic/LM Studio 中自行开启并确认地址、端口与认证设置。
