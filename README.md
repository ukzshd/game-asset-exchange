# IGGM-Style Game Marketplace

English summary: this repository is a Next.js 16 full-stack game-item marketplace prototype inspired by IGGM, with a real Stripe payment flow, a staff-facing order operations workflow, JWT auth, SQLite persistence, and a frontend that still prioritizes the original marketplace-like browsing experience.

---

## 中文

### 1. 项目定位

这是一个 **IGGM 风格的游戏道具交易平台原型**，目标是围绕以下业务闭环搭建系统：

`浏览商品 -> 加入购物车 -> 填写游戏交付信息 -> Stripe 支付 -> 后台接单/派单 -> 人工游戏内交付 -> 订单完结`

当前代码库已经不再是“纯前端复刻 + 模拟支付”的状态，而是一个 **后端优先补强后的可运行原型**：

- 商品浏览、购物车、结账、用户中心、推广页、运营后台都可运行
- 支付已经接入 **Stripe Checkout + Webhook**
- 后台支持 **admin / support / worker** 角色
- 订单状态流转已经改成 **受限状态机**
- 已有 **派单、订单日志、基础限流、输入校验、搜索 API、SEO 路由、自动化测试**

它仍然不是最终商业化版本，原因是以下能力还没有做完：

- PayPal 尚未接入
- 邮件系统未接入
- 商品详情 API 已完成，但商品详情页 UI 还未做
- 全站搜索 API 已完成，但 Header 搜索框还没有接入真实结果面板
- 只有 ARC Raiders 有真实商品数据
- 没有 CMS / JSON-LD / OG 卡片
- 没有实时通知、风控、设备指纹、聊天系统

### 2. 当前实现状态

#### 已实现

- Next.js 16 App Router 全栈项目
- SQLite 自动初始化和迁移
- 用户注册 / 登录 / JWT 鉴权 / 修改资料 / 修改密码
- 用户角色：`user` / `worker` / `support` / `admin`
- 商品列表页、购物车、结账、用户中心、推广页、运营后台
- Stripe Checkout 创建支付会话
- Stripe Webhook 验签并推进订单为 `paid`
- 支付确认接口（前端从 Stripe 返回后对账）
- 订单受限状态机
- 订单派单
- 订单状态日志
- Stripe 退款联动（后台把订单改成 `refunded` 时会真实调用 Stripe Refund）
- 全站搜索 API
- 商品详情 API
- 动态 `robots.txt` 和 `sitemap.xml`
- 全局安全响应头
- 写接口的基础跨站请求防护
- 本地多币种展示
- 中英双语资源
- 基础限流
- 基础输入清洗 / 校验
- 自动化测试 + 构建验证

#### 当前主要限制

- 真实支付目前 **只支持 Stripe**，PayPal 在界面中已禁用
- 订单仍然是人工交付，没有客服聊天、交付截图上传、自动通知机器人
- 多语言仍只有 `en / zh`
- 多币种汇率仍是本地静态数据，不是实时汇率服务
- 后台是运营原型，不是完整 ERP / OMS

---

### 3. 技术栈

| 层级 | 技术 |
|---|---|
| 框架 | Next.js 16.1.6 (App Router) |
| 前端 | React 19.2.3 |
| 数据库 | SQLite + better-sqlite3 |
| 认证 | jose (JWT) + bcryptjs |
| 支付 | Stripe Checkout + Stripe Webhooks |
| 状态管理 | Zustand |
| 样式 | CSS Modules + CSS Variables |
| 测试 | Vitest |
| 构建校验 | ESLint + Next build |

---

### 4. 核心业务流程

#### 用户侧

1. 浏览商品目录 `/[game]/[category]`
2. 加入购物车 `/cart`
3. 在 `/checkout` 填写交付信息
4. 创建订单
5. 跳转到 Stripe Hosted Checkout
6. 支付成功后返回站点
7. 站点调用 `/api/payments/confirm` 做支付对账
8. 用户在 `/dashboard` 查看订单状态

#### 运营侧

1. 支付成功后订单进入 `paid`
2. `admin` 或 `support` 在 `/admin` 查看订单
3. 将订单分配给 `worker` 或 `support`
4. 被分配人员推进状态：`assigned -> delivering -> delivered`
5. `admin` / `support` 最终推进到 `completed`
6. 若发生售后，`admin` / `support` 可推进到 `refunded`，并触发 Stripe Refund

---

### 5. 订单状态机

当前订单状态定义如下：

| 状态 | 含义 |
|---|---|
| `pending_payment` | 已创建订单，等待支付 |
| `paid` | Stripe 确认支付成功 |
| `assigned` | 已分配给客服/打手 |
| `delivering` | 正在交付 |
| `delivered` | 已交付完成，待收尾 |
| `completed` | 订单完结 |
| `payment_failed` | 支付失败 |
| `cancelled` | 未支付阶段取消 |
| `refunded` | 已退款 |

#### 状态流转约束

- `pending_payment -> paid / cancelled / payment_failed`
- `payment_failed -> pending_payment / cancelled`
- `paid -> assigned / refunded`
- `assigned -> delivering / refunded`
- `delivering -> delivered / refunded`
- `delivered -> completed / refunded`

#### 角色权限

| 角色 | 能力 |
|---|---|
| `user` | 下单、支付、查看自己的订单 |
| `worker` | 只能处理分配给自己的订单，且只能做 `assigned -> delivering -> delivered` |
| `support` | 可查看全部订单、派单、推进大多数运营状态 |
| `admin` | 拥有全部能力，且可修改用户角色 |

---

### 6. 主要页面

| 路由 | 说明 |
|---|---|
| `/` | 首页 |
| `/[game]/[category]` | 商品目录页 |
| `/cart` | 购物车 |
| `/checkout` | 结账页，真实支付入口 |
| `/dashboard` | 用户中心 / 订单历史 |
| `/affiliate` | 推广佣金页 |
| `/admin` | 运营后台 |

---

### 7. 主要 API

#### 鉴权

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PUT /api/auth/profile`
- `PUT /api/auth/password`

#### 商品

- `GET /api/products/[game]`
- `GET /api/products/[game]/[id]`

#### 搜索

- `GET /api/search?q=keyword&limit=10`

#### 订单

- `POST /api/orders`
- `GET /api/orders`
- `GET /api/orders/[id]`
- `PUT /api/orders/[id]/status`

#### 支付

- `POST /api/payments/create`
- `POST /api/payments/confirm`
- `POST /api/payments/webhook`

#### 运营后台

- `GET /api/admin/orders`
- `PUT /api/admin/orders/[id]/assign`
- `GET /api/admin/users`
- `PUT /api/admin/users/[id]/role`

#### 推广

- `GET /api/affiliate/stats`
- `GET /api/affiliate/commissions`

---

### 8. 数据库结构概览

当前核心表：

- `users`
- `products`
- `orders`
- `order_items`
- `coupons`
- `affiliate_commissions`
- `order_status_logs`

#### `orders` 表当前额外包含的关键字段

- 用户交付信息：`embark_id`, `character_name`, `delivery_email`, `delivery_contact`, `delivery_platform`, `delivery_server`
- 支付信息：`payment_provider`, `payment_id`, `payment_session_id`, `payment_reference`, `payment_status`
- 运营信息：`assigned_to`, `assigned_at`, `assigned_by`, `delivered_at`, `completed_at`, `last_status_changed_at`

#### 订单日志表 `order_status_logs`

用于记录：

- 订单创建
- 支付会话创建
- 支付确认
- 状态变更
- 派单记录

这保证了最基础的可追踪性，而不是只在 `orders.status` 上覆盖写。

---

### 9. 环境变量

复制一份 `.env.local`：

```bash
cp .env.example .env.local
```

必填变量：

| 变量 | 说明 |
|---|---|
| `JWT_SECRET` | JWT 签名密钥，部署时必须替换为长随机字符串 |
| `NEXT_PUBLIC_APP_URL` | 站点公开地址，例如 `http://localhost:3000` |
| `STRIPE_SECRET_KEY` | Stripe Secret Key |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook Signing Secret |

可选变量：

| 变量 | 说明 |
|---|---|
| `IGGM_DB_PATH` | 自定义 SQLite 文件路径，测试和多环境隔离时有用 |
| `DATABASE_PATH` | `IGGM_DB_PATH` 的兼容别名 |

示例：

```env
JWT_SECRET=replace-with-a-long-random-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

> 说明：如果本地没有配置 `JWT_SECRET`，开发/构建阶段会使用一个不安全的 fallback，并打印警告。部署时不能依赖这个 fallback。

---

### 10. 本地启动

#### 安装依赖

```bash
npm install
```

#### 启动开发服务器

```bash
npm run dev
```

打开：

- [http://localhost:3000](http://localhost:3000)

数据库默认在：

- `data/iggm.db`

数据库会在首次访问相关 API 时自动初始化并迁移。

---

### 11. 初始化管理员账号

项目不会自动内置管理员账号。

请运行：

```bash
npm run bootstrap:admin -- --email admin@example.com --password StrongPassword123 --username admin
```

这个脚本会：

- 如果用户不存在：创建一个 `admin`
- 如果用户已存在：把该用户提升为 `admin` 并更新密码

脚本文件：

- [scripts/bootstrap-admin.mjs](/Users/mac/Documents/project/web/scripts/bootstrap-admin.mjs)

初始化管理员后，你可以：

1. 用这个账号登录站点
2. 打开 `/admin`
3. 将其他账号改成 `support` 或 `worker`
4. 用这些角色测试派单和订单流转

---

### 12. Stripe 本地联调

#### 1. 启动站点

```bash
npm run dev
```

#### 2. 启动 Stripe CLI 转发 webhook

```bash
stripe listen --forward-to localhost:3000/api/payments/webhook
```

Stripe CLI 会输出一个 `whsec_...`，把它写进 `.env.local` 的 `STRIPE_WEBHOOK_SECRET`。

#### 3. 在站点中发起支付

前端会调用：

- `POST /api/orders`
- `POST /api/payments/create`

随后跳转到 Stripe Hosted Checkout。

#### 4. 支付成功后

- Stripe Webhook 推进订单到 `paid`
- 前端返回站点后再调用 `/api/payments/confirm` 做一次对账补偿

这意味着支付推进有两层保障：

- **主路径：Webhook**
- **补偿路径：前端返回后的确认接口**

---

### 13. 搜索、商品与 SEO 路由

#### 全站搜索 API

请求示例：

```bash
curl 'http://localhost:3000/api/search?q=arc&limit=5'
```

返回内容包含：

- `products`: 匹配到的商品
- `games`: 匹配到的游戏

这个接口已经可用，后续只需要把 Header 搜索框接入即可。

#### 商品详情 API

请求示例：

```bash
curl 'http://localhost:3000/api/products/arc-raiders/1'
```

返回内容包含：

- `product`: 当前商品
- `related`: 同游戏、同类目的相关商品

这个接口已经把后续商品详情页的后端能力补好了。

#### SEO 路由

当前已生成：

- `/robots.txt`
- `/sitemap.xml`

`sitemap.xml` 当前会输出：

- 首页
- 推广页
- 所有激活游戏的分类页

---

### 14. 安全能力

当前后端和全局请求链路已经补充了以下安全措施：

- JWT 鉴权
- bcrypt 密码哈希
- 关键写接口限流
- 输入清洗和基础校验
- Origin / Referer 校验，用于拦截明显的跨站写请求
- 统一安全响应头

安全响应头由 [proxy.js](/Users/mac/Documents/project/web/proxy.js) 注入，当前包括：

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`
- `Cross-Origin-Opener-Policy`
- `Cross-Origin-Resource-Policy`
- 在 HTTPS 下追加 `Strict-Transport-Security`

---

### 15. 自动化测试与校验

#### 运行单元/集成测试

```bash
npm test
```

当前测试覆盖了：

- 输入校验工具
- 订单状态机权限与可流转状态
- 下单 API
- Stripe 支付会话创建
- 支付确认
- 派单
- 订单状态推进
- Stripe 退款联动
- 搜索 API
- 商品详情 API
- 跨站请求拦截

#### 运行完整校验

```bash
npm run verify
```

会依次执行：

1. `npm run lint`
2. `npm run test`
3. `npm run build`

如果你准备提交、部署或继续开发，优先跑 `verify`。

---

### 16. 常用命令

```bash
npm run dev              # 启动开发环境
npm run lint             # 运行 ESLint
npm run test             # 运行 Vitest
npm run build            # 构建生产版本
npm run verify           # lint + test + build
npm run bootstrap:admin -- --email admin@example.com --password StrongPassword123 --username admin
```

---

### 17. 当前代码结构

```text
web/
├── app/
│   ├── [game]/[category]/          # 商品目录页
│   ├── admin/                      # 运营后台页面
│   ├── affiliate/                  # 推广页
│   ├── cart/                       # 购物车
│   ├── checkout/                   # 结账页 + 客户端支付流程
│   ├── dashboard/                  # 用户中心
│   ├── robots.js                   # robots.txt
│   ├── sitemap.js                  # sitemap.xml
│   └── api/                        # 后端 API 路由
│       ├── auth/
│       ├── orders/
│       ├── payments/
│       ├── admin/
│       ├── affiliate/
│       ├── search/
│       └── products/
├── components/                     # 公共 UI 组件
├── data/                           # 商品、翻译、货币、SQLite 数据文件
├── lib/
│   ├── auth.js                     # JWT / auth guard
│   ├── db.js                       # SQLite 初始化 + 迁移
│   ├── env.js                      # 环境变量读取
│   ├── orders.js                   # 订单状态机 / 派单 / 日志
│   ├── payments/stripe.js          # Stripe 客户端封装
│   ├── rate-limit.js               # 基础限流
│   ├── request-security.js         # Origin / Referer 校验
│   ├── validation.js               # 输入校验 / 清洗
│   └── useHydrated.js              # 客户端 hydration 工具
├── proxy.js                        # Next.js 全局安全响应头
├── scripts/
│   └── bootstrap-admin.mjs         # 初始化管理员脚本
├── store/                          # Zustand 状态管理
├── tests/                          # Vitest 自动化测试
├── .env.example
├── package.json
└── README.md
```

---

### 18. 已知未完成项 / 后续建议

#### 高优先级

- PayPal 接入
- 邮件系统（注册验证、订单通知、找回密码）
- 后台商品管理
- 商品详情页 UI
- 实时通知（Discord / Slack / 企业微信）
- 更强的防刷和风控

#### 中优先级

- 动态汇率同步任务
- Header 搜索结果面板接入
- 多游戏商品数据扩充
- 更完整的运营日志和内部备注
- 用户端订单详情页 UI 优化

#### SEO 方向

- `generateMetadata`
- JSON-LD
- Open Graph / Twitter Cards
- 内容系统 / 攻略系统

---

## English

### What this repo is

This is a backend-strengthened IGGM-style marketplace prototype built with Next.js 16. It supports:

- catalog browsing
- cart and checkout
- JWT auth
- Stripe Checkout
- Stripe webhook payment confirmation
- order assignment and staff workflow
- role-based operations (`user`, `worker`, `support`, `admin`)
- SQLite persistence with auto-migration
- global search API
- product detail API
- dynamic robots and sitemap routes
- security headers via `proxy`
- automated tests with Vitest

### What is already real

- real Stripe session creation
- real Stripe webhook signature verification
- real payment confirmation reconciliation
- real Stripe refund call when an order is moved to `refunded`
- restricted order state machine
- staff assignment flow
- order audit log table
- cross-site write-request checks
- global search and product-detail APIs

### What is still missing

- PayPal
- email notifications / password reset
- product detail page UI
- search UI integration
- SEO engineering work
- multi-game product data beyond ARC Raiders
- fraud tooling / live chat / notifications

### Quick start

```bash
npm install
cp .env.example .env.local
npm run bootstrap:admin -- --email admin@example.com --password StrongPassword123 --username admin
npm run dev
```

### Verify everything

```bash
npm run verify
```

### Local Stripe webhook forwarding

```bash
stripe listen --forward-to localhost:3000/api/payments/webhook
```

### Core env vars

```env
JWT_SECRET=replace-with-a-long-random-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```
