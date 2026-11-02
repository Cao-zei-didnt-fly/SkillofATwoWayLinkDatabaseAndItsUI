---
title: Agent 接口
category: 使用指南
tags: [Agent, 接口, 入门]
status: 已完成
---
笔记可以由 UI、命令行或本地 HTTP 接口写入。所有入口使用相同的结构化操作。

```json
{"action":"create","id":"my-note","title":"一个想法","tags":["灵感"],"body":"关联到 [[welcome]]"}
```

## 常用 MCP 工具

- `search_notes`：先搜索标题、标签和正文；返回原文片段与行号。
- `read_note`：按需读取一段正文；写入前先取得当前 `version`。
- `create_note` / `update_note`：创建或替换笔记字段；更新必须带版本。
- `link_notes`：为已存在的两篇笔记追加显式链接，重复调用不会重复写入。
- `delete_note`：永久删除笔记文件；需要当前 `version`，并会清理其他笔记中指向它的链接，保留显示文字。
- `catalog` / `neighbors`：浏览分类标签，或沿链接扩展阅读。
- `refresh_index`：在外部编辑器修改文件后增量扫描。

写入是乐观版本控制：如果版本过期，先重新读取再合并，不要直接覆盖。删除不可撤销，只有在用户明确要求时才调用。

Agent 使用项目内 `skills/link-garden/SKILL.md` 获取完整操作约定。相关页面：[[welcome|欢迎页]]、[[quick-tour|界面速览]]。
