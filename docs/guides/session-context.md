# Session context

Session context 描述一次会话中的身份、来源、当前 turn、父子 session 等运行时信息。工具、hooks 和动态能力可以通过它判断当前请求来自谁、属于哪个租户、是否由 schedule 或 channel 发起。

## 要点

- 用于权限判断和租户隔离。
- 用于区分当前调用者和 session 发起者。
- 用于在工具执行时获得必要上下文。
