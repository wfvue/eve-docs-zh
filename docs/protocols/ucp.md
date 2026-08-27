---
title: "Universal Commerce Protocol（UCP）"
description: "用自定义 eve channel 在 /.well-known/ucp 提供 UCP profile。"
---

# Universal Commerce Protocol（UCP）

[Universal Commerce Protocol](https://ucp.dev/)（UCP）是面向 agentic commerce 的开放标准。商家通过在 `/.well-known/ucp` 提供一份 JSON **profile** 来声明支持：这份文档列出支持的 spec 版本、services、capabilities、payment handlers，以及 Agent 用来校验签名响应的公钥。

用 eve 支持 UCP 分三步：编写 profile、从 channel 提供它、再添加 commerce 端点。

## 编写 profile

profile 是一份遵循 [UCP spec](https://ucp.dev/) 的普通 JSON 对象。spec 约定 `version`、`services`、`payment_handlers` 和 `capabilities`，也包括 `signing_keys`。

```ts
// agent/ucp-profile.ts
export const profile = {
  ucp: {
    version: "2026-04-08",
    services: {
      "dev.ucp.shopping": [
        {
          version: "2026-04-08",
          spec: "https://ucp.dev/2026-04-08/specification/overview",
          transport: "rest",
          schema: "https://ucp.dev/2026-04-08/services/shopping/rest.openapi.json",
          endpoint: "https://your_deployment_url_here/ucp/shopping",
        },
      ],
    },
    capabilities: {
      "dev.ucp.shopping.checkout": [
        {
          version: "2026-04-08",
          spec: "https://ucp.dev/2026-04-08/specification/checkout",
          schema: "https://ucp.dev/2026-04-08/schemas/shopping/checkout.json",
        },
      ],
    },
    payment_handlers: {
      "dev.shopify.shop_pay": [
        {
          id: "shop_pay_1234",
          version: "2026-04-08",
          spec: "https://shopify.dev/ucp/shop-pay-handler",
          schema: "https://shopify.dev/ucp/schemas/shop-pay-config.json",
          available_instruments: [{ type: "shop_pay" }],
        },
      ],
    },
  },
  signing_keys: [
    {
      kid: "business_2025",
      kty: "EC",
      crv: "P-256",
      x: "...",
      y: "...",
      use: "sig",
      alg: "ES256",
    },
  ],
};
```

## 从 channel 提供它

用自定义 channel 在 `/.well-known/ucp` 提供这份 profile：

```ts
// agent/channels/ucp.ts
import { defineChannel, GET } from "eve/channels";
import { profile } from "../ucp-profile";

const body = JSON.stringify(profile);

export default defineChannel({
  cors: true,
  routes: [
    GET("/.well-known/ucp", async () => {
      return new Response(body, {
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=300",
        },
      });
    }),
  ],
});
```

- **缓存**：spec 要求 `public` 且 `max-age` 至少 60 秒，并禁止 `private`、`no-store`、`no-cache`。见 [Profile Requirements](https://ucp.dev/2026-04-08/specification/overview#hosting)。
- **CORS**：`cors: true` 适合公开 discovery metadata。传入 `cors` 选项对象可以收窄 origins。见 [自定义渠道（Custom channels）](../channels/custom)。
- **HTTPS、无重定向**：spec 要求 HTTPS，并禁止 profile 端点返回 3xx。

## 添加 commerce 端点

`services[].endpoint` 里的 URL 必须指向你自己提供的端点。也可以用自定义 channel 来挂这些路由：

```ts
// agent/channels/ucp-shopping.ts
import { defineChannel, POST } from "eve/channels";

export default defineChannel({
  routes: [
    POST("/ucp/shopping/checkout-sessions", async (req) => {
      const request = await req.json();
      return Response.json({
        ucp: {
          version: "2026-04-08",
          capabilities: {
            "dev.ucp.shopping.checkout": [{ version: "2026-04-08" }],
          },
        },
        id: "checkout_123",
        status: "incomplete",
      });
    }),
  ],
});
```

路由相对 profile 里的 `endpoint` 基地址，并遵循该 service 的 OpenAPI schema。请与这里挂载的路径保持同步。

## 验证

用 `eve dev` 启动开发服务器，然后本地拉取 well-known 文档：

```sh
curl -i http://localhost:2000/.well-known/ucp
```

再从部署环境拉取 `https://your_deployment_url_here/.well-known/ucp`。期望 `200`、`content-type: application/json` 和 `cache-control: public, max-age=300`。

## 本文不覆盖的内容

Commerce 操作语义由作者自己负责：checkout、cart、order 状态机；payment-handler 执行；以及请求签名与校验。eve 只提供 channel 路由来托管 profile 和你自己的端点。

## 接下来读什么

- [渠道概览（Channels overview）](../channels/overview)
- [自定义渠道（Custom channels）](../channels/custom)

官方原文：[Universal Commerce Protocol (UCP)](https://eve.dev/docs/protocols/ucp)。
