# Link Garden 0.5.0

Windows 10 / 11 x64 本地 Markdown 双向链接知识库。

## 下载与安装

从本次 Release 下载 `Link-Garden-Setup-0.5.0.exe` 并运行。无需另外安装 Node.js。PDF 教程与 SHA256 校验文件一并提供。

- 默认安装到 `D:\Link Garden`，没有 D 盘时使用 `C:\Link Garden`，也可手动选择。
- 笔记、全文索引、界面设置、缓存、日志和接入指南集中保存在安装目录的 `data` 内。
- 升级和卸载保留 `data`；旧版 AppData 数据首次复制迁移，保留原件，同名冲突不覆盖。
- 不设置开机启动；关闭窗口退出桌面 UI。Agent 管理的 MCP 进程独立运行。

## 功能

- Markdown 编辑与渲染、文件列表、分类/标签筛选、状态看板。
- 正文关键词搜索，先返回原文片段，再按需读取文档；不使用 embedding 或预生成摘要。
- 双向链接与动态关联图：拖动、缩放、斥力布局、悬停标题和点击进入。
- 七个平台的用户级全局 MCP 接入指南：Codex、WorkBuddy、CodeBuddy、Cursor、Claude Desktop、VS Code/Copilot、Cline。
- 本地 skill 与结构化工具接口，供 Agent 搜索、读取、创建、更新及关联笔记。

## 接入 Agent

安装后打开“连接 AI”，复制必做的全局注册指令，交给目标 Agent。客户端要求的信任授权仍需正常完成；Agent 全局配置保存在各客户端规定的用户目录。

## 验证范围

26 项测试通过；已验证安装、覆盖升级、卸载保留数据，以及打包后的界面和 MCP。已在 Windows 11 实机验证；Windows 10 尚未实机验证。安装包未做代码签名。
