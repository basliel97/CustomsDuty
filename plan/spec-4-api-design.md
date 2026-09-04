# Technical Specification — Part 4: API Design

## 4.1 API Conventions

- **Base URL**: `/api/v1`
- **Content-Type**: `application/json` (except PDF downloads)
- **Authentication**: Bearer JWT in `Authorization` header
- **Pagination**: `?page=1&limit=20` with response `{ data: [], meta: { total, page, limit, pages } }`
- **Sorting**: `?sort=created_at&order=desc`
- **Filtering**: `?status=SUBMITTED&branch=ADD`
- **Error format**:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}
```

**Standard HTTP Status Codes:**
| Code | Meaning                        |
|------|--------------------------------|
| 200  | Success                        |
| 201  | Created                        |
| 204  | No Content (delete success)    |
| 400  | Bad Request / Validation Error |
| 401  | Unauthorized (no/invalid JWT)  |
| 403  | Forbidden (insufficient role)  |
| 404  | Not Found                      |
| 409  | Conflict (duplicate, idempotency) |
| 422  | Unprocessable Entity           |
| 429  | Rate Limited                   |
| 500  | Internal Server Error          |

## 4.2 Rate Limits

| Endpoint Category          | Limit              | Window     |
|---------------------------|--------------------|------------|
| Public (no auth)           | 30 requests        | 1 minute   |
| Authenticated (standard)   | 120 requests       | 1 minute   |
| Admin/Specialist           | 200 requests       | 1 minute   |
| Login                      | 5 attempts         | 15 minutes |
| Assessment submission      | 10 requests        | 1 minute   |

Rate limit headers returned: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

## 4.3 Endpoints

### Authentication

| Method | Endpoint                    | Auth Required | Roles                    | Description                        |
|--------|-----------------------------|---------------|--------------------------|------------------------------------|
| POST   | /api/v1/auth/register       | No            | Public                   | Register new importer account      |
| POST   | /api/v1/auth/login          | No            | Public                   | Login, returns access+refresh JWT  |
| POST   | /api/v1/auth/refresh        | No            | Public (valid refresh)   | Rotate refresh token               |
| POST   | /api/v1/auth/logout         | Yes           | Any authenticated        | Revoke refresh token               |
| POST   | /api/v1/auth/change-password| Yes           | Any authenticated        | Change password (requires current)|

### HS Codes (Tariff Management)

| Method | Endpoint                    | Auth Required | Roles                    | Description                        |
|--------|-----------------------------|---------------|--------------------------|------------------------------------|
| GET    | /api/v1/hs-codes            | No            | Public                   | Search/list HS codes (paginated)   |
| GET    | /api/v1/hs-codes/:code      | No            | Public                   | Get single HS code by code         |
| GET    | /api/v1/hs-codes/search     | No            | Public                   | Autocomplete (q, limit params)     |
| POST   | /api/v1/hs-codes            | Yes           | TARIFF_SPECIALIST, ADMIN | Create new HS code                 |
| PUT    | /api/v1/hs-codes/:id        | Yes           | TARIFF_SPECIALIST, ADMIN | Update HS code                     |
| DELETE | /api/v1/hs-codes/:id        | Yes           | SUPER_ADMIN              | Soft delete HS code                |

**Search query params:** `?q=smartphone&page=1&limit=20&duty_rate_min=0&duty_rate_max=35`

### Forex Rates

| Method | Endpoint                    | Auth Required | Roles                    | Description                        |
|--------|-----------------------------|---------------|--------------------------|------------------------------------|
| GET    | /api/v1/forex               | No            | Public                   | Get current/latest rates           |
| GET    | /api/v1/forex/history       | Yes           | Any authenticated        | Rate history (date range)          |
| POST   | /api/v1/forex               | Yes           | TARIFF_SPECIALIST, ADMIN | Set new daily rate                 |
| PUT    | /api/v1/forex/:id           | Yes           | TARIFF_SPECIALIST, ADMIN | Correct a rate (with audit)        |

### Calculator (Tax Engine)

| Method | Endpoint                    | Auth Required | Roles                    | Description                        |
|--------|-----------------------------|---------------|--------------------------|------------------------------------|
| POST   | /api/v1/calculate           | No            | Public                   | Quick estimate (no persistence)    |
| POST   | /api/v1/calculate/preview   | Yes           | Any authenticated        | Full preview with item details     |

**POST /api/v1/calculate request body:**
```json
{
  "currency": "USD",
  "exchangeRate": 57.50,
  "exemptionType": "NONE",
  "items": [
    {
      "hsCode": "8517.13.00",
      "quantity": 100,
      "unitPriceForeign": 250.00,
      "freightForeign": 500.00,
      "insuranceForeign": 100.00
    }
  ]
}
```

### Assessments

| Method | Endpoint                              | Auth Required | Roles                    | Description                        |
|--------|---------------------------------------|---------------|--------------------------|------------------------------------|
| GET    | /api/v1/assessments                   | Yes           | Any authenticated        | List assessments (filtered by role)|
| GET    | /api/v1/assessments/:id               | Yes           | Any authenticated        | Get assessment details             |
| POST   | /api/v1/assessments                   | Yes           | IMPORTER, OFFICER        | Create new draft assessment        |
| PUT    | /api/v1/assessments/:id               | Yes           | Owner (draft only)       | Update draft assessment            |
| POST   | /api/v1/assessments/:id/submit        | Yes           | IMPORTER, OFFICER        | Submit for officer review          |
| POST   | /api/v1/assessments/:id/approve       | Yes           | VALUATION_OFFICER, ADMIN | Approve assessment                 |
| POST   | /api/v1/assessments/:id/reject        | Yes           | VALUATION_OFFICER, ADMIN | Reject with reason                 |
| POST   | /api/v1/assessments/:id/cancel        | Yes           | Owner / Admin            | Cancel draft or submitted          |
| GET    | /api/v1/assessments/:id/pdf           | Yes           | Any authenticated        | Download official PDF              |
| POST   | /api/v1/assessments/:id/mark-paid     | Yes           | VALUATION_OFFICER, ADMIN | Record payment confirmation        |

**Dashboard query params:** `?status=SUBMITTED&branch=ADD&from=2026-01-01&to=2026-12-31`

**Role-based filtering:**
- IMPORTER: Sees only their own assessments
- VALUATION_OFFICER: Sees assessments at their branch
- TARIFF_SPECIALIST: Sees all assessments (read-only)
- SUPER_ADMIN: Sees all assessments (all actions)

### QR Verification (Public)

| Method | Endpoint                              | Auth Required | Description                        |
|--------|---------------------------------------|---------------|------------------------------------|
| GET    | /api/v1/verify/:verificationHash      | No            | Verify assessment via QR scan      |

**Response:**
```json
{
  "status": "APPROVED",
  "statusLabel": "PAID & CLEARED",
  "color": "green",
  "assessmentNumber": "ECC-ADD-2026-001245",
  "declarantName": "John Doe",
  "declarantTin": "0012345678",
  "totalTaxPaid": 125000.00,
  "currency": "ETB",
  "approvedAt": "2026-09-04T10:30:00Z",
  "branchLocation": "Bole Airport Cargo"
}
```

### Users (Admin)

| Method | Endpoint                    | Auth Required | Roles        | Description                        |
|--------|-----------------------------|---------------|--------------|------------------------------------|
| GET    | /api/v1/users               | Yes           | SUPER_ADMIN  | List all users                     |
| GET    | /api/v1/users/:id           | Yes           | SUPER_ADMIN  | Get user details                   |
| POST   | /api/v1/users               | Yes           | SUPER_ADMIN  | Create user (officer/admin)        |
| PUT    | /api/v1/users/:id           | Yes           | SUPER_ADMIN  | Update user                        |
| PUT    | /api/v1/users/:id/status    | Yes           | SUPER_ADMIN  | Suspend/activate user              |
| PUT    | /api/v1/users/:id/role      | Yes           | SUPER_ADMIN  | Change user role                   |

### Audit Logs

| Method | Endpoint                    | Auth Required | Roles        | Description                        |
|--------|-----------------------------|---------------|--------------|------------------------------------|
| GET    | /api/v1/audit               | Yes           | SUPER_ADMIN  | Query audit logs                   |

**Query params:** `?user_id=&action=ASSESSMENT_APPROVED&entity=assessments&from=&to=&page=1`

### Notifications

| Method | Endpoint                    | Auth Required | Roles                    | Description                        |
|--------|-----------------------------|---------------|--------------------------|------------------------------------|
| GET    | /api/v1/notifications       | Yes           | Any authenticated        | List my notifications              |
| PUT    | /api/v1/notifications/:id/read | Yes        | Any authenticated        | Mark as read                       |
| PUT    | /api/v1/notifications/read-all | Yes        | Any authenticated        | Mark all as read                   |

### Dashboard / Reports

| Method | Endpoint                    | Auth Required | Roles                    | Description                        |
|--------|-----------------------------|---------------|--------------------------|------------------------------------|
| GET    | /api/v1/dashboard/stats     | Yes           | OFFICER, SPECIALIST, ADMIN | Overview stats                   |
| GET    | /api/v1/reports/revenue     | Yes           | SPECIALIST, ADMIN        | Revenue by period/branch           |
| GET    | /api/v1/reports/hs-frequency| Yes           | SPECIALIST, ADMIN        | Most imported HS codes             |
| GET    | /api/v1/reports/officer-performance | Yes   | ADMIN                    | Officer metrics                    |

### Health Check

| Method | Endpoint     | Auth Required | Description              |
|--------|--------------|---------------|--------------------------|
| GET    | /api/health  | No            | Returns `{ status: "ok" }`|

## 4.4 API Response Envelope

All successful list responses follow:

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 1250,
    "page": 1,
    "limit": 20,
    "pages": 63
  }
}
```

All successful single-resource responses:

```json
{
  "success": true,
  "data": { ... }
}
```

## 4.5 Request Validation

All request bodies validated with Zod schemas. Validation errors return:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "items[0].quantity", "message": "Number must be greater than 0" }
    ]
  }
}
```
