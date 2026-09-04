# Technical Specification — Part 5: Authentication, RBAC & Security

## 5.1 Authentication Flow

### Registration (Importer Only)

```
Client -> POST /api/v1/auth/register
  { email, password, full_name, phone }

Server:
  1. Validate input (Zod schema)
  2. Check email uniqueness
  3. Hash password with bcrypt (12 rounds)
  4. Create user with role=IMPORTER, status=PENDING_VERIFICATION
  5. Send verification email with magic link
  6. Return { success: true, message: "Check your email" }

Email Verification:
  GET /api/v1/auth/verify-email?token=xxx
  -> Set status=ACTIVE, return login page
```

### Login

```
Client -> POST /api/v1/auth/login
  { email, password }

Server:
  1. Find user by email (check deleted_at IS NULL)
  2. If not found -> 401 "Invalid credentials"
  3. If status == SUSPENDED -> 403 "Account suspended"
  4. If locked_until > NOW() -> 423 "Account locked, try again later"
  5. Compare password with bcrypt
  6. If mismatch:
     - Increment failed_login_count
     - If failed_login_count >= 5 -> lock account for 15 minutes
     - 401 "Invalid credentials" (generic message - don't reveal which field)
  7. If match:
     - Reset failed_login_count = 0, locked_until = NULL
     - Update last_login_at = NOW()
     - Generate access token (15 min expiry)
     - Generate refresh token (7 day expiry)
     - Store refresh token hash in refresh_tokens table
     - Log LOGIN_SUCCESS audit event
     - Return { accessToken, refreshToken, user: { id, email, role, name } }
```

### Token Structure

**Access Token (JWT) payload:**
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "VALUATION_OFFICER",
  "branchLocation": "Bole Airport",
  "iat": 1725456000,
  "exp": 1725456900
}
```

**Refresh Token:**
- Random 256-bit string, stored as SHA-256 hash in database.
- Sent over HTTP-only secure cookie (or body for API clients).
- Single-use: each refresh rotates to a new token.

### Token Refresh Flow

```
Client -> POST /api/v1/auth/refresh
  { refreshToken }

Server:
  1. Hash the provided token
  2. Find matching refresh_tokens row (not revoked, not expired)
  3. If not found -> 401 "Invalid refresh token"
  4. Revoke old token (set revoked_at)
  5. Generate new access token + new refresh token
  6. Store new refresh token hash
  7. Return new tokens
```

### Logout

```
Client -> POST /api/v1/auth/logout
  Authorization: Bearer <accessToken>

Server:
  1. Verify access token
  2. Find and revoke all refresh tokens for this user
  3. Return { success: true }
```

## 5.2 Role-Based Access Control (RBAC)

### Permission Matrix

| Permission                    | IMPORTER | VALUATION_OFFICER | TARIFF_SPECIALIST | SUPER_ADMIN |
|-------------------------------|----------|--------------------|-------------------|-------------|
| **HS Codes**                  |          |                    |                   |             |
| Search/view HS codes          |    ✓     |        ✓           |        ✓          |      ✓      |
| Create HS codes               |    ✗     |        ✗           |        ✓          |      ✓      |
| Edit HS codes                 |    ✗     |        ✗           |        ✓          |      ✓      |
| Delete HS codes               |    ✗     |        ✗           |        ✗          |      ✓      |
| **Forex**                     |          |                    |                   |             |
| View current rates            |    ✓     |        ✓           |        ✓          |      ✓      |
| Set/update daily rates        |    ✗     |        ✗           |        ✓          |      ✓      |
| **Assessments**               |          |                    |                   |             |
| Create draft                  |    ✓     |        ✓           |        ✗          |      ✗      |
| Submit assessment             |    ✓     |        ✓           |        ✗          |      ✗      |
| View own assessments          |    ✓     |        -           |        -          |      -      |
| View branch assessments       |    ✗     |        ✓           |        -          |      -      |
| View all assessments          |    ✗     |        ✗           |        ✓          |      ✓      |
| Approve/reject                |    ✗     |        ✓           |        ✗          |      ✓      |
| Cancel assessment             |    ✓*    |        ✓           |        ✗          |      ✓      |
| Mark as paid                  |    ✗     |        ✓           |        ✗          |      ✓      |
| Download PDF                  |    ✓     |        ✓           |        ✓          |      ✓      |
| **Notifications**             |          |                    |                   |             |
| View own notifications        |    ✓     |        ✓           |        ✓          |      ✓      |
| **Users**                     |          |                    |                   |             |
| View all users                |    ✗     |        ✗           |        ✗          |      ✓      |
| Create user accounts          |    ✗     |        ✗           |        ✗          |      ✓      |
| Suspend/activate users        |    ✗     |        ✗           |        ✗          |      ✓      |
| Change user roles             |    ✗     |        ✗           |        ✗          |      ✓      |
| **Audit**                     |          |                    |                   |             |
| View audit logs               |    ✗     |        ✗           |        ✗          |      ✓      |
| **Rate Overrides**            |          |                    |                   |             |
| Create rate overrides         |    ✗     |        ✗           |        ✓          |      ✓      |

\* Importers can only cancel their own drafts/submitted assessments (before approval).

### RBAC Middleware Implementation

```typescript
// Pseudocode for permission check middleware
function requireRole(...allowedRoles: UserRole[]) {
  return async (c, next) => {
    const user = c.get('user');  // Set by auth middleware
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    if (!allowedRoles.includes(user.role)) return c.json({ error: 'Forbidden' }, 403);
    await next();
  };
}

// Resource ownership check
function requireOwnershipOrRole(resourceOwnerId: string, allowedRoles: UserRole[]) {
  const user = c.get('user');
  const isOwner = user.id === resourceOwnerId;
  const hasRole = allowedRoles.includes(user.role);
  if (!isOwner && !hasRole) return c.json({ error: 'Forbidden' }, 403);
}
```

## 5.3 Security Measures

### Password Policy
- Minimum 8 characters
- At least 1 uppercase, 1 lowercase, 1 number, 1 special character
- Password history: last 5 passwords cannot be reused
- Enforced via Zod schema validation

### Account Lockout
- After 5 consecutive failed login attempts: lock for 15 minutes
- After 10 cumulative failed attempts in 1 hour: lock for 1 hour
- Lockout logged as audit event
- Admin can manually unlock via user management

### JWT Security
- Access tokens: 15-minute expiry, signed with HS256
- Refresh tokens: 7-day expiry, stored as SHA-256 hash
- Token rotation on every refresh (single-use refresh tokens)
- All refresh tokens revoked on password change
- Secrets loaded from environment variables, never committed to code

### HTTP Security Headers
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### CORS Configuration
```typescript
{
  origin: process.env.CORS_ORIGIN,  // Frontend URL only
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  credentials: true,
  maxAge: 86400
}
```

### Input Sanitization
- All string inputs trimmed and sanitized (XSS prevention)
- SQL injection prevented by Drizzle ORM (parameterized queries)
- File upload validation: type checking, size limits (10MB max)
- HS code search: limit query length to 50 characters

### Sensitive Data Protection
- TIN and passport numbers encrypted at rest using AES-256-GCM
- Password hashes never returned in any API response
- Audit logs mask sensitive fields (show last 4 of TIN only)
- PDF documents stored with restricted access

### Audit Trail
Every state-changing operation automatically logged via middleware:

```typescript
// Auto-audit middleware
async function auditMiddleware(c, next) {
  const startTime = Date.now();
  await next();

  if (c.req.method !== 'GET' && c.res.status < 400) {
    await insertAuditLog({
      userId: c.get('user')?.id,
      action: determineAction(c),
      entityName: extractEntity(c),
      entityId: extractEntityId(c),
      oldValues: c.get('oldValues'),
      newValues: c.get('newValues'),
      ipAddress: c.req.header('x-forwarded-for'),
      userAgent: c.req.header('user-agent'),
      requestId: c.get('requestId'),
    });
  }
}
```

## 5.4 Request Tracing

Every request gets a unique `X-Request-Id` header (UUID). This ID:
- Is generated at the API gateway entry point
- Propagated through all middleware and database queries
- Included in structured logs for correlation
- Returned in response headers for client debugging
