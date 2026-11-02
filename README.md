# Link Garden
<img width="1920" height="1032" alt="image" src="https://github.com/user-attachments/assets/eebc7747-f216-44af-b48e-7e5c8422b763" />
本地 Markdown 双向链接知识库，提供 Windows 桌面 UI 和面向本地 Agent 的 MCP 工具。分类仅一层，标签扁平，不使用 embedding，也不生成摘要。

[下载 Windows 安装包与 PDF 教程](https://github.com/Cao-zei-didnt-fly/SkillofATwoWayLinkDatabaseAndItsUI/releases/latest)

## Windows 10 / 11 桌面版（x64）

运行桌面快捷方式，或安装 `dist/Link-Garden-Setup-0.5.0.exe`。可直接运行 `dist/win-unpacked/Link Garden.exe`，但需要保留该目录整体。

本包面向 Windows 10/11 x64，使用支持 Windows 10 及以上的 Electron 运行时；已在本机 Windows 11 验证，尚未做 Windows 10 实机测试。

应用不注册开机启动，不使用托盘，关闭窗口即退出 UI 进程。右上角可切换五种标志色并保存选择。首次启动将随程序附带的初始笔记（欢迎页、界面速览、Agent 接口）复制到 `<安装目录>/data/vault`；升级不覆盖此目录。`LINK_GARDEN_VAULT` 可指定其他库。

UI 包含文件列表、全文搜索、片段预览、分页、分类/标签筛选、Markdown 阅读编辑、反向链接、删除笔记与状态看板。右上角“使用指南”提供按钮说明、快捷键和首次使用步骤；默认库附带入门笔记与界面速览。删除笔记会移除 Markdown 文件，并把其他笔记中指向它的 `[[链接]]` 清理为显示文字；代码示例不会被改写。动态网络的 D3 力导向布局在 Web Worker 后台计算，拖动时暂停物理运算，Canvas 批量绘制并合并渲染请求。支持节点斥力、碰撞分离、节点拖动、背景平移、滚轮缩放、适应视野、暂停/恢复、悬停标题和点击阅读。方向键平移、加减号缩放、0 重置；下拉框可定位和打开节点。网络默认展示筛选结果的前 1000 个节点，大库可通过正文搜索、分类和标签缩小范围。

## 必做：由 Agent 自行全局注册并核验信任

0.4 改为：安装器只准备本机 REGISTER-MCP.md，不再默认替 Agent 写配置。**所有客户端都必须完成 Agent 自行注册或核验这一步**，不是失败后的可选回退。全局指当前用户的所有项目，不是所有 Windows 账户。

支持七个平台的用户级说明：**Codex、WorkBuddy、CodeBuddy / CodeBuddy Code、Cursor、Claude Desktop、VS Code/Copilot、Cline（VS Code）**。CodeBuddy 的用户全局目录是 ~/.codebuddy，区别于 WorkBuddy 的 ~/.workbuddy；优先让 CodeBuddy 使用原生 --scope user 注册。

打开右上角 **连接 AI**，复制“必做的全局注册指令”给目标 Agent。它应读取本机指南、通过客户端原生方法全局注册/复用条目、完成信任核验，并实际只读调用 catalog 或 search_notes。报告应分别说明全局配置路径、客户端信任状态、握手结果与调用结果。应用自身只能做独立诊断，不能证明另一个客户端已经授权。

WorkBuddy 的安全中心、自定义 MCP 总开关、服务/工具开关及工作区信任都可能阻止工具调用。**自行注册和全局作用域不能绕过信任授权**；需要用户在该客户端确认时，Agent 必须准确指出位置，不能伪造信任记录或关闭全部沙箱。CodeBuddy 可在 /mcp 或其原生 mcp 管理命令中检查服务与权限。

没有本机文件/注册权限、只支持远程 MCP 或使用自定义 Profile 的客户端，也必须阅读注册指南并说明限制。通用说明见 [docs/REGISTER-MCP.md](docs/REGISTER-MCP.md)。本机专用指南包含实际 command、args、env、库与 skill 路径。

MCP 仍采用本地 stdio，使用 exe 自带的 Node 运行模式（ELECTRON_RUN_AS_NODE=1）。无需预装 Node.js，不开网络端口，不开机自启动。MCP 进程由 Agent 管理，关闭知识库 UI 不会切断另一个 Agent 的连接。

0.3 的旧预写记录仍可在界面解除关联；0.4 由 Agent 直接注册的配置和信任属于客户端，不被安装器自动认领或删除。升级后也需要执行一次全局核验。

工具如下：

| 工具 | 功能 |
| --- | --- |
| `search_notes` | 搜索标题、标签和全部正文；返回原文片段、行号、版本和排名，不返回全文 |
| `read_note` | 按行和字符上限读取，检测版本变化，提供续读位置 |
| `catalog` | 发现已有分类/标签，按名称查询、计数和分页 |
| `neighbors` | 分页获取出链与反向链接 |
| `create_note` | 创建 Markdown 笔记 |
| `update_note` | 携带版本更新，防止覆盖并发修改 |
| `link_notes` | 为已存在的两篇笔记创建显式链接 |
| `delete_note` | 携带当前版本永久删除笔记；同时清理其他笔记中指向它的链接，保留显示文字 |
| `refresh_index` | 扫描元数据并增量更新变动文件 |

例：先调用 `search_notes({query:"登录 失败",limit:10})`，根据命中片段选择文档，再调用 `read_note({id:"auth",version:"返回的版本",startLine:80,maxLines:30})`。未知标签不妨碍正文搜索。

检索使用 SQLite FTS5 的字符/双字符倒排索引，覆盖中文单字、两字词和英文子串。多个词默认为全部命中，`match:"any"` 放宽为任一命中；双引号表示短语。标题、标签、正文按不同权重排序。它不是语义搜索；同义词可由 agent 改写查询进行多轮检索。返回行号从 frontmatter 后、去掉正文首尾空白后的第一行开始。

默认搜索 20 条，最多 100 条；读取默认 200 行 / 16000 字符，最多 1000 行 / 64000 字符，超出时通过 `next` 继续；分类/标签发现与邻居均分页。UI 按页渲染文件与看板，避免将整库正文加载进客户端。

## 文件与索引

库根目录的 `<id>.md` 是唯一原始数据，frontmatter 包含 title/category/tags/status/updated。ID 保持稳定，修改标题不破坏 ID 链接。`[[id]]`、`[[标题]]`、`[[id|显示名称]]` 创建关联，代码示例中的链接不计入关系。缺失或重复标题引用在网络接口中标为未解析。

`.link-garden/index.sqlite` 保存全文倒排索引与元数据缓存，可以在关闭所有访问进程后删除整个 `.link-garden` 目录，下次启动会从 Markdown 重建。索引通过文件通知和元数据检查更新，仅重新解析变更文件；点击 UI 的刷新或调用 `refresh_index` 可立即扫描。SQLite WAL 支持多个客户端共享索引，写操作串行，Markdown 使用临时文件原子替换；版本号是文件内容的 SHA-256，MCP 更新必须携带版本。

外部编辑器不参与版本检查，仍可能覆盖别的进程的写入，建议定期备份。当前只读取库根目录的 Markdown，不递归文件夹，也未实现附件管理；Markdown 中的 `<img>` 会被安全过滤，不加载远程图片，避免不可控的网络请求。桌面版的外部 `http(s)` / `mailto:` 链接交给系统浏览器或邮件客户端打开。索引扫描仍随文件数量增长，不承诺任意规模的固定响应时间。

## 开发与测试

需要 Node.js 22.13+（使用内置 `node:sqlite`）或随 Electron 附带的运行时。

```powershell
npm install
npm start              # 网页开发版 http://127.0.0.1:4317
npm run desktop        # 桌面开发版
npm test               # 存储、全文搜索、版本冲突、删除链接清理、MCP 端到端测试
npm run test:desktop   # 实际桌面渲染、配色、网络、使用指南与删除清理验证
npm run build:win      # 生成离线前端与 Windows 安装包
node scripts/export-connections.mjs
powershell -ExecutionPolicy Bypass -File scripts/create-shortcut.ps1
```

网页开发版默认读项目 `vault/`，可用 `LINK_GARDEN_VAULT` 改目录、`PORT` 改端口，只监听本机。HTTP POST `/api` 与 CLI 共用操作对象：

```powershell
'{"action":"search","query":"登录失败","limit":10}' | node src/cli.js --vault "D:\Link Garden\data\vault"
```

成功响应 `{ok:true,result:...}`，失败 `{ok:false,error:...}`。CLI 无需服务器，但需要 Node.js；桌面 MCP 则由 exe 自带运行时。开发阶段也可使用 `node src/mcp-entry.js --vault <目录>` 接入 MCP。

## 本地模型测试数据

参见 `docs/local-model.md`。`node scripts/generate-fixtures.mjs` 通过现有 LM Studio 通道调用本机模型，生成隔离测试种子；`node scripts/benchmark.mjs 5000` 基于这些种子构造大库并测量搜索、增量更新和网络数据读取性能。测试库和报告保存在 `dist/fixtures`，不会写入正式笔记。扩展样本并非每篇都独立由模型生成。

## 本地集中存储（0.5）

默认安装 D:\Link Garden；无 D 盘时 C:\Link Garden。笔记和索引位于 data/vault，界面设置和缓存位于 data/profile，接入指南位于 data/integrations，日志、崩溃记录与运行临时文件也在 data。右上角“数据目录”可打开实际目录。没有写入权限会明确报错，不会悄悄回退 AppData。可用 LINK_GARDEN_DATA_DIR 指定数据根目录，LINK_GARDEN_VAULT 单独指定库。

升级与卸载保留 data。首次启动会复制旧 %APPDATA%/Link Garden 的笔记与设置，不覆盖不同内容的同名文件；迁移记录见 data/.layout.json。原件仍保留，确认迁移完整后可自行清理旧目录。安装程序不再往 LocalAppData 留完整安装包副本。Agent 的用户级全局 MCP/skill 配置、Windows 快捷方式和注册表仍使用系统或客户端规定的位置；不能承诺系统零写入。移动或改装目录后，重新让 Agent 按新指南核验全局路径。

