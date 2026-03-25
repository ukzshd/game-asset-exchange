# IGGM-Style Game Asset Exchange

English summary: this repository is a Next.js 16 full-stack marketplace prototype for game assets. It implements real Stripe and PayPal checkout flows, webhook-driven payment confirmation, PostgreSQL-backed catalog and content data, staff order operations, admin product/article management, password reset, exchange-rate syncing, risk event logging, and SEO-supporting routes such as `robots.txt`, `sitemap.xml`, metadata, and JSON-LD.

---

## 中文

### 1. 项目介绍

这是一个仿 IGGM 交易站业务模型的全栈原型，围绕下面这条交易闭环来设计：

`浏览商品 -> 加入购物车 -> 填写游戏交付信息 -> 法币支付 -> 平台确认收款 -> 运营派单 -> 人工游戏内交付 -> 订单完结`

当前仓库已经不是“纯前端复刻页面”或“本地模拟支付 demo”，而是一个后端主链路已经接上的可继续扩展原型。

当前已经具备：

- 真实 Stripe Checkout 支付链路
- 真实 PayPal Orders 支付链路
- Stripe Webhook 验签与支付确认
- PayPal 回跳确认与 Webhook 验签
- PostgreSQL 数据库驱动的商品、订单、内容、汇率、风控数据
- `user / worker / support / admin` 角色体系
- 订单创建、派单、状态流转、退款
- 后台商品管理
- 商品 SPU / SKU / 库存层
- 后台文章管理
- 新闻/攻略列表与详情页
- 密码重置请求与确认
- 实时汇率同步接口与后台手动同步
- 风控事件记录与后台查看
- Header 搜索结果面板、独立搜索页、商品详情页
- SEO 基础设施：metadata、JSON-LD、`sitemap.xml`、`robots.txt`
- 自动化测试、lint、构建校验

### 2. 当前项目定位

更准确的定位是：

- 一个 **后端优先完善后的交易平台原型**
- 前端界面尽量保持原有 IGGM 风格，不做大改版
- 真实交易闭环、后台运营能力、SEO 基础设施已经成型
- 还没有接入的部分，主要是更依赖第三方账号或外部服务凭据的能力

当前仍未完成或只做了基础版的内容：

- 邮箱验证码注册/登录
- 实时客服机器人（Slack / Discord / 企微等）
- 更高级的设备指纹和支付风控
- 真正的内容工作流 CMS（当前是轻量后台文章管理）
- 更复杂的商品/SPU/SKU/库存池模型

也就是说，仓库里“本地可以持续开发并落地验证”的高价值部分，已经补到了较完整的程度；剩余缺口主要依赖第三方平台能力或更重的运营系统扩展。

---

## 3. 已实现能力

### 前台页面

- 首页 `/`
- 游戏目录页 `/[game]/[category]`
- 商品详情页 `/[game]/product/[id]`
- 购物车 `/cart`
- 结账页 `/checkout`
- 用户中心 `/dashboard`
- 推广页 `/affiliate`
- 搜索页 `/search`
- 新闻/攻略列表页 `/news`
- 新闻/攻略详情页 `/news/[slug]`
- 忘记密码页 `/forgot-password`
- Header 即时搜索结果

### 用户与认证

- 邮箱注册
- 邮箱密码登录
- 邮箱验证码发送
- 邮箱验证码登录
- 邮箱验证码注册校验
- Google OAuth 登录
- Discord OAuth 登录
- Steam OpenID 登录
- JWT 鉴权
- 个人资料修改
- 密码修改
- 密码重置请求
- 密码重置确认

### 订单与支付

- 创建订单
- 保存交付信息（Embark ID、角色名、联系邮箱等）
- Stripe Checkout 会话创建
- PayPal Orders 创建与跳转
- Stripe Webhook 验签
- PayPal Webhook 验签
- 支付成功自动推进订单到 `paid`
- 支付失败/过期推进到 `payment_failed`
- 后台订单派单
- 严格订单状态机
- Stripe / PayPal 退款联动
- 订单状态日志

### 商品与搜索

- PostgreSQL 驱动的商品查询
- 兼容旧前台的商品读模型
- 归一化 `SPU / SKU / inventory_lots` 数据结构
- 游戏目录筛选和商品 API
- 商品详情 API
- 全站搜索 API
- Header 搜索建议
- 独立搜索页
- 后台商品新增 / 编辑 / 删除

### 内容与 SEO

- 文章表 `content_articles`
- 后台文章新增 / 编辑 / 删除
- 新闻/攻略列表 API 与详情 API
- 页面级 metadata
- 商品详情页 JSON-LD
- 文章页 JSON-LD
- 动态 `robots.txt`
- 动态 `sitemap.xml`

### 汇率与本地化

- 多币种前端展示
- 汇率表 `exchange_rates`
- 汇率查询 API `/api/currency-rates`
- 后台手动同步汇率 `/api/admin/currency-rates/sync`
- 启动后数据库无汇率时自动回填静态基础数据

### 风控与运营支撑

- 风控评分逻辑
- `risk_events` 风控事件表
- 下单时自动记录风险事件
- 后台风控事件查看
- 可选运营 webhook 通知（支付成功时推送）

### 商品运营模型

- `product_spus`：商品主模型
- `product_skus`：可售套餐模型
- `inventory_lots`：库存批次模型
- 支付成功自动扣减库存
- 退款自动回补库存
- 订单创建会校验可售库存

### 安全基础

- JWT + bcrypt
- 基础限流
- 写接口 Origin / Referer 防护
- 安全响应头
- 输入清洗与长度限制

### 工程验证

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run verify`

---

## 4. 技术栈

| 层 | 技术 |
|---|---|
| 前端/全栈框架 | Next.js 16.1.6 |
| 视图库 | React 19.2.3 |
| 数据库 | PostgreSQL + `pg` |
| 测试数据库 | `pg-mem` |
| 认证 | `jose` + `bcryptjs` + OAuth/OpenID |
| 支付 | Stripe Checkout + PayPal Orders + Webhook |
| 邮件 | `nodemailer` |
| 状态管理 | Zustand |
| 样式 | CSS Modules |
| 测试 | Vitest |
| 校验 | ESLint + Next build |

---

## 5. 核心业务流程

### 用户流程

1. 进入游戏目录页浏览商品
2. 加入购物车
3. 在结账页填写游戏交付信息
4. 创建订单
5. 跳转 Stripe Checkout 或 PayPal 完成支付
6. 支付平台通过 webhook 或回跳确认推进订单
7. 成功页返回后，前端调用确认接口对账
8. 用户在个人中心查看订单状态

### 运营流程

1. 订单进入 `paid`
2. `admin` 或 `support` 在 `/admin` 查看订单
3. 派单给 `worker` 或 `support`
4. 被分配人员推进：`assigned -> delivering -> delivered`
5. `admin / support` 收尾推进到 `completed`
6. 如需售后，可推进到 `refunded` 并触发 Stripe 或 PayPal Refund

### 内容与增长流程

1. `admin` 在后台创建文章
2. 前台 `/news` 和游戏 SEO 区块读取已发布文章
3. `sitemap.xml` 自动收录内容页与商品页

### OAuth 登录流程

1. 用户在登录弹窗选择 Google / Discord / Steam
2. 浏览器跳转到 provider 授权页
3. provider 回调 `/api/auth/oauth/[provider]/callback`
4. 服务端验证 state、换取用户信息并自动创建或绑定本地账号
5. 回跳 `/auth/callback` 后写入本地 token 并恢复原页面

### 密码找回流程

1. 用户进入 `/forgot-password`
2. 提交邮箱，系统生成一次性重置 token
3. 如果 SMTP 已配置，系统发送重置链接
4. 用户带 token 打开同页面并设置新密码

### 邮箱验证码流程

1. 用户在登录或注册弹窗输入邮箱
2. 点击 `Send` 请求验证码
3. 服务端生成 6 位验证码并发送邮件
4. 注册时必须携带验证码
5. 登录时可以使用密码，或者直接使用验证码登录

---

## 6. 订单状态机

### 状态列表

| 状态 | 含义 |
|---|---|
| `pending_payment` | 订单已创建，等待支付 |
| `paid` | 已确认支付成功 |
| `assigned` | 已派单 |
| `delivering` | 正在交付 |
| `delivered` | 已交付 |
| `completed` | 已完成 |
| `payment_failed` | 支付失败 |
| `cancelled` | 未支付阶段取消 |
| `refunded` | 已退款 |

### 流转规则

- `pending_payment -> paid / cancelled / payment_failed`
- `payment_failed -> pending_payment / cancelled`
- `paid -> assigned / refunded`
- `assigned -> delivering / refunded`
- `delivering -> delivered / refunded`
- `delivered -> completed / refunded`

### 权限规则

| 角色 | 能力 |
|---|---|
| `user` | 下单、支付、查看自己的订单 |
| `worker` | 只能操作分配给自己的订单，且只能做 `assigned -> delivering -> delivered` |
| `support` | 查看全部订单、派单、推进大多数运营状态 |
| `admin` | 全部能力，可管理用户、商品、文章和汇率同步 |

---

## 7. 数据模型概览

### 主要数据表

- `users`
- `products`
- `product_spus`
- `product_skus`
- `inventory_lots`
- `orders`
- `order_items`
- `coupons`
- `affiliate_commissions`
- `order_status_logs`
- `exchange_rates`
- `content_articles`
- `password_reset_tokens`
- `risk_events`

### 关键补充说明

- `products.external_id`：兼容站外或原始商品标识
- `products`：当前前台兼容读模型，保留给现有页面和订单引用
- `product_spus`：统一商品主档，保存游戏、分类、平台、区服、稀有度、交付说明
- `product_skus`：具体售卖套餐，保存套餐名称、数量单位、价格、库存
- `inventory_lots`：批次库存，支持后续扩展为人工库存池/供应来源
- `orders`：保存支付、派单、交付、收货等字段
- `content_articles`：存储新闻/攻略内容
- `exchange_rates`：存储当前汇率快照
- `password_reset_tokens`：一次性密码重置 token
- `risk_events`：风险评分与请求环境信息

---

## 8. 本地开发要求

### Node.js

建议使用 Node.js 20 或更新版本。

### PostgreSQL

开发和生产环境都需要 PostgreSQL。

测试环境默认使用 `pg-mem`，所以跑测试时不需要手工启动 PostgreSQL。

---

## 9. PostgreSQL 本地准备

如果你本机还没有配置数据库，可以按下面的最小流程准备。

### 方式一：使用默认 `postgres` 用户

创建数据库：

```bash
createdb game_asset_exchange
```

或者：

```bash
psql -U postgres -c "CREATE DATABASE game_asset_exchange;"
```

### 方式二：创建项目专用用户

```bash
psql -U postgres
```

进入后执行：

```sql
CREATE USER game_asset_user WITH PASSWORD 'replace_me';
CREATE DATABASE game_asset_exchange OWNER game_asset_user;
GRANT ALL PRIVILEGES ON DATABASE game_asset_exchange TO game_asset_user;
```

然后使用下面这种连接串：

```env
DATABASE_URL=postgresql://game_asset_user:replace_me@127.0.0.1:5432/game_asset_exchange
```

### 验证数据库连接

```bash
psql "$DATABASE_URL" -c "SELECT NOW();"
```

如果能返回时间，说明数据库连接正常。

---

## 10. 环境变量

创建 `.env.local`：

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/game_asset_exchange
JWT_SECRET=replace-with-a-long-random-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000

STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
GOOGLE_CLIENT_ID=google_client_id
GOOGLE_CLIENT_SECRET=google_client_secret
DISCORD_CLIENT_ID=discord_client_id
DISCORD_CLIENT_SECRET=discord_client_secret
STEAM_API_KEY=
PAYPAL_CLIENT_ID=paypal_client_id
PAYPAL_CLIENT_SECRET=paypal_client_secret
PAYPAL_WEBHOOK_ID=wh_123456789
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=mailer@example.com
SMTP_PASS=replace-me
SMTP_SECURE=false
EMAIL_FROM=mailer@example.com

OPS_WEBHOOK_URL=https://example.com/webhook
EXCHANGE_RATE_API_URL=https://open.er-api.com/v6/latest/USD
```

### 必填

- `DATABASE_URL`
- `JWT_SECRET`
- `NEXT_PUBLIC_APP_URL`

### Stripe 必填（真实支付时）

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

### PayPal 必填（真实支付时）

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`

### PayPal Webhook 可选但强烈建议配置

- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_BASE_URL`

### OAuth 可选（启用对应 provider 时）

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `STEAM_API_KEY`（当前登录主链不强依赖，可选用于后续扩展）

### SMTP 可选（密码找回邮件时）

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_SECURE`
- `EMAIL_FROM`

未配置 SMTP 时：

- 密码找回接口仍然可用
- 但不会真正发信
- 服务端会输出跳过发送的日志

### 可选运营与汇率

- `OPS_WEBHOOK_URL`：支付成功后推送运营通知
- `EXCHANGE_RATE_API_URL`：覆盖默认汇率源

---

## 11. 安装与启动

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

应用会在首次启动时自动：

- 连接 PostgreSQL
- 建表
- 执行轻量迁移
- 初始化基础种子数据

---

## 12. 管理员初始化

项目内置了管理员初始化脚本：

```bash
npm run bootstrap:admin -- --email admin@example.com --password StrongPassword123 --username admin
```

执行后可以直接用该账号登录后台 `/admin`。

---

## 13. 支付联调

### 启动项目

```bash
npm run dev
```

### Stripe

```bash
stripe listen --forward-to localhost:3000/api/payments/webhook
```

Stripe CLI 会输出一个 webhook secret，把它填进：

```env
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### 测试支付流程

1. 创建订单
2. 跳转到 Stripe Checkout
3. 完成沙盒支付
4. 检查后台订单是否自动从 `pending_payment` 变成 `paid`

### PayPal

PayPal sandbox 需要先在开发者后台创建：

1. Sandbox App
2. Webhook
3. 绑定事件：
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`
   - `CHECKOUT.ORDER.APPROVED`

把后台给你的值填进：

```env
PAYPAL_CLIENT_ID=paypal_client_id
PAYPAL_CLIENT_SECRET=paypal_client_secret
PAYPAL_WEBHOOK_ID=wh_123456789
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
```

PayPal webhook 地址：

```text
http://localhost:3000/api/payments/paypal/webhook
```

测试流程：

1. 结账页选择 `PayPal`
2. 创建订单后跳转 PayPal approval 页面
3. 完成 sandbox 支付
4. 回跳 `/checkout` 后自动 capture 并确认订单
5. 检查后台订单是否自动变成 `paid`

---

## 14. OAuth 联调

Google callback：

```text
http://localhost:3000/api/auth/oauth/google/callback
```

Discord callback：

```text
http://localhost:3000/api/auth/oauth/discord/callback
```

Steam return URL：

```text
http://localhost:3000/api/auth/oauth/steam/callback
```

需要在各 provider 后台把上述地址加入允许回调列表。

## 15. 主要路由说明

### 前台页面

- `/[game]/[category]`：商品列表页
- `/[game]/product/[id]`：商品详情页
- `/search`：搜索页
- `/news`：文章列表页
- `/news/[slug]`：文章详情页
- `/forgot-password`：密码重置页
- `/admin`：运营后台

### 核心 API

- `GET /api/auth/oauth/:provider`
- `GET /api/auth/oauth/:provider/callback`
- `POST /api/auth/verification-code`
- `POST /api/orders`
- `GET /api/orders`
- `PUT /api/orders/:id/status`
- `POST /api/payments/create`
- `POST /api/payments/confirm`
- `POST /api/payments/webhook`
- `POST /api/payments/paypal/webhook`
- `GET /api/search`
- `GET /api/products/:game`
- `GET /api/products/:game/:id`
- `GET /api/articles`
- `GET /api/articles/:slug`
- `GET /api/currency-rates`

### 后台 API

- `GET /api/admin/orders`
- `PUT /api/admin/orders/:id/assign`
- `GET /api/admin/users`
- `PUT /api/admin/users/:id/role`
- `GET /api/admin/products`
- `POST /api/admin/products`
- `PUT /api/admin/products/:id`
- `DELETE /api/admin/products/:id`
- `GET /api/admin/articles`
- `POST /api/admin/articles`
- `PUT /api/admin/articles/:id`
- `DELETE /api/admin/articles/:id`
- `POST /api/admin/currency-rates/sync`
- `GET /api/admin/risk-events`

---

## 16. 密码重置说明

### 请求重置

```bash
curl -X POST http://localhost:3000/api/auth/password-reset/request \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3000' \
  -d '{"email":"user@example.com"}'
```

### 确认重置

```bash
curl -X POST http://localhost:3000/api/auth/password-reset/confirm \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3000' \
  -d '{"email":"user@example.com","token":"your-token","password":"newpassword123"}'
```

---

## 17. 汇率同步说明

### 读取当前汇率

```bash
curl http://localhost:3000/api/currency-rates
```

### 后台同步汇率

```bash
curl -X POST http://localhost:3000/api/admin/currency-rates/sync \
  -H 'Authorization: Bearer <admin-token>' \
  -H 'Origin: http://localhost:3000'
```

如果外部汇率源不可用，系统会自动回退到仓库中的静态基础汇率数据。

---

## 18. 风控说明

当前风控是基础版，主要用于把订单创建时的可疑信号落库，便于后台查看。

目前会记录：

- 订单总额
- 商品数量
- 是否缺失支付方式
- 是否带推广来源
- 请求 IP
- User-Agent
- 风险评分与原因

这不是成熟的反欺诈系统，但已经把“数据采集”和“后台可见性”这一步接上了。

---

## 19. 测试与校验

运行单元测试：

```bash
npm test
```

运行 lint：

```bash
npm run lint
```

运行生产构建：

```bash
npm run build
```

执行完整校验：

```bash
npm run verify
```

当前自动化测试覆盖：

- 下单与支付主链路
- PayPal 创建、确认与退款主链路
- OAuth 登录回调
- 邮箱验证码发送 / 注册 / 登录
- SPU / SKU / 库存同步
- 支付成功扣减库存与退款回补
- 订单派单与状态流转
- Stripe / PayPal 退款联动
- 搜索与商品详情 API
- 文章 API
- 后台商品管理
- 后台文章管理
- 密码重置流程
- Cross-site request 拦截

---

## 20. 目录结构

```text
app/
  api/
    admin/
    articles/
    auth/
    currency-rates/
    orders/
    payments/
    products/
    search/
  admin/
  checkout/
  forgot-password/
  news/
  search/
  [game]/
components/
lib/
store/
data/
scripts/
tests/
```

---

## 21. 已知限制

当前仍然存在这些明确限制：

- 前端筛选能力仍偏轻量
- 商品模型还没有完全升级成复杂 SPU/SKU/库存池
- 邮件系统只做了 SMTP 发送，不含完整模板、队列和投递重试
- 风控是基础版，不是专业反欺诈系统
- 内容后台是轻量实现，不是完整 CMS 工作流

---

## 22. 建议下一步

如果继续往可商用方向推进，优先级建议是：

1. 升级商品/库存模型
2. 增强后台内容工作流
3. 增加邮件模板、发送队列与通知中心
4. 加强反欺诈和支付风控
