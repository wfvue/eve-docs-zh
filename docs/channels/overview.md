---
title: "Channels"
description: "把 Agent 接到 HTTP、Slack、Discord 等平台入口。"
---

# Channels：渠道

Channel 是用户或外部平台进入 Agent 的入口。它负责把平台输入转换成 eve message，把 Agent 的事件和结果转换回平台能展示的形式。

## 适合解决什么

- Web UI 或 HTTP 客户端访问 Agent。
- Slack、Discord、Teams、Telegram 等聊天平台集成。
- GitHub、Linear 等工作流平台集成。
- 自定义业务系统接入。

## 和 tool 的区别

Channel 负责“消息从哪里来、结果发到哪里去”。Tool 负责“Agent 能做什么动作”。两者不要混在一起。
