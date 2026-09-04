# Technical Specification — Part 1: Architecture & Tech Stack

## 1.1 Project Overview

CustomsDuty Pro is an enterprise-grade web application for calculating, assessing, and managing Ethiopian customs duties. It serves three primary actors: Importers (public self-service), Valuation Officers (assessment approval), and Tariff Specialists/Admins (system configuration).

## 1.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                      │
│              Next.js 14+ (App Router)                    │
│   Public Calculator | Officer Workspace | Admin Panel    │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS (REST + JSON)
                       ▼
┌─────────────────────────────────────────────────────────┐
│                 API GATEWAY / SERVER                      │
│               Hono.js (on Node.js)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ Auth     │ │ Tax      │ │ Assess   │ │ Admin      │  │
│  │ Module   │ │ Engine   │ │ Module   │ │ Module     │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ PDF Gen  │ │ QR Gen   │ │ Audit    │ │ Notif.     │  │
│  │ Module   │ │ Module   │ │ Module   │ │ Module     │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │
└───────┬──────────────┬─────────────────┬────────────────┘
        │              │                 │
        ▼              ▼                 ▼
┌──────────────┐ ┌───────────┐ ┌─────────────────┐
│  PostgreSQL  │ │   Redis   │ │  File Storage   │
│  (Primary DB)│ │  (Cache)  │ │  (PDFs, Docs)   │
└──────────────┘ └───────────┘ └─────────────────┘
```

## 1.3 Tech Stack

| Layer              | Technology                          | Purpose                              |
|--------------------|-------------------------------------|--------------------------------------|
| Frontend           | Next.js 14+ (App Router)            | SSR/CSR hybrid UI                    |
| UI Components      | shadcn/ui + Tailwind CSS            | Enterprise-grade component library   |
| Forms              | React Hook Form + Zod               | Type-safe validation                 |
| State Management   | TanStack Query (React Query)        | Server state / caching               |
| Backend            | Hono.js (Node.js runtime)           | Lightweight, fast HTTP framework     |
| ORM                | Drizzle ORM                         | Type-safe SQL with migration support |
| Database           | PostgreSQL 16+                       | Primary relational database          |
| Cache              | Redis 7+                            | Session cache, rate limiting         |
| Auth               | JWT (access + refresh tokens)       | Stateless authentication             |
| Password Hashing   | bcrypt (12 rounds)                  | Secure password storage              |
| PDF Generation     | @react-pdf/renderer (server)        | Official assessment PDFs             |
| QR Codes           | qrcode (npm) + jose (JWT signing)   | Signed QR codes for verification     |
| Email              | Resend (or Nodemailer)              | Transactional notifications          |
| Validation         | Zod (shared client + server)        | Unified schema validation            |
| Testing            | Vitest (unit/integration)           | Test framework                       |
| E2E Testing        | Playwright                          | Browser automation                   |
| Containerization   | Docker + Docker Compose             | Local dev & deployment               |
| CI/CD              | GitHub Actions                      | Automated pipeline                   |

## 1.4 Project Structure

```
customs-duty-pro/
├── apps/
│   ├── web/                          # Next.js frontend
│   │   ├── app/
│   │   │   ├── (public)/             # Public routes (calculator, verify)
│   │   │   ├── (auth)/               # Login, register
│   │   │   ├── (dashboard)/          # Protected dashboard routes
│   │   │   │   ├── officer/          # Officer workspace
│   │   │   │   ├── admin/            # Admin panel
│   │   │   │   └── settings/         # HS codes, forex, users
│   │   │   └── api/                  # Next.js API routes (if any proxy needed)
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn/ui base components
│   │   │   ├── calculator/           # Calculator-specific components
│   │   │   ├── dashboard/            # Dashboard components
│   │   │   ├── assessment/           # Assessment form & display
│   │   │   └── shared/               # Shared/reusable components
│   │   ├── lib/
│   │   │   ├── validations/          # Zod schemas (shared with backend)
│   │   │   ├── api-client.ts         # Typed API client
│   │   │   └── utils.ts              # Utility functions
│   │   └── hooks/                    # Custom React hooks
│   │
│   └── api/                          # Hono backend
│       ├── src/
│       │   ├── index.ts              # Entry point
│       │   ├── app.ts                # Hono app setup
│       │   ├── routes/
│       │   │   ├── auth.ts           # /api/auth/*
│       │   │   ├── calculator.ts     # /api/calculate
│       │   │   ├── assessments.ts    # /api/assessments/*
│       │   │   ├── hs-codes.ts       # /api/hs-codes/*
│       │   │   ├── forex.ts          # /api/forex/*
│       │   │   ├── users.ts          # /api/users/*
│       │   │   ├── audit.ts          # /api/audit/*
│       │   │   └── verify.ts         # /api/verify/:hash
│       │   ├── middleware/
│       │   │   ├── auth.ts           # JWT verification
│       │   │   ├── rbac.ts           # Role-based access control
│       │   │   ├── rate-limit.ts     # Rate limiting
│       │   │   ├── validate.ts       # Request validation
│       │   │   └── audit-log.ts      # Auto audit logging
│       │   ├── modules/
│       │   │   ├── tax-engine/       # Core calculation logic
│       │   │   │   ├── calculator.ts
│       │   │   │   ├── exemptions.ts
│       │   │   │   └── calculator.test.ts
│       │   │   ├── auth/
│       │   │   │   ├── jwt.ts
│       │   │   │   ├── sessions.ts
│       │   │   │   └── password.ts
│       │   │   ├── pdf/
│       │   │   │   ├── generator.ts
│       │   │   │   └── template.tsx
│       │   │   ├── qr/
│       │   │   │   ├── signer.ts
│       │   │   │   └── generator.ts
│       │   │   └── notifications/
│       │   │       ├── email.ts
│       │   │       └── sms.ts
│       │   ├── db/
│       │   │   ├── schema/           # Drizzle schema definitions
│       │   │   ├── migrations/       # Versioned migrations
│       │   │   ├── seed.ts           # Seed script
│       │   │   └── index.ts          # DB connection
│       │   └── lib/
│       │       ├── errors.ts         # Custom error classes
│       │       ├── logger.ts         # Structured logging
│       │       ├── config.ts         # Environment config
│       │       └── idempotency.ts    # Idempotency key handling
│       └── drizzle.config.ts
│
├── packages/
│   └── shared/                       # Shared types & validation schemas
│       ├── src/
│       │   ├── schemas/              # Zod schemas used by both client & server
│       │   │   ├── assessment.ts
│       │   │   ├── hs-code.ts
│       │   │   ├── forex.ts
│       │   │   └── auth.ts
│       │   ├── types/                # TypeScript type definitions
│       │   └── constants/            # Shared constants (tax rates, roles, etc.)
│       └── package.json
│
├── docker/
│   ├── Dockerfile.api                # API container
│   ├── Dockerfile.web                # Frontend container
│   └── docker-compose.yml            # Full local environment
│
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint, test, typecheck
│       └── deploy.yml                # Deployment pipeline
│
├── turbo.json                        # Turborepo config (monorepo)
├── package.json                      # Root workspace config
└── .env.example                      # Environment variables template
```

## 1.5 Monorepo Strategy

Use **Turborepo** with pnpm workspaces to manage:
- `apps/web` — Next.js frontend
- `apps/api` — Hono backend
- `packages/shared` — Shared Zod schemas, types, and constants

This ensures **single source of truth** for validation schemas and type definitions between client and server.

## 1.6 Environment Configuration

| Variable                  | Description                         | Required |
|---------------------------|-------------------------------------|----------|
| `DATABASE_URL`            | PostgreSQL connection string        | Yes      |
| `REDIS_URL`               | Redis connection string             | Yes      |
| `JWT_ACCESS_SECRET`       | Access token signing secret         | Yes      |
| `JWT_REFRESH_SECRET`      | Refresh token signing secret        | Yes      |
| `JWT_ACCESS_EXPIRY`       | Access token lifetime (default 15m) | No       |
| `JWT_REFRESH_EXPIRY`      | Refresh token lifetime (default 7d) | No       |
| `QR_SIGNING_KEY`          | QR code JWT signing key             | Yes      |
| `SMTP_HOST`               | Email server host                   | No       |
| `SMTP_PORT`               | Email server port                   | No       |
| `SMTP_USER`               | Email server user                   | No       |
| `SMTP_PASS`               | Email server password               | No       |
| `NODE_ENV`                | development / staging / production  | Yes      |
| `PORT`                    | API server port (default 3001)      | No       |
| `CORS_ORIGIN`             | Allowed frontend origin             | Yes      |
| `LOG_LEVEL`               | debug / info / warn / error         | No       |
| `SCANNING_FEE_FLAT_ETB`   | Flat admin/scanning fee (default 200)| No      |
