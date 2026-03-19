# IGGM-Style Game Asset Exchange

English summary: this repository is a Next.js 16 full-stack marketplace prototype for game assets. It now includes a real Stripe checkout flow, webhook-driven payment confirmation, staff order operations, searchable catalog pages backed by PostgreSQL, product detail pages, admin-side product management, and SEO-supporting routes such as `robots.txt`, `sitemap.xml`, page metadata, and JSON-LD.

---

## 中文

### 1. 项目介绍

这是一个仿 IGGM 交易站业务模型的全栈原型，目标是承载下面这条闭环：

`浏览商品 -> 加入购物车 -> 填写游戏交付信息 -> 法币支付 -> 平台确认收款 -> 运营派单 -> 人工游戏内交付 -> 订单完结`

当前仓库已经不是“前端静态复刻”或“模拟支付 demo”。

它现在具备：

- 真实 Stripe Checkout 支付链路
- Stripe Webhook 支付确认
- 用户下单、支付、查看订单
- `admin / support / worker / user` 角色体系
- 后台派单、推进订单状态、退款
- 后台商品管理
- 数据库驱动的商品目录页
- 商品详情页
- Header 全站搜索结果面板
- 独立搜索页
- 动态 `sitemap.xml` / `robots.txt`
- 页面级 metadata 和 JSON-LD
- 自动化测试、lint、build 验证

### 2. 当前项目定位

更准确的定位是：

- 一个 **后端优先完善后的交易平台原型**
- 前台仍保留 IGGM 风格的浏览体验
- 运营流程、支付链路、SEO 基础设施已经接上
- 还没有接入的内容，主要剩下 **外部服务型能力**

当前仍未完成或只做了基础版的部分：

- PayPal 真接入
- 邮件发送、验证码、找回密码邮件
- Steam / Discord / Google OAuth
- 实时客服通知机器人
- 设备指纹 / 高级风控
- CMS 内容管理后台
- 实时汇率同步服务

也就是说，仓库里“本地可开发完成”的高价值部分，已经基本补到位；剩余缺口主要依赖第三方账号、外部 API 凭据或更重的运营系统扩展。

---

## 3. 已实现能力

### 前台

- 首页
- 游戏目录页 `/[game]/[category]`
- 购物车 `/cart`
- 结账页 `/checkout`
- 用户中心 `/dashboard`
- 推广页 `/affiliate`
- 搜索页 `/search`
- 商品详情页 `/[game]/product/[id]`
- Header 即时搜索结果

### 后端业务

- JWT 登录注册
- 资料修改 / 密码修改
- PostgreSQL 自动建表 + 自动迁移
- 订单创建
- Stripe Checkout 会话创建
- Stripe Webhook 验签
- 支付成功后订单推进到 `paid`
- 订单状态机约束
- 派单
- 订单状态日志
- Stripe 退款联动
- 商品管理 API
- 搜索 API
- 商品详情 API

### 运营后台

- 查看订单
- 查看用户
- 修改用户角色
- 派单给 `support / worker`
- 推进订单状态
- 管理商品：新增 / 编辑 / 删除

### SEO 与可索引性

- Next.js App Router
- 页面级 metadata
- 商品详情页 JSON-LD
- 动态 `robots.txt`
- 动态 `sitemap.xml`
- 商品详情页可索引 URL

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
| 认证 | jose + bcryptjs |
| 支付 | Stripe Checkout + Webhook |
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
5. 跳转 Stripe Checkout 完成支付
6. Stripe 回调通知平台支付成功
7. 前端从支付成功页返回后调用确认接口对账
8. 用户在个人中心查看订单状态

### 运营流程

1. 订单进入 `paid`
2. `admin` 或 `support` 在 `/admin` 查看订单
3. 派单给 `worker` 或 `support`
4. 被分配人员推进：
   - `assigned -> delivering -> delivered`
5. `admin / support` 收尾推进到 `completed`
6. 如需售后，可推进到 `refunded` 并触发 Stripe Refund

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
| `admin` | 全部能力，且可管理用户角色和商品 |

---

## 7. 数据模型概览

### 核心表

- `users`
- `products`
- `orders`
- `order_items`
- `coupons`
- `affiliate_commissions`
- `order_status_logs`

### `products` 关键字段

- `id`
- `external_id`
- `game_slug`
- `category`
- `sub_category`
- `name`
- `description`
- `price`
- `original_price`
- `discount`
- `in_stock`
- `image`

`external_id` 的作用：

- 保留原始商品标识
- 支持 `/[game]/product/[external_id]` 这样的详情页路由
- 兼容旧数据时会自动回填 ARC Raiders 的历史 JSON 商品 ID

### `orders` 关键字段

- 游戏交付：`embark_id`, `character_name`, `delivery_email`, `delivery_contact`, `delivery_platform`, `delivery_server`
- 支付信息：`payment_provider`, `payment_id`, `payment_session_id`, `payment_reference`, `payment_status`
- 运营信息：`assigned_to`, `assigned_at`, `assigned_by`, `delivered_at`, `completed_at`, `last_status_changed_at`

### `order_status_logs`

记录：

- 订单创建
- 创建支付会话
- 派单
- 状态推进
- 支付确认
- 退款等操作

这保证了订单不是只靠 `orders.status` 单字段覆盖更新，而是有最基础的审计轨迹。

---

## 8. 主要页面

| 路由 | 说明 |
|---|---|
| `/` | 首页 |
| `/[game]/[category]` | 商品目录页，已接数据库商品数据 |
| `/[game]/product/[id]` | 商品详情页，支持数值 ID 和 `external_id` |
| `/search?q=keyword` | 独立搜索页 |
| `/cart` | 购物车 |
| `/checkout` | 结账与支付入口 |
| `/dashboard` | 用户中心 / 历史订单 |
| `/affiliate` | 推广佣金页 |
| `/admin` | 运营后台 |

---

## 9. 主要 API

### 鉴权

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PUT /api/auth/profile`
- `PUT /api/auth/password`

### 商品与搜索

- `GET /api/products/[game]`
- `GET /api/products/[game]/[id]`
- `GET /api/search?q=keyword&limit=10`

### 订单

- `POST /api/orders`
- `GET /api/orders`
- `GET /api/orders/[id]`
- `PUT /api/orders/[id]/status`

### 支付

- `POST /api/payments/create`
- `POST /api/payments/confirm`
- `POST /api/payments/webhook`

### 运营后台

- `GET /api/admin/orders`
- `PUT /api/admin/orders/[id]/assign`
- `GET /api/admin/users`
- `PUT /api/admin/users/[id]/role`
- `GET /api/admin/products`
- `POST /api/admin/products`
- `PUT /api/admin/products/[id]`
- `DELETE /api/admin/products/[id]`

### 推广

- `GET /api/affiliate/stats`
- `GET /api/affiliate/commissions`

---

## 10. 目录结构

```text
app/
  [game]/[category]/              数据库驱动的目录页
  [game]/product/[id]/            商品详情页
  admin/                          运营后台
  api/                            所有服务端 API
  cart/ checkout/ dashboard/      核心交易页面
  search/                         独立搜索页
  robots.js                       动态 robots.txt
  sitemap.js                      动态 sitemap.xml

components/
  Header.js                       已接全站搜索结果面板
  ProductCard.js                  商品卡片，支持跳转详情页
  SeoContent.js                   SEO 内容区

data/
  games.json
  products/arc-raiders.json

lib/
  auth.js                         JWT / 权限
  catalog.js                      服务端商品读取
  catalog-shared.js               客户端共享商品路径/图标工具
  db.js                           PostgreSQL 初始化与迁移
  orders.js                       订单状态机与日志
  payments/stripe.js              Stripe 封装
  rate-limit.js                   限流
  request-security.js             基础跨站请求防护
  validation.js                   输入清洗

scripts/
  bootstrap-admin.mjs             管理员初始化脚本

tests/
  lib.test.js
  api-read.test.js
  order-flow.test.js
  admin-products.test.js
```

---

## 11. 本地启动

### 1. 安装依赖

```bash
npm install
```

### 2. 准备环境变量

```bash
cp .env.example .env.local
```

至少配置：

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/game_asset_exchange
JWT_SECRET=replace-with-a-long-random-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

可选：

```env
APP_URL=http://localhost:3000
```

说明：

- `DATABASE_URL` 是 PostgreSQL 连接串，开发和生产都必需
- `JWT_SECRET` 部署前必须设置真实随机值
- `APP_URL` 可作为 `NEXT_PUBLIC_APP_URL` 的后备

### 3. 启动开发环境

```bash
npm run dev
```

---

## 12. PostgreSQL 本地准备

如果你本机已经有 PostgreSQL，可以直接跳到下面的“创建数据库”。

### macOS 常见准备方式

如果你用 Homebrew：

```bash
brew install postgresql@16
brew services start postgresql@16
```

确认 PostgreSQL 已启动：

```bash
pg_isready
```

### 创建数据库

最简单方式：

```bash
createdb game_asset_exchange
```

如果你要显式指定用户：

```bash
createdb -U postgres game_asset_exchange
```

### 手动创建用户和授权

如果你不想直接使用默认 `postgres` 用户，可以进入 `psql`：

```bash
psql postgres
```

然后执行：

```sql
CREATE ROLE game_asset_user WITH LOGIN PASSWORD 'change-this-password';
CREATE DATABASE game_asset_exchange OWNER game_asset_user;
GRANT ALL PRIVILEGES ON DATABASE game_asset_exchange TO game_asset_user;
```

### `DATABASE_URL` 示例

使用默认本地用户：

```env
DATABASE_URL=postgresql://postgres@127.0.0.1:5432/game_asset_exchange
```

使用独立账号：

```env
DATABASE_URL=postgresql://game_asset_user:change-this-password@127.0.0.1:5432/game_asset_exchange
```

### 连接验证

可以先手工验证数据库能否连通：

```bash
psql "$DATABASE_URL" -c "SELECT NOW();"
```

### 应用初始化说明

项目首次连接 PostgreSQL 时会自动：

- 创建核心表
- 执行缺失字段迁移
- 写入基础商品和优惠券种子数据

你不需要再单独手动跑迁移脚本。

### 管理员初始化前提

在运行管理员初始化脚本前，必须先确保：

- PostgreSQL 已启动
- `DATABASE_URL` 已正确配置
- 对应数据库已经创建

然后再执行：

```bash
npm run bootstrap:admin -- --email admin@example.com --password StrongPassword123 --username admin
```

---

## 13. Stripe 本地联调

### 1. 启动本地站点

```bash
npm run dev
```

### 2. 本地转发 webhook

```bash
stripe listen --forward-to localhost:3000/api/payments/webhook
```

CLI 会输出一个 `whsec_...`，把它填进：

```env
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### 3. 使用 Stripe 测试卡支付

测试支付完成后：

- Stripe webhook 会推进订单到 `paid`
- 站点返回页会调用 `/api/payments/confirm`
- 后台 `/admin` 可以继续派单和推进状态

---

## 14. 初始化管理员账号

```bash
npm run bootstrap:admin -- --email admin@example.com --password StrongPassword123 --username admin
```

脚本会：

- 创建管理员账号
- 如果邮箱已存在则直接提升为 `admin`
- 运行前必须先配置 `DATABASE_URL`

---

## 15. 商品管理使用方式

### 后台商品管理

管理员进入 `/admin`，切换到 `Product Management` 标签后可以：

- 新建商品
- 编辑现有商品
- 删除未被订单引用的商品
- 按关键字刷新商品列表

### 前台商品联动

后台创建或编辑的商品会直接影响：

- 目录页 `/[game]/[category]`
- Header 搜索结果
- 搜索页 `/search`
- 商品详情页 `/[game]/product/[id]`
- `sitemap.xml`

这意味着商品数据不再只来自静态 JSON，而是以数据库为准。

---

## 16. 搜索使用方式

### Header 搜索

- 输入 2 个以上字符后会拉取 `/api/search`
- 结果同时显示游戏和商品
- 点击结果会进入游戏目录或商品详情
- 提交搜索会进入 `/search?q=...`

### 搜索页

`/search?q=arc`

页面会展示：

- 游戏匹配结果
- 商品匹配结果
- 商品快速入口和卡片

---

## 17. 测试与校验

### 运行测试

```bash
npm test
```

### 运行 lint

```bash
npm run lint
```

### 运行生产构建

```bash
npm run build
```

### 运行完整校验

```bash
npm run verify
```

当前自动化测试覆盖：

- 文本清洗与输入校验
- 购物车商品入参清洗
- 订单状态机权限与流转
- 下单和 Stripe 支付会话创建
- 支付确认
- 派单
- 退款
- 搜索 API
- 商品详情 API
- 跨站写请求拦截
- 管理员商品新增 / 编辑 / 删除

说明：

- 测试默认使用 `pg-mem`，不需要你本地先启动真实 PostgreSQL
- 开发和生产环境使用真实 PostgreSQL

---

## 18. 生产部署注意事项

- 必须配置 `JWT_SECRET`
- 必须配置真实 Stripe 密钥和 webhook secret
- 必须配置可连接的 PostgreSQL，并做好备份、连接池和权限控制
- 必须在 HTTPS 下部署
- 如果后续要接 PayPal、OAuth、邮件，需要分别补充对应环境变量与回调地址

---

## 19. 当前仍然未做的部分

这部分不是仓库遗漏，而是需要继续扩展或依赖外部服务：

- PayPal 支付
- Steam / Discord / Google OAuth
- 邮件验证码与找回密码邮件
- CMS 内容管理后台
- 实时汇率同步
- Slack / Discord / 企业微信派单通知
- 设备指纹 / IP 风控 / 反欺诈评分
- 聊天系统 / 交付截图上传

---

## 20. 本轮补充完成的重点

这轮新增和完善的高价值内容包括：

- 数据库驱动的目录页，不再只依赖本地 JSON 展示
- 商品详情页
- Header 搜索结果面板
- 独立搜索页
- 商品 `external_id` 支持与历史数据回填
- 管理员商品管理 API
- 管理后台商品管理页
- 页面级 metadata 与商品 JSON-LD
- `sitemap.xml` 自动收录商品页
- PostgreSQL 数据层替换与异步查询重构
- 新增管理员商品管理测试

---

## 21. 已验证结果

本次代码更新后，已实际执行并通过：

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run verify`

构建时如果本地没有配置 `JWT_SECRET`，会看到警告：

`JWT_SECRET is not configured. Using an insecure fallback secret`

这是为了便于本地构建保留的开发兜底。

部署环境必须配置真实值，不能使用 fallback。
