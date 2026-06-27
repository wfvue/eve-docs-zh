# Dynamic capabilities

Dynamic capabilities 用来根据当前 session context 动态解析 instructions、tools、skills 等能力。

## 适合场景

- 不同租户加载不同工具或流程。
- 不同 channel 使用不同提示词。
- 根据当前用户权限控制可见能力。

## 工程建议

动态能力不要绕过后端权限校验。即使模型看不到某个工具，真正的业务服务仍然应该做权限、审计和幂等控制。
