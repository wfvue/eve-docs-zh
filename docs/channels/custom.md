# Custom Channel

这一页对应官方 Custom channel 文档。自定义 channel 用来把你自己的平台、业务系统或 UI 接入 eve。

## 要点

- 把外部输入转换成 eve message。
- 把 session 事件和最终回复转换回你的系统格式。
- 在 channel 层处理鉴权、路由、目标对象和展示形式。

## 建议

当内置 channel 无法覆盖你的平台时，再编写 custom channel。业务逻辑仍应放在 tool、service 或后端代码里。
