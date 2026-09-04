# Technical Specification — Part 7: Testing, DevOps & Implementation Plan

## 7.1 Testing Strategy

### 7.1.1 Unit Tests (Vitest)

**Tax Engine Tests** — highest priority, most critical business logic:

| Test Category              | Example Cases                                          |
|---------------------------|--------------------------------------------------------|
| CIF Calculation           | Single item, multiple items, zero freight/insurance     |
| Duty Calculation          | 0%, 5%, 10%, 20%, 35% rates                           |
| Excise Calculation        | Zero excise, 10% (standard), 30% (vehicles), 100%+     |
| VAT Calculation           | Standard 15%, zero-rated items                          |
| Sur-Tax Calculation       | Standard 10%, zero-rated items                          |
| Withholding               | Standard 3%, diplomatic exemption                       |
| Exemption: DIASPORA       | Eligible items (duty+excise+vat+surtax waived)          |
| Exemption: DIASPORA       | Non-eligible items (full tax applies)                   |
| Exemption: INVESTMENT     | Capital goods (duty+surtax waived)                      |
| Exemption: INVESTMENT     | Non-capital goods (full tax applies)                    |
| Exemption: DIPLOMATIC     | Everything zero except scanning fee                     |
| Mixed items               | Items with different HS codes, mixed exemptions         |
| Edge: Minimum duty floor  | Duty below floor -> bumped to floor                     |
| Edge: Rounding            | Verify 2-decimal rounding at each step                  |
| Edge: Zero quantity       | Should throw validation error                           |
| Edge: Negative values     | Should throw validation error                           |
| Edge: Very large amounts  | ETB 100M+ values without precision loss                 |
| Rate overrides            | Active override changes rate correctly                   |
| Rate overrides            | Expired override does NOT apply                          |
| Rate overrides            | Overlapping overrides use most recent                    |

**Auth Tests:**
- Login success/failure paths
- Account lockout after N failures
- Token generation and refresh flow
- Refresh token rotation (single-use enforcement)
- Password change invalidates all refresh tokens

**RBAC Tests:**
- Each role can access permitted endpoints
- Each role is blocked from non-permitted endpoints
- Ownership checks (importer can only see their assessments)
- Admin can see all assessments

### 7.1.2 Integration Tests

| Area                  | Tests                                                  |
|-----------------------|--------------------------------------------------------|
| Full API flow         | Register -> Login -> Create assessment -> Submit -> Approve -> Download PDF -> Verify QR |
| Database constraints  | Unique constraint violations, foreign key enforcement  |
| Audit logging         | Verify audit records created for state changes         |
| Rate limiting         | Verify 429 after threshold exceeded                    |
| Idempotency           | Duplicate submission key returns same response         |
| Forex rate locking    | Assessment uses rate at time of submission              |

### 7.1.3 E2E Tests (Playwright)

| Flow                            | Assertions                                     |
|---------------------------------|------------------------------------------------|
| Public calculator               | Enter HS code, verify real-time calculation     |
| Registration & login            | Complete auth flow, reach dashboard              |
| Officer approves assessment     | Full review -> approve -> PDF download           |
| QR verification scan            | Scan QR -> correct status displayed              |
| Admin manages HS codes          | Add, edit, verify search results                 |
| Admin manages users             | Create officer, verify login works               |
| Mobile responsiveness           | Calculator works on 375px viewport               |

## 7.2 DevOps & Infrastructure

### 7.2.1 Docker Compose (Local Development)

```yaml
# docker-compose.yml
services:
  api:
    build:
      context: .
      dockerfile: docker/Dockerfile.api
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://postgres:password@db:5432/customs_duty
      REDIS_URL: redis://redis:6379
      JWT_ACCESS_SECRET: dev-access-secret-change-in-prod
      JWT_REFRESH_SECRET: dev-refresh-secret-change-in-prod
      QR_SIGNING_KEY: dev-qr-signing-key-change-in-prod
      CORS_ORIGIN: http://localhost:3000
      NODE_ENV: development
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy

  web:
    build:
      context: .
      dockerfile: docker/Dockerfile.web
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001/api/v1
    depends_on:
      - api

  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: customs_duty
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### 7.2.2 CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm run typecheck

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: customs_duty_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: password
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run test:unit
      - run: pnpm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:password@localhost:5432/customs_duty_test
          REDIS_URL: redis://localhost:6379

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build
      - run: pnpm run test:e2e
```

### 7.2.3 Deployment Architecture

```
┌──────────────────────────────────────────────┐
│                  NGINX                        │
│            (Reverse Proxy / SSL)              │
│   customs.gov.et → port 443                   │
├──────────────────┬───────────────────────────┤
│                  │                             │
│  Static Assets   │  API Proxy                  │
│  (Next.js SSR)   │  /api/* → localhost:3001   │
│  port 3000       │                             │
│                  │                             │
├──────────────────┴───────────────────────────┤
│              Application Servers              │
│  ┌──────────┐       ┌──────────┐             │
│  │ Web App  │       │ API App  │             │
│  │ (Next.js)│       │ (Hono)   │             │
│  └──────────┘       └──────────┘             │
├──────────────────────────────────────────────┤
│  ┌──────────┐       ┌──────────┐             │
│  │PostgreSQL│       │  Redis   │             │
│  │ (Primary)│       │ (Cache)  │             │
│  └──────────┘       └──────────┘             │
└──────────────────────────────────────────────┘
```

### 7.2.4 Structured Logging

```typescript
// JSON log format
{
  "timestamp": "2026-09-04T10:30:00.000Z",
  "level": "info",
  "message": "Assessment approved",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-uuid",
  "action": "ASSESSMENT_APPROVED",
  "entity": "assessment",
  "entityId": "assessment-uuid",
  "metadata": {
    "assessmentNumber": "ECC-ADD-2026-001245",
    "totalPayable": 197137.50
  }
}
```

**Log Levels:**
| Level  | Usage                                                    |
|--------|----------------------------------------------------------|
| error  | System errors, unhandled exceptions, DB connection failures |
| warn   | Rate limiting triggered, account lockout, deprecated API usage |
| info   | Successful operations, assessment lifecycle events         |
| debug  | Request/response details, query timing, cache hits/misses |

## 7.3 Phased Implementation Plan

### Phase 1: Foundation (Week 1-2)
**Goal:** Project scaffolding, database, and seed data

| Task                                           | Priority | Est. Hours |
|-----------------------------------------------|----------|------------|
| Initialize monorepo (Turborepo + pnpm)        | High     | 2          |
| Set up Hono backend with TypeScript           | High     | 3          |
| Set up Next.js frontend with App Router       | High     | 3          |
| Configure Drizzle ORM + PostgreSQL connection | High     | 2          |
| Define all DB schemas (Drizzle schema)        | High     | 4          |
| Create initial migration                      | High     | 1          |
| Create seed script (HS codes + forex rates)   | High     | 3          |
| Docker Compose setup                          | High     | 2          |
| Environment config + validation               | Medium   | 2          |
| Health check endpoint                         | Medium   | 1          |
| Structured logging setup                      | Medium   | 2          |

**Deliverable:** Running dev environment with DB, seed data, and health check.

### Phase 2: Tax Engine (Week 2-3)
**Goal:** Core calculation logic with comprehensive tests

| Task                                           | Priority | Est. Hours |
|-----------------------------------------------|----------|------------|
| Implement CIF calculation function            | High     | 2          |
| Implement duty calculation (with exemptions)  | High     | 3          |
| Implement excise, VAT, surtax, withholding    | High     | 3          |
| Implement grand total aggregation             | High     | 1          |
| Implement exemption logic (all 4 types)       | High     | 3          |
| Implement rate override checking              | Medium   | 2          |
| Assessment number generation                  | High     | 1          |
| Unit tests for ALL calculation paths          | High     | 6          |
| Property-based / fuzz tests                   | Medium   | 3          |
| Rounding edge case tests                      | High     | 1          |

**Deliverable:** 100% tested tax engine module.

### Phase 3: Auth & RBAC (Week 3-4)
**Goal:** Authentication, authorization, and user management

| Task                                           | Priority | Est. Hours |
|-----------------------------------------------|----------|------------|
| Register + email verification flow            | High     | 4          |
| Login with JWT (access + refresh)             | High     | 4          |
| Token refresh with rotation                   | High     | 3          |
| Account lockout mechanism                     | High     | 2          |
| RBAC middleware (role + ownership checks)     | High     | 3          |
| Rate limiting middleware (Redis)              | High     | 2          |
| User CRUD endpoints (admin)                   | High     | 3          |
| Audit logging middleware                      | High     | 3          |
| Request tracing (X-Request-Id)                | Medium   | 1          |
| Auth integration tests                        | High     | 3          |
| RBAC integration tests                        | High     | 2          |

**Deliverable:** Full auth system with role-based access control.

### Phase 4: API Endpoints (Week 4-5)
**Goal:** All CRUD and business endpoints

| Task                                           | Priority | Est. Hours |
|-----------------------------------------------|----------|------------|
| HS code CRUD + search/autocomplete            | High     | 3          |
| Forex rate CRUD + current rate endpoint       | High     | 2          |
| Calculator endpoint (quick estimate)          | High     | 2          |
| Assessment CRUD + lifecycle endpoints         | High     | 5          |
| Idempotency middleware                        | High     | 2          |
| QR verification public endpoint               | High     | 2          |
| Notification system (email + in-app)          | Medium   | 4          |
| Dashboard stats endpoint                      | Medium   | 2          |
| Report endpoints                              | Low      | 3          |
| Rate override CRUD                            | Medium   | 2          |
| API integration tests for all endpoints       | High     | 5          |

**Deliverable:** Complete API with tests.

### Phase 5: Frontend (Week 5-8)
**Goal:** All UI pages and components

| Task                                           | Priority | Est. Hours |
|-----------------------------------------------|----------|------------|
| Design system setup (shadcn/ui + Tailwind)    | High     | 3          |
| Auth pages (login, register, forgot password) | High     | 4          |
| Public calculator page                        | High     | 8          |
| HS code autocomplete component                | High     | 3          |
| Real-time tax breakdown display               | High     | 4          |
| Officer dashboard                             | High     | 5          |
| Assessment detail/review page                 | High     | 6          |
| Assessment creation form (importer)           | High     | 5          |
| Admin: HS code management page                | Medium   | 4          |
| Admin: Forex rate management page             | Medium   | 3          |
| Admin: User management page                   | Medium   | 3          |
| QR verification page                          | High     | 2          |
| Notification center                           | Medium   | 3          |
| Reports/analytics pages                       | Low      | 4          |
| Responsive design pass                        | Medium   | 4          |
| E2E tests for critical flows                  | High     | 5          |

**Deliverable:** Complete frontend application.

### Phase 6: PDF & QR (Week 8-9)
**Goal:** Document generation and verification system

| Task                                           | Priority | Est. Hours |
|-----------------------------------------------|----------|------------|
| PDF template design (A4 layout)               | High     | 4          |
| PDF generation with @react-pdf/renderer       | High     | 4          |
| Amharic font embedding (Noto Sans Ethiopic)   | High     | 2          |
| Watermark system (DRAFT / OFFICIAL)           | Medium   | 2          |
| Number-to-words converter (English + Amharic) | Medium   | 3          |
| QR code generation with JWT signing           | High     | 2          |
| QR verification page (public)                 | High     | 2          |
| Digital stamp/signature placeholder           | Low      | 1          |
| PDF download endpoint with proper headers     | High     | 1          |
| Integration tests for PDF/QR                  | High     | 2          |

**Deliverable:** Official PDF generation and QR verification system.

### Phase 7: Production Readiness (Week 9-10)
**Goal:** Hardening, optimization, and deployment prep

| Task                                           | Priority | Est. Hours |
|-----------------------------------------------|----------|------------|
| Security headers middleware                   | High     | 1          |
| Input sanitization audit                      | High     | 2          |
| Performance testing (load test key endpoints) | Medium   | 3          |
| Database query optimization (EXPLAIN ANALYZE) | Medium   | 3          |
| Redis caching strategy (forex, HS codes)      | Medium   | 2          |
| Error boundary + global error handling        | High     | 2          |
| 404 / 500 pages                              | Medium   | 1          |
| SEO meta tags + OpenGraph                     | Low      | 1          |
| Dockerfiles for production                    | High     | 2          |
| CI/CD pipeline (GitHub Actions)               | High     | 2          |
| Deployment to staging environment             | High     | 3          |
| Final E2E test suite on staging               | High     | 3          |

**Deliverable:** Production-ready application.

## 7.4 Total Estimated Effort

| Phase                         | Estimated Hours | Weeks   |
|-------------------------------|-----------------|---------|
| Phase 1: Foundation           | 25              | 1-2     |
| Phase 2: Tax Engine           | 28              | 2-3     |
| Phase 3: Auth & RBAC          | 30              | 3-4     |
| Phase 4: API Endpoints        | 35              | 4-5     |
| Phase 5: Frontend             | 69              | 5-8     |
| Phase 6: PDF & QR             | 23              | 8-9     |
| Phase 7: Production Readiness | 28              | 9-10    |
| **Total**                     | **~238 hours**  | **10 weeks** |

## 7.5 Future Enhancements (Post-MVP)

- **Mobile app** (React Native) for officers at physical checkpoints
- **Offline mode** with service workers for poor connectivity at border posts
- **Multi-language** full Amharic UI toggle
- **Bulk assessment import** from Excel/CSV
- **Webhook integrations** with Ethiopian Revenues & Customs Authority systems
- **Advanced analytics** with charts and trend visualization
- **Machine learning** for anomaly detection in declared values
- **Integration with Ethiopian customs single window** (if available)
- **Role delegation** — officer can temporarily delegate to another
- **Assessment appeal process** — formal dispute resolution workflow
