请使用 `vercel connect create` 返回的 connector UID；传给 `--name` 的显示名不是 UID。`connect("linear/myagent")` 默认是 user-scoped。第一次调用时，如果当前用户还没有授权，Eve 会发出 `authorization.required` 事件，暂停 turn，等回调完成后继续。
