# IGGM Game Marketplace — Full Stack

[English](#english) | [中文](#中文)

---

## English

A full-stack replication of the [IGGM](https://www.iggm.com/arc-raiders/items) game item marketplace, built with **Next.js 14** (App Router), **SQLite** database, **JWT** authentication, **Zustand** for state management, and **vanilla CSS Modules** with a dark gaming theme.

### Project Completion Status

> **Overall Progress: ~70%** — Core transaction loop is functional. Frontend pages, backend APIs, admin panel, and i18n are complete. Remaining items are mostly production-hardening and advanced features.

#### ✅ Completed

| Module | Details |
|--------|---------|
| **Frontend Pages (8)** | Homepage, Catalog, Cart, Checkout, Dashboard, Affiliate, Admin, 404 |
| **Backend API (13 routes)** | Auth (register/login/me/profile/password), Products, Orders (CRUD), Payments (simulated), Affiliate (stats/commissions), Admin (orders/users) |
| **Database** | SQLite with 6 tables, auto-init, product seeding from JSON |
| **Authentication** | JWT + bcrypt, role-based access (user/admin) |
| **Admin Panel** | Stats dashboard, order management (status update), user management |
| **Cart System** | Add/remove/quantity, coupon codes (ARC8/WELCOME10/VIP15), localStorage persistence |
| **i18n** | English + 中文 (180+ translated keys), language persisted |
| **Currency** | 17 currencies with exchange rate conversion |
| **Responsive Design** | Mobile-first, all pages responsive |
| **SEO Content** | FAQ, guides, reviews, meta tags |
| **Dark Theme** | Full CSS custom properties design system |

#### ❌ Not Yet Completed

| Module | Priority | Details |
|--------|----------|---------|
| **Real Payment Integration** | 🔴 High | Currently simulated; need Stripe/PayPal SDK integration |
| **Email System** | 🔴 High | Registration verification, order notifications, password reset emails |
| **Global Search** | 🟡 Medium | Header search bar is placeholder; needs full-text search implementation |
| **Product Detail Page** | 🟡 Medium | Only list view exists; no individual product page (`/product/[id]`) |
| **Multi-Game Product Data** | 🟡 Medium | Only ARC Raiders has product data; other 9 games need items |
| **sitemap.xml / robots.txt** | 🟡 Medium | Dynamic sitemap generation for SEO |
| **Structured Data (JSON-LD)** | 🟡 Medium | Product/Review schema markup for Google rich snippets |
| **Open Graph / Twitter Cards** | 🟡 Medium | Social sharing preview images/metadata |
| **Password Reset** | 🟡 Medium | "Forgot password" flow (needs email system first) |
| **Real-time Order Updates** | 🟢 Low | WebSocket push for order status changes |
| **Rate Limiting** | 🟢 Low | API rate limiting for abuse prevention |
| **CSRF Protection** | 🟢 Low | Cross-site request forgery prevention |
| **Input Sanitization** | 🟢 Low | Deep XSS prevention beyond basic validation |
| **Environment Variables** | 🟢 Low | JWT secret hardcoded; move to `.env` |
| **Production Database** | 🟢 Low | SQLite → PostgreSQL/MySQL for production |
| **Live Chat Integration** | 🟢 Low | Tawk.to/Intercom integration (button is placeholder) |
| **Product Images** | 🟢 Low | Using CSS gradients; need real images or CDN |

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, SSR) |
| Database | SQLite (better-sqlite3) |
| Auth | JWT (jose) + bcryptjs |
| State | Zustand (localStorage persisted) |
| Styling | CSS Modules + CSS Custom Properties |
| Payments | Simulated (mock Stripe/PayPal) |
| i18n | 2 languages (EN/ZH), 17 currencies |

### Pages

| Route | Description |
|-------|-------------|
| `/` | Homepage — hero, popular games, trust indicators |
| `/[game]/[category]` | Catalog — filters, product grid, SEO content |
| `/cart` | Cart — item table, coupon code, order summary |
| `/checkout` | Checkout — delivery info → payment → order creation (API) |
| `/dashboard` | Dashboard — real order history, profile settings (API) |
| `/affiliate` | Affiliate — real referral stats & commissions (API) |
| `/admin` | Admin — stats, order management, user management (admin-only) |

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
│   ├── admin/                 # Admin panel (→ API)
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
│   ├── translations/          # en.json, zh.json
│   └── products/arc-raiders.json
└── next.config.mjs
```

---

## 中文

复刻 [IGGM](https://www.iggm.com/arc-raiders/items) 游戏道具交易平台**全栈**项目，使用 **Next.js 14**（App Router）、**SQLite** 数据库、**JWT** 认证、**Zustand** 状态管理、**原生 CSS Modules** 暗色游戏风格主题构建。

### 项目完成度

> **整体进度：约 70%** — 核心交易闭环已实现。前端页面、后端 API、管理后台、国际化均已完成。剩余部分主要是生产环境加固和高级功能。

#### ✅ 已完成

| 模块 | 详情 |
|------|------|
| **前端页面（8 个）** | 首页、商品目录、购物车、结算、用户中心、推广联盟、管理后台、404 |
| **后端 API（13 个路由）** | 认证（注册/登录/信息/资料/密码）、商品、订单（增删改查）、支付（模拟）、推广（统计/佣金）、管理（订单/用户） |
| **数据库** | SQLite 6 张表，自动初始化，从 JSON 导入商品 |
| **认证系统** | JWT + bcrypt 密码哈希，角色权限（user/admin） |
| **管理后台** | 统计看板、订单管理（状态更新）、用户管理 |
| **购物车** | 增删改数量、优惠券码（ARC8/WELCOME10/VIP15）、本地存储持久化 |
| **国际化** | 英文 + 中文（180+ 翻译键值）、语言选择持久化 |
| **多币种** | 17 种货币汇率换算 |
| **响应式设计** | 移动端适配 |
| **SEO 内容** | FAQ、攻略、评价、meta 标签 |
| **暗色主题** | 完整 CSS 自定义属性设计系统 |

#### ❌ 待完成

| 模块 | 优先级 | 详情 |
|------|--------|------|
| **真实支付集成** | 🔴 高 | 目前为模拟支付，需接入 Stripe/PayPal SDK |
| **邮件系统** | 🔴 高 | 注册验证码、订单通知、密码重置邮件 |
| **全站搜索** | 🟡 中 | Header 搜索框为占位符，需实现全文搜索 |
| **商品详情页** | 🟡 中 | 目前只有列表页，没有单独商品详情页 |
| **多游戏商品数据** | 🟡 中 | 仅 ARC Raiders 有商品数据，其他 9 款游戏需补充 |
| **sitemap.xml / robots.txt** | 🟡 中 | 动态 sitemap 生成 |
| **结构化数据 (JSON-LD)** | 🟡 中 | 商品/评价 schema 标记 |
| **Open Graph / Twitter Cards** | 🟡 中 | 社交分享预览 |
| **密码找回** | 🟡 中 | "忘记密码" 流程（需邮件系统） |
| **订单实时推送** | 🟢 低 | WebSocket 订单状态变更通知 |
| **API 限流** | 🟢 低 | 防止滥用的速率限制 |
| **CSRF 防护** | 🟢 低 | 跨站请求伪造防护 |
| **输入清洗** | 🟢 低 | 深度 XSS 防护 |
| **环境变量** | 🟢 低 | JWT 密钥硬编码，需迁移到 `.env` |
| **生产数据库** | 🟢 低 | SQLite → PostgreSQL/MySQL |
| **在线客服** | 🟢 低 | Tawk.to/Intercom 集成（按钮为占位） |
| **商品图片** | 🟢 低 | 目前用 CSS 渐变，需真实图片或 CDN |

### 技术栈

| 层级 | 技术方案 |
|------|---------|
| 框架 | Next.js 14（App Router，支持 SSR） |
| 数据库 | SQLite（better-sqlite3） |
| 认证 | JWT（jose）+ bcryptjs 密码哈希 |
| 状态管理 | Zustand（localStorage 持久化） |
| 样式 | CSS Modules + CSS 自定义属性 |
| 支付 | 模拟支付（Stripe/PayPal 占位） |
| 国际化 | 2 种语言（EN/ZH）、17 种货币 |

### 快速启动

```bash
npm install
npm run dev
# 打开 http://localhost:3000
# 数据库文件 data/iggm.db 在首次 API 请求时自动创建
```

### 核心业务流程

```
用户注册 → 浏览商品 → 加入购物车 → 填写游戏ID → 模拟付款
→ 订单创建(存DB) → 管理后台改状态 → 订单完结
```

### 核心功能

- 🔐 用户注册/登录（JWT 认证）
- 🎮 10 款游戏导航 + 超级菜单
- 🔍 多选筛选器 + 排序 + 搜索
- 🛒 购物车持久化 + 优惠券码
- 💳 模拟支付流程（创建订单 → 支付 → 确认）
- 📋 真实订单历史（数据库读取）
- 👤 个人资料 + 密码修改
- 🤝 推广系统（10% 佣金）
- ⚙️ 管理后台（订单管理 + 用户管理）
- 💱 17 种货币实时换算
- 🌐 英文 + 中文切换
- 📱 全响应式设计
