# IGGM Game Marketplace — Full Stack

[English](#english) | [中文](#中文)

---

## English

A full-stack replication of the [IGGM](https://www.iggm.com/arc-raiders/items) game item marketplace, built with **Next.js 14** (App Router), **SQLite** database, **JWT** authentication, **Zustand** for state management, and **vanilla CSS Modules** with a dark gaming theme.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, SSR) |
| Database | SQLite (better-sqlite3) |
| Auth | JWT (jose) + bcryptjs |
| State | Zustand (localStorage persisted) |
| Styling | CSS Modules + CSS Custom Properties |
| Payments | Simulated (mock Stripe/PayPal) |
| i18n | 8 languages, 17 currencies |

### Pages

| Route | Description |
|-------|-------------|
| `/` | Homepage — hero, popular games, trust indicators |
| `/[game]/[category]` | Catalog — filters, product grid, SEO content |
| `/cart` | Cart — item table, coupon code, order summary |
| `/checkout` | Checkout — delivery info → payment → order (API) |
| `/dashboard` | Dashboard — real orders, profile settings (API) |
| `/affiliate` | Affiliate — real referral stats (API) |

### API Endpoints (13 routes)

| Category | Endpoints |
|----------|-----------|
| **Auth** | `POST register`, `POST login`, `GET me`, `PUT profile`, `PUT password` |
| **Products** | `GET /api/products/[game]` (filter, sort, search, paginate) |
| **Orders** | `POST/GET /api/orders`, `GET /api/orders/[id]`, `PUT /api/orders/[id]/status` |
| **Payments** | `POST create`, `POST confirm` (simulated) |
| **Affiliate** | `GET stats`, `GET commissions` |
| **Admin** | `GET orders`, `GET users` |

### Database

Auto-initialized SQLite with 6 tables: `users`, `products`, `orders`, `order_items`, `coupons`, `affiliate_commissions`. Products are seeded from JSON on first run. Default coupons: ARC8 (8%), WELCOME10 (10%), VIP15 (15%).

### Quick Start

```bash
npm install
npm run dev
# Open http://localhost:3000
# Database auto-created at data/iggm.db on first API request
```

### Project Structure

```
web/
├── app/
│   ├── layout.js              # Root layout
│   ├── page.js                # Homepage
│   ├── [game]/[category]/     # Dynamic catalog
│   ├── cart/                  # Shopping cart
│   ├── checkout/              # Checkout (→ API)
│   ├── dashboard/             # User dashboard (→ API)
│   ├── affiliate/             # Affiliate program (→ API)
│   └── api/                   # ← Backend API Routes
│       ├── auth/              # register, login, me, profile, password
│       ├── products/[game]/   # Product listing
│       ├── orders/            # Order CRUD
│       ├── payments/          # Payment simulation
│       ├── affiliate/         # Stats + commissions
│       └── admin/             # Orders + users (admin only)
├── lib/
│   ├── db.js                  # SQLite init + schema + seed
│   └── auth.js                # JWT + bcrypt + middleware
├── store/
│   ├── authStore.js           # Auth state (JWT, login/register)
│   ├── cartStore.js           # Cart state (persisted)
│   ├── currencyStore.js       # Currency selection
│   └── languageStore.js       # Language + translations
├── components/                # UI components
├── data/                      # Mock data + DB file
│   ├── iggm.db               # SQLite (auto-generated)
│   ├── games.json
│   ├── currencies.json
│   └── products/arc-raiders.json
└── next.config.mjs
```

---

## 中文

复刻 [IGGM](https://www.iggm.com/arc-raiders/items) 游戏道具交易平台**全栈**项目，使用 **Next.js 14**（App Router）、**SQLite** 数据库、**JWT** 认证、**Zustand** 状态管理、**原生 CSS Modules** 暗色游戏风格主题构建。

### 技术栈

| 层级 | 技术方案 |
|------|---------|
| 框架 | Next.js 14（App Router，支持 SSR） |
| 数据库 | SQLite（better-sqlite3） |
| 认证 | JWT（jose）+ bcryptjs 密码哈希 |
| 状态管理 | Zustand（localStorage 持久化） |
| 样式 | CSS Modules + CSS 自定义属性 |
| 支付 | 模拟支付（Stripe/PayPal 占位） |
| 国际化 | 8 种语言、17 种货币 |

### 页面路由

| 路由 | 说明 |
|------|-----|
| `/` | 首页 — 英雄区、热门游戏、信任指标 |
| `/[game]/[category]` | 商品目录 — 筛选器、商品网格、SEO 内容 |
| `/cart` | 购物车 — 商品列表、优惠券、订单摘要 |
| `/checkout` | 结账 — 填写信息 → 付款 → 创建真实订单（调用 API） |
| `/dashboard` | 用户中心 — 真实订单历史、个人资料设置（调用 API） |
| `/affiliate` | 推广联盟 — 真实推荐统计（调用 API） |

### API 接口（13 个路由）

| 分类 | 接口 |
|------|-----|
| **认证** | 注册、登录、获取用户、更新资料、修改密码 |
| **商品** | 商品列表（支持筛选/排序/搜索/分页） |
| **订单** | 创建订单、订单列表、订单详情、更新状态 |
| **支付** | 创建支付意向、确认支付（模拟） |
| **推广** | 推广统计、佣金历史 |
| **管理** | 所有订单、用户列表（管理员） |

### 数据库

SQLite 自动初始化，包含 6 个表：`users`、`products`、`orders`、`order_items`、`coupons`、`affiliate_commissions`。首次运行自动从 JSON 导入商品数据。默认优惠券：ARC8（8 折）、WELCOME10（9 折）、VIP15（85 折）。

### 快速启动

```bash
npm install
npm run dev
# 打开 http://localhost:3000
# 数据库文件 data/iggm.db 在首次 API 请求时自动创建
```

### 核心功能

- 🔐 用户注册/登录（JWT 认证，社交登录按钮占位）
- 🎮 10 款游戏，分类导航 + 超级菜单
- 🔍 多选筛选器 + 排序 + 实时搜索
- 🛒 购物车持久化，优惠券码（ARC8 / WELCOME10 / VIP15）
- 💳 模拟支付流程（创建订单 → 支付 → 确认）
- 📋 真实订单历史（从数据库读取）
- 👤 个人资料 + 密码修改（通过 API）
- 🤝 推广系统（10% 佣金，真实数据库记录）
- 💱 17 种货币实时换算
- 🌐 8 种语言国际化
- 📱 全响应式设计

### 业务流程

```
用户注册 → 浏览商品 → 加入购物车 → 填写游戏ID → 模拟付款
→ 订单创建(存DB) → 后台改状态 → 订单完结
```
