---
title: Agent 接口
category: 使用指南
tags: [Agent, 接口]
status: 待整理
---
笔记可以由 UI、命令行或本地 HTTP 接口写入。所有入口使用相同的结构化操作。

```json
{"action":"create","id":"my-note","title":"一个想法","tags":["灵感"],"body":"关联到 [[welcome]]"}
```

Agent 使用项目内 `skills/link-garden/SKILL.md` 获取操作约定。
