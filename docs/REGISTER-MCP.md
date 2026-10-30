# 必做：让 Agent 自行全局注册 Link Garden

从 0.4 起，这不是可选的失败回退，而是所有客户端的接入必经步骤。安装器只准备说明，不再默认代写 Agent 配置或信任记录。

## 获取本机实际路径

打开 Link Garden → 连接 AI → 复制必做的全局注册指令，粘贴给目标 Agent。或者打开该界面显示的 REGISTER-MCP.md。

默认文件位于 `D:\Link Garden\data\integrations\REGISTER-MCP.md`，没有 D 盘时改为 C 盘；自定义安装以应用显示的实际路径为准。它包含完整 command、args、env、知识库、skill 位置，以及七个平台的用户级路径。

> 请读取本机的 REGISTER-MCP.md，必须在你当前客户端的用户级全局（所有项目）注册或核验 Link Garden MCP，不要只写项目配置。保留其他设置，完成客户端信任/权限核验并实际调用只读工具。分别报告全局配置路径、信任状态、握手结果和调用结果。需要我授权时准确指出位置，不要绕过客户端安全设置。

## WorkBuddy

用户全局配置为 `~/.workbuddy/mcp.json`。在客户端连接器/MCP 管理和安全中心确认服务受信任并已启用。自定义 MCP 总开关、服务/工具开关、工作区信任均可能影响调用。由 Agent 注册不能自动获得这些权限；需要用户确认时仍须通过该客户端正常授权。不要通过全局关闭沙箱解决问题。

## CodeBuddy / CodeBuddy Code

这是 WorkBuddy 的编程产品，使用独立的 `~/.codebuddy/mcp.json` 用户全局配置和 `~/.codebuddy/skills/`。优先使用原生 `codebuddy mcp add-json --scope user`，按环境安全传递指南里的完整服务对象；通过 `codebuddy mcp list`、`codebuddy mcp get link_garden` 或 `/mcp` 检查作用域、连接和工具权限。不改写其他服务或全局 permissions。

## 验收顺序

1. 确认配置处于 user/global，不是当前项目；检查项目同名条目是否遮蔽全局配置。
2. 保留 command、args 和 `ELECTRON_RUN_AS_NODE=1`，无需另装 Node.js。
3. 在客户端刷新 MCP，按其信任流程启用 Link Garden，需要用户确认时明确提示。
4. 在当前客户端实际查看工具，再只读调用 `catalog` 或 `search_notes`。不写用户笔记做测试。
5. 缺少证据的状态标为待确认。独立诊断通过不代表客户端信任通过。

如果 Agent 没有本机文件/注册权限，或宿主不支持本地 stdio MCP，应说明限制并给出界面操作，不能声称已自行完成。

由 Agent 直接注册的条目需要在客户端维护和移除；程序迁移、升级或更换库后应重新核验。

官方依据：
- https://www.codebuddy.cn/docs/cli/mcp
- https://www.codebuddy.cn/docs/cli/codebuddy-dir
- https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Permission-Modes
