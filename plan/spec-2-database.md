# Technical Specification — Part 2: Database Schema (Expanded)

## 2.1 Design Principles

- **Soft deletes everywhere** — `deleted_at` timestamp column on all mutable tables. Never hard-delete.
- **Timestamps** — `created_at` and `updated_at` on every table (auto-managed by Drizzle).
- **UUIDs** — Primary keys use `uuid` for distributed-safe, non-guessable IDs.
- **Optimistic locking** — `version` integer column on mutable tables (assessments, users, hs_codes).
- **JSONB for flexible data** — Used for audit old/new values, document metadata, config values.
- **Enumerated types** — PostgreSQL native enums for status/role fields for data integrity.
- **Decimal precision** — All monetary amounts use `DECIMAL(14,2)`. Rates use `DECIMAL(6,4)`.
- **Foreign key discipline** — Every FK has a named constraint. Cascades are explicit (soft-delete aware).
- **Master data pattern** — Reference tables (branches, countries, ports, categories) are insert-once, rarely updated.

## 2.2 Enums

```sql
-- User roles
CREATE TYPE user_role AS ENUM ('IMPORTER', 'VALUATION_OFFICER', 'TARIFF_SPECIALIST', 'SUPER_ADMIN');

-- User/account status
CREATE TYPE user_status AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION', 'LOCKED');

-- Assessment status lifecycle
CREATE TYPE assessment_status AS ENUM (
  'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED',
  'PAID', 'PARTIALLY_PAID', 'EXPIRED', 'CANCELLED', 'APPEALED'
);

-- Exemption types
CREATE TYPE exemption_type AS ENUM ('NONE', 'DIASPORA', 'INVESTMENT', 'DIPLOMATIC');

-- Audit action types
CREATE TYPE audit_action AS ENUM (
  'RATE_MODIFIED', 'HS_CODE_ADDED', 'HS_CODE_MODIFIED', 'HS_CODE_DELETED',
  'ASSESSMENT_CREATED', 'ASSESSMENT_SUBMITTED', 'ASSESSMENT_APPROVED',
  'ASSESSMENT_REJECTED', 'ASSESSMENT_CANCELLED', 'ASSESSMENT_PAID',
  'USER_CREATED', 'USER_MODIFIED', 'USER_SUSPENDED', 'USER_ACTIVATED',
  'FOREX_RATE_UPDATED', 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT',
  'PASSWORD_CHANGED', 'ROLE_CHANGED', 'DOCUMENT_UPLOADED', 'DOCUMENT_DELETED',
  'COMMENT_ADDED', 'APPEAL_FILED', 'APPEAL_RESOLVED', 'SCANNING_COMPLETED',
  'PAYMENT_RECORDED', 'STATUS_OVERRIDE', 'CONFIG_CHANGED'
);

-- Notification channels
CREATE TYPE notification_type AS ENUM ('EMAIL', 'SMS', 'IN_APP');

-- Notification status
CREATE TYPE notification_status AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ', 'BOUNCED');

-- Document types
CREATE TYPE document_type AS ENUM (
  'EXEMPTION_CERTIFICATE', 'EIC_APPROVAL', 'COMMERCIAL_INVOICE',
  'PACKING_LIST', 'BILL_OF_LADING', 'AIRWAY_BILL', 'CERTIFICATE_OF_ORIGIN',
  'INSURANCE_CERTIFICATE', 'IMPORT_PERMIT', 'OTHER'
);

-- Payment status
CREATE TYPE payment_status AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED');

-- Payment method
CREATE TYPE payment_method AS ENUM ('BANK_TRANSFER', 'CASH', 'MOBILE_MONEY', 'CHEQUE');

-- Appeal status
CREATE TYPE appeal_status AS ENUM ('FILED', 'UNDER_REVIEW', 'UPHELD', 'OVERTURNED', 'DISMISSED');

-- Scanning result
CREATE TYPE scan_result AS ENUM ('CLEARED', 'FLAGGED_FOR_INSPECTION', 'HELD', 'RELEASED');

-- Session status
CREATE TYPE session_status AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- Config value type
CREATE TYPE config_value_type AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');
```

## 2.3 Tables

---

### Table 1: `users`

| Column             | Type                     | Constraints                              | Description                         |
|--------------------|--------------------------|------------------------------------------|-------------------------------------|
| id                 | UUID                     | PK, DEFAULT gen_random_uuid()            | Unique identifier                   |
| email              | VARCHAR(255)             | UNIQUE, NOT NULL                         | Login email                         |
| password_hash      | VARCHAR(255)             | NOT NULL                                 | bcrypt hash (12 rounds)             |
| full_name          | VARCHAR(200)             | NOT NULL                                 | Full legal name                     |
| phone              | VARCHAR(20)              | NULL                                     | Phone number                        |
| badge_number       | VARCHAR(50)              | UNIQUE, NULL                             | Officer badge number                |
| branch_id          | UUID                     | FK -> branches.id, NULL                  | Assigned branch (officers only)     |
| role               | user_role                | NOT NULL, DEFAULT 'IMPORTER'             | Access role                         |
| status             | user_status              | NOT NULL, DEFAULT 'PENDING_VERIFICATION' | Account status                      |
| last_login_at      | TIMESTAMP                | NULL                                     | Last successful login               |
| failed_login_count | INTEGER                  | NOT NULL, DEFAULT 0                      | Consecutive failed logins           |
| locked_until       | TIMESTAMP                | NULL                                     | Account lockout expiry              |
| password_changed_at| TIMESTAMP                | NULL                                     | Last password change                |
| avatar_url         | TEXT                     | NULL                                     | Profile picture URL                 |
| version            | INTEGER                  | NOT NULL, DEFAULT 1                      | Optimistic locking version          |
| created_at         | TIMESTAMP                | NOT NULL, DEFAULT NOW()                  |                                     |
| updated_at         | TIMESTAMP                | NOT NULL, DEFAULT NOW()                  |                                     |
| deleted_at         | TIMESTAMP                | NULL                                     | Soft delete                         |

---

### Table 2: `branches`

| Column        | Type         | Constraints                      | Description                    |
|---------------|--------------|----------------------------------|--------------------------------|
| id            | UUID         | PK                               | Unique identifier              |
| code          | VARCHAR(10)  | UNIQUE, NOT NULL                 | Short code (ADD, BLT, DRM)     |
| name_en       | VARCHAR(200) | NOT NULL                         | English name                   |
| name_am       | VARCHAR(200) | NULL                             | Amharic name                   |
| address       | TEXT         | NULL                             | Physical address               |
| city          | VARCHAR(100) | NOT NULL                         | City                           |
| region        | VARCHAR(100) | NOT NULL                         | Region/State                   |
| phone         | VARCHAR(20)  | NULL                             | Contact phone                  |
| email         | VARCHAR(255) | NULL                             | Contact email                  |
| is_active     | BOOLEAN      | NOT NULL, DEFAULT TRUE           | Active branch flag             |
| created_at    | TIMESTAMP    | NOT NULL, DEFAULT NOW()          |                                |
| updated_at    | TIMESTAMP    | NOT NULL, DEFAULT NOW()          |                                |
| deleted_at    | TIMESTAMP    | NULL                             | Soft delete                    |

**Seed data:** Bole Airport Cargo, Passenger Terminal, Kality Dry Port, Dire Dawa, Bahir Dar, Mekelle, etc.

---

### Table 3: `countries`

| Column           | Type         | Constraints                      | Description                    |
|------------------|--------------|----------------------------------|--------------------------------|
| id               | UUID         | PK                               | Unique identifier              |
| code             | VARCHAR(3)   | UNIQUE, NOT NULL                 | ISO 3166-1 alpha-3 (USA, CHN)  |
| name_en          | VARCHAR(200) | NOT NULL                         | English name                   |
| name_am          | VARCHAR(200) | NULL                             | Amharic name                   |
| region           | VARCHAR(100) | NULL                             | Continent/region               |
| is_active        | BOOLEAN      | NOT NULL, DEFAULT TRUE           |                                |
| created_at       | TIMESTAMP    | NOT NULL, DEFAULT NOW()          |                                |

---

### Table 4: `ports`

| Column           | Type         | Constraints                      | Description                    |
|------------------|--------------|----------------------------------|--------------------------------|
| id               | UUID         | PK                               | Unique identifier              |
| code             | VARCHAR(10)  | UNIQUE, NOT NULL                 | Port code (ADD, JIM, MAS)      |
| name_en          | VARCHAR(200) | NOT NULL                         | English name                   |
| name_am          | VARCHAR(200) | NULL                             | Amharic name                   |
| type             | VARCHAR(20)  | NOT NULL                         | AIRPORT, SEAPORT, DRY_PORT, LAND_BORDER |
| city             | VARCHAR(100) | NOT NULL                         | City/location                  |
| branch_id        | UUID         | FK -> branches.id, NULL          | Associated branch              |
| is_active        | BOOLEAN      | NOT NULL, DEFAULT TRUE           |                                |
| created_at       | TIMESTAMP    | NOT NULL, DEFAULT NOW()          |                                |

**Seed data:** Bole International Airport, Kilinto Dry Port, Djibouti Corridor, Mekelle Dry Port, etc.

---

### Table 5: `commodity_categories`

| Column           | Type         | Constraints                      | Description                    |
|------------------|--------------|----------------------------------|--------------------------------|
| id               | UUID         | PK                               | Unique identifier              |
| parent_id        | UUID         | FK -> commodity_categories.id, NULL | Parent category (tree structure) |
| code             | VARCHAR(10)  | UNIQUE, NOT NULL                 | Chapter/heading code           |
| name_en          | VARCHAR(300) | NOT NULL                         | English name                   |
| name_am          | VARCHAR(300) | NULL                             | Amharic name                   |
| description      | TEXT         | NULL                             | Detailed description           |
| level            | INTEGER      | NOT NULL, DEFAULT 0              | Hierarchy level (0=chapter)    |
| sort_order       | INTEGER      | NOT NULL, DEFAULT 0              | Display ordering               |
| is_active        | BOOLEAN      | NOT NULL, DEFAULT TRUE           |                                |
| created_at       | TIMESTAMP    | NOT NULL, DEFAULT NOW()          |                                |
| updated_at       | TIMESTAMP    | NOT NULL, DEFAULT NOW()          |                                |

**Purpose:** Hierarchical grouping of HS codes. Level 0 = Chapter (e.g., "Section XVI: Machinery"), Level 1 = Heading, Level 2 = Subheading. Enables tree-view navigation and category-level reporting.

---

### Table 6: `hs_codes`

| Column              | Type            | Constraints                              | Description                       |
|---------------------|-----------------|------------------------------------------|-----------------------------------|
| id                  | UUID            | PK                                       | Unique identifier                 |
| category_id         | UUID            | FK -> commodity_categories.id, NULL      | Parent category                   |
| code                | VARCHAR(10)     | UNIQUE, NOT NULL                         | 8-digit HS code (8517.13.00)     |
| description_en      | TEXT            | NOT NULL                                 | English description               |
| description_am      | TEXT            | NULL                                     | Amharic description               |
| unit_of_measurement | VARCHAR(20)     | NOT NULL                                 | U, KG, L, M2, SET, etc.          |
| duty_rate           | DECIMAL(6,4)    | NOT NULL, DEFAULT 0                      | Customs duty rate (0.00 - 0.35)   |
| excise_rate         | DECIMAL(6,4)    | NOT NULL, DEFAULT 0                      | Excise tax rate (0.00 - 1.00+)    |
| vat_rate            | DECIMAL(6,4)    | NOT NULL, DEFAULT 0.15                   | VAT rate (typically 0.15)         |
| surtax_rate         | DECIMAL(6,4)    | NOT NULL, DEFAULT 0.10                   | Sur-tax rate (typically 0.10)     |
| withholding_rate    | DECIMAL(6,4)    | NOT NULL, DEFAULT 0.03                   | Withholding rate (typically 0.03) |
| minimum_duty_floor  | DECIMAL(14,2)   | NULL                                     | Minimum duty in ETB (if set)      |
| is_exempt_eligible  | BOOLEAN         | NOT NULL, DEFAULT FALSE                  | Eligible for exemptions           |
| is_capital_goods    | BOOLEAN         | NOT NULL, DEFAULT FALSE                  | Investment exemption eligible     |
| is_raw_material     | BOOLEAN         | NOT NULL, DEFAULT FALSE                  | Investment exemption eligible     |
| is_active           | BOOLEAN         | NOT NULL, DEFAULT TRUE                   | Active/deprecated                 |
| version             | INTEGER         | NOT NULL, DEFAULT 1                      | Optimistic locking                |
| created_at          | TIMESTAMP       | NOT NULL, DEFAULT NOW()                  |                                   |
| updated_at          | TIMESTAMP       | NOT NULL, DEFAULT NOW()                  |                                   |
| deleted_at          | TIMESTAMP       | NULL                                     | Soft delete                       |

**Indexes:** `code` (unique btree), `description_en` (gin full-text), `(category_id, is_active)` composite.

---

### Table 7: `forex_rates`

| Column               | Type            | Constraints                              | Description                    |
|----------------------|-----------------|------------------------------------------|--------------------------------|
| id                   | UUID            | PK                                       | Unique identifier              |
| currency             | VARCHAR(3)      | NOT NULL                                 | USD, EUR, GBP, AED, CNY, CAD  |
| exchange_rate_to_etb | DECIMAL(14,4)   | NOT NULL, CHECK > 0                      | Rate to Ethiopian Birr         |
| previous_rate        | DECIMAL(14,4)   | NULL                                     | Previous rate (for tracking)   |
| change_amount        | DECIMAL(14,4)   | NULL                                     | Daily change (auto-calculated) |
| change_percentage    | DECIMAL(8,4)    | NULL                                     | Daily change % (auto-calculated)|
| effective_date       | DATE            | NOT NULL                                 | Date this rate applies         |
| set_by_user_id       | UUID            | FK -> users.id, NOT NULL                 | Who set this rate              |
| source               | VARCHAR(100)    | DEFAULT 'NBE'                            | Rate source                    |
| notes                | TEXT            | NULL                                     | Notes about the rate           |
| created_at           | TIMESTAMP       | NOT NULL, DEFAULT NOW()                  |                                |
| updated_at           | TIMESTAMP       | NOT NULL, DEFAULT NOW()                  |                                |
| deleted_at           | TIMESTAMP       | NULL                                     | Soft delete                    |

**Constraints:** UNIQUE `(currency, effective_date)`.

---

### Table 8: `consignments`

| Column              | Type         | Constraints                              | Description                    |
|---------------------|--------------|------------------------------------------|--------------------------------|
| id                  | UUID         | PK                                       | Unique identifier              |
| consignment_number  | VARCHAR(30)  | UNIQUE, NOT NULL                         | Shipment tracking number       |
| assessment_id       | UUID         | FK -> assessments.id, NULL               | Linked assessment (set after)  |
| origin_country_id   | UUID         | FK -> countries.id, NOT NULL             | Country of origin              |
| port_of_entry_id    | UUID         | FK -> ports.id, NOT NULL                 | Port of entry                  |
| vessel_name         | VARCHAR(200) | NULL                                     | Ship/airline name              |
| vessel_voyage       | VARCHAR(50)  | NULL                                     | Voyage/flight number           |
| container_number    | VARCHAR(30)  | NULL                                     | Container ID                   |
| container_count     | INTEGER      | NOT NULL, DEFAULT 1                      | Number of containers           |
| container_type      | VARCHAR(30)  | NULL                                     | 20FT, 40FT, LCL, etc.         |
| gross_weight_kg     | DECIMAL(14,4)| NULL                                     | Gross weight in KG             |
| net_weight_kg       | DECIMAL(14,4)| NULL                                     | Net weight in KG               |
| total_packages      | INTEGER      | NULL                                     | Number of packages             |
| bl_number           | VARCHAR(50)  | NULL                                     | Bill of Lading number          |
| awb_number          | VARCHAR(50)  | NULL                                     | Airway Bill number             |
| eta_date            | DATE         | NULL                                     | Estimated time of arrival      |
| atd_date            | DATE         | NULL                                     | Actual time of departure       |
| ata_date            | DATE         | NULL                                     | Actual time of arrival         |
| status              | VARCHAR(30)  | NOT NULL, DEFAULT 'IN_TRANSIT'           | IN_TRANSIT, ARRIVED, UNDER_INSPECTION, RELEASED, HELD |
| notes               | TEXT         | NULL                                     | Shipment notes                 |
| created_at          | TIMESTAMP    | NOT NULL, DEFAULT NOW()                  |                                |
| updated_at          | TIMESTAMP    | NOT NULL, DEFAULT NOW()                  |                                |
| deleted_at          | TIMESTAMP    | NULL                                     | Soft delete                    |

**Purpose:** Tracks the physical shipment associated with an assessment. Links customs declaration to actual goods movement.

---

### Table 9: `assessments`

| Column                    | Type              | Constraints                           | Description                    |
|---------------------------|-------------------|---------------------------------------|--------------------------------|
| id                        | UUID              | PK                                    | Unique identifier              |
| assessment_number         | VARCHAR(30)       | UNIQUE, NOT NULL                      | ECC-ADD-2026-001245            |
| consignment_id            | UUID              | FK -> consignments.id, NULL           | Linked consignment             |
| created_by_user_id        | UUID              | FK -> users.id, NOT NULL              | Who created the assessment     |
| declarant_name            | VARCHAR(200)      | NOT NULL                              | Full name of declarant         |
| declarant_tin             | VARCHAR(20)       | NOT NULL                              | Tax Identification Number      |
| declarant_passport_no     | VARCHAR(30)       | NULL                                  | Passport (if applicable)       |
| declarant_phone           | VARCHAR(20)       | NULL                                  | Contact phone                  |
| declarant_email           | VARCHAR(255)      | NULL                                  | Contact email                  |
| branch_id                 | UUID              | FK -> branches.id, NOT NULL           | Processing branch              |
| port_of_entry_id          | UUID              | FK -> ports.id, NULL                  | Port of entry                  |
| currency                  | VARCHAR(3)        | NOT NULL                              | Original currency              |
| exchange_rate_applied     | DECIMAL(14,4)     | NOT NULL                              | Snapshot of forex rate used    |
| total_cif_etb             | DECIMAL(14,2)     | NOT NULL, DEFAULT 0                   | Total CIF in ETB               |
| total_duty_etb            | DECIMAL(14,2)     | NOT NULL, DEFAULT 0                   | Total customs duty             |
| total_excise_etb          | DECIMAL(14,2)     | NOT NULL, DEFAULT 0                   | Total excise tax               |
| total_vat_etb             | DECIMAL(14,2)     | NOT NULL, DEFAULT 0                   | Total VAT                      |
| total_surtax_etb          | DECIMAL(14,2)     | NOT NULL, DEFAULT 0                   | Total sur-tax                  |
| total_withholding_etb     | DECIMAL(14,2)     | NOT NULL, DEFAULT 0                   | Total withholding tax          |
| total_scanning_fee_etb    | DECIMAL(14,2)     | NOT NULL, DEFAULT 200                 | Flat admin/scanning fee        |
| total_payable_etb         | DECIMAL(14,2)     | NOT NULL, DEFAULT 0                   | Grand total payable            |
| total_paid_etb            | DECIMAL(14,2)     | NOT NULL, DEFAULT 0                   | Amount paid so far             |
| remaining_balance_etb     | DECIMAL(14,2)     | NOT NULL, DEFAULT 0                   | Outstanding balance            |
| status                    | assessment_status  | NOT NULL, DEFAULT 'DRAFT'             | Current status                 |
| exemption_type            | exemption_type    | NOT NULL, DEFAULT 'NONE'              | Applied exemption              |
| exemption_doc_id          | UUID              | FK -> assessment_documents.id, NULL   | Linked exemption document      |
| submitted_at              | TIMESTAMP         | NULL                                  | When submitted for review      |
| reviewed_by_officer_id    | UUID              | FK -> users.id, NULL                  | Reviewing officer              |
| reviewed_at               | TIMESTAMP         | NULL                                  | When reviewed                  |
| rejection_reason          | TEXT              | NULL                                  | Reason if rejected             |
| qr_verification_hash      | VARCHAR(500)      | NULL, UNIQUE                          | Signed JWT for QR              |
| paid_at                   | TIMESTAMP         | NULL                                  | When fully paid                 |
| payment_reference         | VARCHAR(100)      | NULL                                  | Bank/payment reference         |
| expires_at                | TIMESTAMP         | NULL                                  | Draft expiry time              |
| idempotency_key           | VARCHAR(100)      | UNIQUE, NULL                          | Prevent duplicate submissions  |
| version                   | INTEGER           | NOT NULL, DEFAULT 1                   | Optimistic locking             |
| created_at                | TIMESTAMP         | NOT NULL, DEFAULT NOW()               |                                |
| updated_at                | TIMESTAMP         | NOT NULL, DEFAULT NOW()               |                                |
| deleted_at                | TIMESTAMP         | NULL                                  | Soft delete                    |

**Indexes:** `assessment_number` (unique), `status`, `declarant_tin`, `branch_id`, `created_by_user_id`, `reviewed_by_officer_id`, `created_at DESC`, `submitted_at`.

---

### Table 10: `assessment_items`

| Column              | Type            | Constraints                              | Description                       |
|---------------------|-----------------|------------------------------------------|-----------------------------------|
| id                  | UUID            | PK                                       | Unique identifier                 |
| assessment_id       | UUID            | FK -> assessments.id, NOT NULL           | Parent assessment                 |
| line_number         | INTEGER         | NOT NULL                                 | Item sequence (1, 2, 3...)        |
| hs_code_id          | UUID            | FK -> hs_codes.id, NOT NULL              | Reference to tariff code          |
| item_description    | TEXT            | NOT NULL                                 | Description of goods              |
| country_of_origin_id| UUID            | FK -> countries.id, NULL                  | Country of origin                 |
| quantity            | DECIMAL(14,4)   | NOT NULL, CHECK > 0                      | Quantity                          |
| unit_price_foreign  | DECIMAL(14,4)   | NOT NULL, CHECK >= 0                     | Unit price in original currency   |
| total_fob_foreign   | DECIMAL(14,2)   | NOT NULL, DEFAULT 0                      | quantity * unit_price_foreign     |
| freight_foreign     | DECIMAL(14,2)   | NOT NULL, DEFAULT 0                      | Freight in original currency      |
| insurance_foreign   | DECIMAL(14,2)   | NOT NULL, DEFAULT 0                      | Insurance in original currency    |
| cif_etb             | DECIMAL(14,2)   | NOT NULL, DEFAULT 0                      | Calculated CIF in ETB             |
| duty_amount         | DECIMAL(14,2)   | NOT NULL, DEFAULT 0                      | Calculated duty                   |
| excise_amount       | DECIMAL(14,2)   | NOT NULL, DEFAULT 0                      | Calculated excise                 |
| vat_amount          | DECIMAL(14,2)   | NOT NULL, DEFAULT 0                      | Calculated VAT                    |
| surtax_amount       | DECIMAL(14,2)   | NOT NULL, DEFAULT 0                      | Calculated sur-tax                |
| withholding_amount  | DECIMAL(14,2)   | NOT NULL, DEFAULT 0                      | Calculated withholding            |
| total_item_tax_etb  | DECIMAL(14,2)   | NOT NULL, DEFAULT 0                      | Sum of all taxes for this item    |
| notes               | TEXT            | NULL                                     | Item-level notes                  |
| created_at          | TIMESTAMP       | NOT NULL, DEFAULT NOW()                  |                                   |
| updated_at          | TIMESTAMP       | NOT NULL, DEFAULT NOW()                  |                                   |
| deleted_at          | TIMESTAMP       | NULL                                     | Soft delete                       |

**Constraints:** UNIQUE `(assessment_id, line_number)`.

---

### Table 11: `assessment_documents`

| Column           | Type          | Constraints                              | Description                    |
|------------------|---------------|------------------------------------------|--------------------------------|
| id               | UUID          | PK                                       | Unique identifier              |
| assessment_id    | UUID          | FK -> assessments.id, NOT NULL           | Parent assessment              |
| document_type    | document_type | NOT NULL                                 | Type of document               |
| file_name        | VARCHAR(255)  | NOT NULL                                 | Original filename              |
| file_path        | TEXT          | NOT NULL                                 | Storage path                   |
| file_size_bytes  | INTEGER       | NOT NULL                                 | File size                      |
| mime_type        | VARCHAR(100)  | NOT NULL                                 | application/pdf, image/jpeg    |
| uploaded_by_id   | UUID          | FK -> users.id, NOT NULL                 | Who uploaded                   |
| is_verified      | BOOLEAN       | NOT NULL, DEFAULT FALSE                  | Officer verified the document  |
| verified_by_id   | UUID          | FK -> users.id, NULL                     | Who verified                   |
| verified_at      | TIMESTAMP     | NULL                                     | When verified                  |
| rejection_reason | TEXT          | NULL                                     | Why document was rejected      |
| metadata         | JSONB         | NULL                                     | Additional document metadata   |
| created_at       | TIMESTAMP     | NOT NULL, DEFAULT NOW()                  |                                |
| deleted_at       | TIMESTAMP     | NULL                                     | Soft delete                    |

**Purpose:** Stores uploaded supporting documents — exemption certificates, invoices, packing lists, bills of lading, certificates of origin, etc.

---

### Table 12: `assessment_status_history`

| Column           | Type              | Constraints                              | Description                    |
|------------------|-------------------|------------------------------------------|--------------------------------|
| id               | UUID              | PK                                       | Unique identifier              |
| assessment_id    | UUID              | FK -> assessments.id, NOT NULL           | Parent assessment              |
| from_status      | assessment_status | NULL                                     | Previous status (NULL for create) |
| to_status        | assessment_status | NOT NULL                                 | New status                     |
| changed_by_id    | UUID              | FK -> users.id, NOT NULL                 | Who changed it                 |
| reason           | TEXT              | NULL                                     | Why (required for reject/appeal)|
| metadata         | JSONB             | NULL                                     | Additional context             |
| created_at       | TIMESTAMP         | NOT NULL, DEFAULT NOW()                  | When the change happened       |

**Purpose:** Complete audit trail of every status change per assessment. Immutable — no updates or deletes.

---

### Table 13: `assessment_comments`

| Column           | Type          | Constraints                              | Description                    |
|------------------|---------------|------------------------------------------|--------------------------------|
| id               | UUID          | PK                                       | Unique identifier              |
| assessment_id    | UUID          | FK -> assessments.id, NOT NULL           | Parent assessment              |
| parent_id        | UUID          | FK -> assessment_comments.id, NULL       | Reply to (thread support)      |
| author_id        | UUID          | FK -> users.id, NOT NULL                 | Who wrote it                   |
| body             | TEXT          | NOT NULL                                 | Comment content                |
| is_internal      | BOOLEAN       | NOT NULL, DEFAULT FALSE                  | Officer-only internal note     |
| is_read          | BOOLEAN       | NOT NULL, DEFAULT FALSE                  | Read by other party            |
| created_at       | TIMESTAMP     | NOT NULL, DEFAULT NOW()                  |                                |
| updated_at       | TIMESTAMP     | NOT NULL, DEFAULT NOW()                  |                                |
| deleted_at       | TIMESTAMP     | NULL                                     | Soft delete                    |

**Purpose:** Communication thread between officers and importers on a specific assessment. Supports threaded replies and internal-only notes.

---

### Table 14: `payment_records`

| Column              | Type              | Constraints                              | Description                    |
|---------------------|-------------------|------------------------------------------|--------------------------------|
| id                  | UUID              | PK                                       | Unique identifier              |
| assessment_id       | UUID              | FK -> assessments.id, NOT NULL           | Parent assessment              |
| payment_number      | VARCHAR(30)       | UNIQUE, NOT NULL                         | PAY-ADD-2026-000001            |
| amount_etb          | DECIMAL(14,2)     | NOT NULL, CHECK > 0                      | Payment amount in ETB          |
| payment_method      | payment_method    | NOT NULL                                 | BANK_TRANSFER, CASH, etc.      |
| payment_status      | payment_status    | NOT NULL, DEFAULT 'PENDING'              | Current payment status         |
| bank_name           | VARCHAR(200)      | NULL                                     | Bank name (if bank transfer)   |
| bank_reference      | VARCHAR(100)      | NULL                                     | Bank transaction reference     |
| receipt_number      | VARCHAR(100)      | NULL                                     | Physical receipt number        |
| paid_at             | TIMESTAMP         | NULL                                     | When payment was made          |
| confirmed_by_id     | UUID              | FK -> users.id, NULL                     | Officer who confirmed          |
| confirmed_at        | TIMESTAMP         | NULL                                     | When confirmed                 |
| notes               | TEXT              | NULL                                     | Payment notes                  |
| created_at          | TIMESTAMP         | NOT NULL, DEFAULT NOW()                  |                                |
| updated_at          | TIMESTAMP         | NOT NULL, DEFAULT NOW()                  |                                |
| deleted_at          | TIMESTAMP         | NULL                                     | Soft delete                    |

**Purpose:** Supports partial payments and multiple payment methods. Each payment is tracked independently.

---

### Table 15: `scanning_reports`

| Column              | Type          | Constraints                              | Description                    |
|---------------------|---------------|------------------------------------------|--------------------------------|
| id                  | UUID          | PK                                       | Unique identifier              |
| assessment_id       | UUID          | FK -> assessments.id, NOT NULL           | Parent assessment              |
| report_number       | VARCHAR(30)   | UNIQUE, NOT NULL                         | SCR-ADD-2026-000001            |
| scanned_by_id       | UUID          | FK -> users.id, NOT NULL                 | Scanning officer               |
| scan_date           | TIMESTAMP     | NOT NULL                                 | When scanned                   |
| scan_result         | scan_result   | NOT NULL                                 | CLEARED, FLAGGED, HELD         |
| physical_inspection | BOOLEAN       | NOT NULL, DEFAULT FALSE                  | Was physical inspection done?  |
| inspection_notes    | TEXT          | NULL                                     | Notes from inspection          |
| discrepancies_found | BOOLEAN       | NOT NULL, DEFAULT FALSE                  | Any discrepancies?             |
| discrepancy_details | TEXT          | NULL                                     | What was found                 |
| weight_verified_kg  | DECIMAL(14,4) | NULL                                     | Verified weight                |
| package_count_verified | INTEGER     | NULL                                     | Verified package count         |
| created_at          | TIMESTAMP     | NOT NULL, DEFAULT NOW()                  |                                |
| updated_at          | TIMESTAMP     | NOT NULL, DEFAULT NOW()                  |                                |

**Purpose:** Records physical scanning/inspection results at customs checkpoints. Links to the assessment for the declared goods.

---

### Table 16: `assessment_appeals`

| Column           | Type              | Constraints                              | Description                    |
|------------------|-------------------|------------------------------------------|--------------------------------|
| id               | UUID              | PK                                       | Unique identifier              |
| assessment_id    | UUID              | FK -> assessments.id, NOT NULL           | Parent assessment              |
| appeal_number    | VARCHAR(30)       | UNIQUE, NOT NULL                         | APPEAL-2026-000001             |
| filed_by_id      | UUID              | FK -> users.id, NOT NULL                 | Who filed the appeal           |
| filed_reason     | TEXT              | NOT NULL                                 | Why they're appealing          |
| supporting_docs  | JSONB             | NULL                                     | Array of document references   |
| status           | appeal_status     | NOT NULL, DEFAULT 'FILED'                | Current appeal status          |
| assigned_to_id   | UUID              | FK -> users.id, NULL                     | Assigned reviewer              |
| resolution       | TEXT              | NULL                                     | Resolution explanation         |
| adjusted_amount  | DECIMAL(14,2)     | NULL                                     | New amount if overturned       |
| filed_at         | TIMESTAMP         | NOT NULL, DEFAULT NOW()                  |                                |
| resolved_at      | TIMESTAMP         | NULL                                     | When resolved                  |
| created_at       | TIMESTAMP         | NOT NULL, DEFAULT NOW()                  |                                |
| updated_at       | TIMESTAMP         | NOT NULL, DEFAULT NOW()                  |                                |
| deleted_at       | TIMESTAMP         | NULL                                     | Soft delete                    |

**Purpose:** Formal dispute resolution workflow. Importers can appeal assessment decisions.

---

### Table 17: `rate_overrides`

| Column            | Type            | Constraints                              | Description                    |
|-------------------|-----------------|------------------------------------------|--------------------------------|
| id                | UUID            | PK                                       | Unique identifier              |
| hs_code_id        | UUID            | FK -> hs_codes.id, NOT NULL              | Target HS code                 |
| tax_component     | VARCHAR(20)     | NOT NULL                                 | duty, excise, vat, surtax      |
| override_rate     | DECIMAL(6,4)    | NOT NULL                                 | New rate (can be 0)            |
| valid_from        | DATE            | NOT NULL                                 | Start date                     |
| valid_to          | DATE            | NULL                                     | End date (NULL = indefinite)   |
| decree_reference  | VARCHAR(200)    | NOT NULL                                 | Government decree reference    |
| reason            | TEXT            | NULL                                     | Explanation                    |
| created_by_id     | UUID            | FK -> users.id, NOT NULL                 | Who created                    |
| is_active         | BOOLEAN         | NOT NULL, DEFAULT TRUE                   |                                |
| created_at        | TIMESTAMP       | NOT NULL, DEFAULT NOW()                  |                                |
| updated_at        | TIMESTAMP       | NOT NULL, DEFAULT NOW()                  |                                |
| deleted_at        | TIMESTAMP       | NULL                                     | Soft delete                    |

---

### Table 18: `daily_summaries`

| Column               | Type            | Constraints                              | Description                    |
|----------------------|-----------------|------------------------------------------|--------------------------------|
| id                   | UUID            | PK                                       | Unique identifier              |
| summary_date         | DATE            | NOT NULL                                 | Date of summary                |
| branch_id            | UUID            | FK -> branches.id, NOT NULL              | Branch for this summary        |
| total_assessments    | INTEGER         | NOT NULL, DEFAULT 0                      | Total assessments created      |
| submitted_count      | INTEGER         | NOT NULL, DEFAULT 0                      | Submitted for review           |
| approved_count       | INTEGER         | NOT NULL, DEFAULT 0                      | Approved                       |
| rejected_count       | INTEGER         | NOT NULL, DEFAULT 0                      | Rejected                       |
| total_cif_etb        | DECIMAL(16,2)   | NOT NULL, DEFAULT 0                      | Total CIF value                |
| total_revenue_etb    | DECIMAL(16,2)   | NOT NULL, DEFAULT 0                      | Total tax revenue              |
| total_duty_etb       | DECIMAL(16,2)   | NOT NULL, DEFAULT 0                      | Total duty collected           |
| total_vat_etb        | DECIMAL(16,2)   | NOT NULL, DEFAULT 0                      | Total VAT collected            |
    | total_excise_etb   | DECIMAL(16,2)   | NOT NULL, DEFAULT 0                      | Total excise collected         |
| total_surtax_etb     | DECIMAL(16,2)   | NOT NULL, DEFAULT 0                      | Total sur-tax collected        |
| total_withholding_etb| DECIMAL(16,2)   | NOT NULL, DEFAULT 0                      | Total withholding collected    |
| generated_by_id      | UUID            | FK -> users.id, NULL                     | System-generated or manual     |
| generated_at         | TIMESTAMP       | NOT NULL, DEFAULT NOW()                  |                                |

**Constraints:** UNIQUE `(summary_date, branch_id)`.

**Purpose:** Pre-computed daily revenue summaries per branch. Enables fast dashboard/report queries without scanning millions of assessment rows.

---

### Table 19: `user_sessions`

| Column        | Type          | Constraints                          | Description                    |
|---------------|---------------|--------------------------------------|--------------------------------|
| id            | UUID          | PK                                   | Unique identifier              |
| user_id       | UUID          | FK -> users.id, NOT NULL             | Session owner                  |
| token_hash    | VARCHAR(255)  | UNIQUE, NOT NULL                     | SHA-256 hash of session token  |
| ip_address    | VARCHAR(45)   | NULL                                 | Client IP                      |
| user_agent    | TEXT          | NULL                                 | Client user agent              |
| device_info   | VARCHAR(200)  | NULL                                 | Device fingerprint             |
| status        | session_status| NOT NULL, DEFAULT 'ACTIVE'           | Session state                  |
| last_active_at| TIMESTAMP     | NOT NULL, DEFAULT NOW()              | Last activity                  |
| expires_at    | TIMESTAMP     | NOT NULL                             | Session expiry                 |
| created_at    | TIMESTAMP     | NOT NULL, DEFAULT NOW()              |                                |
| deleted_at    | TIMESTAMP     | NULL                                 | Soft delete                    |

**Purpose:** Tracks active login sessions. Enables "log out all sessions" and "view active sessions" features.

---

### Table 20: `password_history`

| Column           | Type         | Constraints                          | Description                    |
|------------------|--------------|--------------------------------------|--------------------------------|
| id               | UUID         | PK                                   | Unique identifier              |
| user_id          | UUID         | FK -> users.id, NOT NULL             | User                           |
| password_hash    | VARCHAR(255) | NOT NULL                             | bcrypt hash of old password    |
| created_at       | TIMESTAMP    | NOT NULL, DEFAULT NOW()              | When this password was used    |

**Purpose:** Prevents password reuse. Check last 5 entries before allowing password change.

---

### Table 21: `system_configs`

| Column        | Type              | Constraints                          | Description                    |
|---------------|-------------------|--------------------------------------|--------------------------------|
| id            | UUID              | PK                                   | Unique identifier              |
| config_key    | VARCHAR(100)      | UNIQUE, NOT NULL                     | Config key (e.g., SCAN_FEE)   |
| config_value  | TEXT              | NOT NULL                             | Config value (stored as text)  |
| value_type    | config_value_type | NOT NULL, DEFAULT 'STRING'           | How to interpret the value     |
| description   | TEXT              | NULL                                 | What this config does          |
| is_public     | BOOLEAN           | NOT NULL, DEFAULT FALSE              | Exposed to frontend?           |
| created_at    | TIMESTAMP         | NOT NULL, DEFAULT NOW()              |                                |
| updated_at    | TIMESTAMP         | NOT NULL, DEFAULT NOW()              |                                |

**Seed data:**
| Key                      | Value   | Type    | Description                        |
|--------------------------|---------|---------|------------------------------------|
| `SCAN_FEE_ETB`           | 200     | NUMBER  | Flat scanning/admin fee            |
| `DRAFT_EXPIRY_HOURS`     | 48      | NUMBER  | Hours before draft expires         |
| `MAX_LOGIN_ATTEMPTS`     | 5       | NUMBER  | Failed attempts before lockout     |
| `LOCKOUT_MINUTES`        | 15      | NUMBER  | Lockout duration in minutes        |
| `ACCESS_TOKEN_EXPIRY_MIN`| 15      | NUMBER  | Access token lifetime              |
| `REFRESH_TOKEN_EXPIRY_DAYS`| 7     | NUMBER  | Refresh token lifetime             |
| `QR_TOKEN_EXPIRY_DAYS`   | 365     | NUMBER  | QR verification validity           |
| `SYSTEM_NAME`            | CustomsDuty Pro | STRING | System display name          |
| `SYSTEM_VERSION`         | 1.0.0   | STRING  | Current version                    |
| `MAINTENANCE_MODE`       | false   | BOOLEAN | Maintenance mode toggle            |
| `MAX_ITEMS_PER_ASSESSMENT`| 50     | NUMBER  | Max line items per assessment      |
| `DEFAULT_CURRENCY`       | USD     | STRING  | Default currency for calculator    |

---

### Table 22: `notification_templates`

| Column        | Type              | Constraints                          | Description                    |
|---------------|-------------------|--------------------------------------|--------------------------------|
| id            | UUID              | PK                                   | Unique identifier              |
| template_key  | VARCHAR(100)      | UNIQUE, NOT NULL                     | e.g., ASSESSMENT_APPROVED      |
| name          | VARCHAR(200)      | NOT NULL                             | Human-readable name            |
| channel       | notification_type | NOT NULL                             | EMAIL, SMS, or IN_APP          |
| subject_template | TEXT           | NULL                                 | Subject with {{placeholders}}  |
| body_template | TEXT              | NOT NULL                             | Body with {{placeholders}}     |
| is_active     | BOOLEAN           | NOT NULL, DEFAULT TRUE               |                                |
| created_at    | TIMESTAMP         | NOT NULL, DEFAULT NOW()              |                                |
| updated_at    | TIMESTAMP         | NOT NULL, DEFAULT NOW()              |                                |

**Purpose:** Configurable notification templates with placeholder substitution. Allows admins to edit notification text without code changes.

---

### Table 23: `notifications`

| Column        | Type               | Constraints                              | Description                    |
|---------------|--------------------|------------------------------------------|--------------------------------|
| id            | UUID               | PK                                       | Unique identifier              |
| user_id       | UUID               | FK -> users.id, NOT NULL                 | Recipient                      |
    | template_id  | UUID               | FK -> notification_templates.id, NULL    | Source template                |
| type          | notification_type  | NOT NULL                                 | Channel                        |
| status        | notification_status| NOT NULL, DEFAULT 'PENDING'              | Delivery status                |
| subject       | VARCHAR(500)       | NOT NULL                                 | Title/subject                  |
| body          | TEXT               | NOT NULL                                 | Content                        |
    | metadata     | JSONB              | NULL                                     | assessment_id, etc.            |
| sent_at       | TIMESTAMP          | NULL                                     | When delivered                 |
| read_at       | TIMESTAMP          | NULL                                     | When read                      |
| retry_count   | INTEGER            | NOT NULL, DEFAULT 0                      | Delivery retry attempts        |
| created_at    | TIMESTAMP          | NOT NULL, DEFAULT NOW()                  |                                |
| deleted_at    | TIMESTAMP          | NULL                                     | Soft delete                    |

---

### Table 24: `audit_logs`

| Column        | Type          | Constraints                              | Description                    |
|---------------|---------------|------------------------------------------|--------------------------------|
| id            | UUID          | PK                                       | Unique identifier              |
| user_id       | UUID          | FK -> users.id, NULL                     | Actor (NULL for system)        |
| action        | audit_action  | NOT NULL                                 | What happened                  |
| entity_name   | VARCHAR(100)  | NOT NULL                                 | Table/entity affected          |
| entity_id     | UUID          | NULL                                     | ID of affected record          |
| old_values    | JSONB         | NULL                                     | Previous state                 |
| new_values    | JSONB         | NULL                                     | New state                      |
| ip_address    | VARCHAR(45)   | NULL                                     | IPv4 or IPv6                   |
| user_agent    | TEXT          | NULL                                     | Client user agent              |
| request_id    | VARCHAR(100)  | NULL                                     | Correlation ID                 |
| session_id    | UUID          | NULL                                     | User session reference         |
| duration_ms   | INTEGER       | NULL                                     | Operation duration (if timed)  |
| timestamp     | TIMESTAMP     | NOT NULL, DEFAULT NOW()                  | When it happened               |

**Constraints:** APPEND-ONLY. No UPDATE or DELETE allowed. Enforced via PostgreSQL trigger `prevent_audit_modification`.

**Indexes:** `user_id`, `(entity_name, entity_id)`, `action`, `timestamp DESC`, `request_id`.

---

## 2.4 Entity Relationship Diagram

```
┌──────────┐     ┌──────────────┐     ┌───────────────┐
│ branches │◄────│    users     │────►│refresh_tokens │
└──────────┘     └──────┬───────┘     └───────────────┘
     ▲                  │
     │                  │ user_id
     │          ┌───────┴────────┐
     │          │                │
     │          ▼                ▼
┌────┴─────┐  ┌──────────┐  ┌────────────────┐
│   ports   │  │forex_rates│  │ user_sessions  │
└────┬─────┘  └──────────┘  └────────────────┘
     │
     │ port_of_entry_id
     ▼
┌────────────────┐     ┌──────────────────┐     ┌──────────────┐
│ consignments   │────►│   assessments    │────►│ payment_records│
└────────────────┘     └────────┬─────────┘     └──────────────┘
                                │
              ┌─────────────────┼──────────────────────┐
              │                 │                      │
              ▼                 ▼                      ▼
┌──────────────────┐ ┌────────────────────┐ ┌────────────────────┐
│assessment_items  │ │assessment_documents│ │assessment_status   │
└──────────────────┘ └────────────────────┘ │     _history       │
              │                             └────────────────────┘
              ▼                                    │
┌──────────────┐    ┌────────────────────┐         │
│   hs_codes   │◄───│commodity_categories│    ┌────┴─────────────┐
└──────────────┘    └────────────────────┘    │assessment_comments│
                                              └──────────────────┘
┌──────────────┐    ┌────────────────────┐
│  countries   │    │  scanning_reports  │
└──────────────┘    └────────────────────┘

┌──────────────────────┐  ┌─────────────────┐
│ assessment_appeals   │  │ daily_summaries  │
└──────────────────────┘  └─────────────────┘

┌──────────────────┐  ┌──────────────────────┐  ┌──────────────┐
│rate_overrides    │  │notification_templates│  │system_configs│
└──────────────────┘  └──────────────────────┘  └──────────────┘

┌──────────────────┐  ┌─────────────────┐
│  notifications   │  │  audit_logs      │
└──────────────────┘  └─────────────────┘

┌──────────────────┐
│password_history  │
└──────────────────┘
```

## 2.5 Seed Data Requirements

### Branches
| Code | Name                            | City          | Region        |
|------|---------------------------------|---------------|---------------|
| ADD  | Bole International Airport      | Addis Ababa   | Addis Ababa   |
| ADP  | Passenger Terminal              | Addis Ababa   | Addis Ababa   |
| KAL  | Kality Dry Port                 | Addis Ababa   | Addis Ababa   |
| DRM  | Dire Dawa Customs Branch        | Dire Dawa     | Dire Dawa     |
| BDR  | Bahir Dar Customs Branch        | Bahir Dar     | Amhara        |
| MKL  | Mekelle Customs Branch          | Mekelle       | Tigray        |
| JIM  | Jimma Customs Branch            | Jimma         | Oromia        |
| ASM  | Assab Corridor Office           | Assab         | SNNPR         |

### Ports of Entry
| Code | Name                          | Type       | Branch |
|------|-------------------------------|------------|--------|
| ADD  | Bole International Airport    | AIRPORT    | ADD    |
| JIM  | Djibouti Corridor (Dry Port)  | DRY_PORT   | KAL    |
| MAS  | Mekelle Dry Port              | DRY_PORT   | MKL    |
| ASS  | Assab Land Border             | LAND_BORDER| ASM    |

### Countries (top trading partners)
| Code | Name                 |
|------|----------------------|
| CHN  | China                |
| USA  | United States        |
| IND  | India                |
| TUR  | Turkey               |
| SAU  | Saudi Arabia         |
| ARE  | United Arab Emirates |
| DEU  | Germany              |
| JPN  | Japan                |
| KOR  | South Korea          |
| NLD  | Netherlands          |
| ITA  | Italy                |
| GBR  | United Kingdom       |

### Commodity Categories (top-level chapters)
| Code | Name                                              |
|------|---------------------------------------------------|
| 01-05| Live Animals and Animal Products                  |
| 06-14| Vegetable Products                                |
| 15   | Fats and Oils                                     |
| 16-24| Foodstuffs, Beverages, Tobacco                    |
| 25-27| Mineral Products                                  |
| 28-38| Chemicals and Allied Industries                   |
| 39-40| Plastics and Rubber                               |
| 41-43| Raw Hides, Skins, Leather                         |
| 44-49 | Wood and Wood Products                           |
| 50-63| Textiles and Textile Articles                     |
| 64-67| Footwear, Headgear                                 |
| 68-70| Stone, Ceramic, Glass                              |
| 71   | Precious Stones, Jewelry                          |
| 72-83| Base Metals and Articles                          |
| 84-85| Machinery and Electrical Equipment                 |
| 86-89| Vehicles, Aircraft, Vessels                        |
| 90-92| Optical, Medical, Musical Instruments              |
| 93   | Arms and Ammunition                               |
| 94-96| Miscellaneous Manufactured Articles               |

### Initial HS Codes (sample)
| Code       | Description                    | Category | Duty | Excise | VAT  | Sur  | With  |
|------------|--------------------------------|----------|------|--------|------|------|-------|
| 8517.13.00 | Smartphones                    | 85       | 0.05 | 0.00   | 0.15 | 0.10 | 0.03  |
| 8703.23.90 | SUV Vehicles (>1500cc)         | 87       | 0.35 | 0.30   | 0.15 | 0.10 | 0.03  |
| 0201.30.00 | Fresh Beef                     | 02       | 0.20 | 0.00   | 0.15 | 0.00 | 0.03  |
| 3004.90.00 | Medicaments (mixed)            | 30       | 0.00 | 0.00   | 0.15 | 0.00 | 0.03  |
| 1001.19.00 | Durum Wheat                    | 10       | 0.00 | 0.00   | 0.15 | 0.00 | 0.03  |
| 8471.30.00 | Laptop Computers               | 84       | 0.05 | 0.00   | 0.15 | 0.10 | 0.03  |
| 6110.30.00 | Synthetic Textile Garments      | 61       | 0.20 | 0.00   | 0.15 | 0.10 | 0.03  |
| 2201.10.00 | Mineral Water                  | 22       | 0.10 | 0.10   | 0.15 | 0.00 | 0.03  |

### Initial Forex Rates
| Currency | Rate (example) |
|----------|---------------|
| USD      | 57.50         |
| EUR      | 62.80         |
| GBP      | 73.20         |
| AED      | 15.65         |
| CNY      | 7.95          |
| CAD      | 42.10         |
| INR      | 0.68          |
| SAR      | 15.33         |
| TRY      | 1.72          |
| JPY      | 0.39          |

### Default Super Admin
- Email: `admin@customs.gov.et`
- Password: Generated at setup (displayed once, must change on first login)
- Role: `SUPER_ADMIN`
- Branch: `ADD` (Bole International Airport)

## 2.6 Table Summary

| #  | Table                      | Purpose                                  | Mutable? |
|----|----------------------------|------------------------------------------|----------|
| 1  | users                      | Authentication & user profiles           | Yes      |
| 2  | branches                   | Branch/location master data              | Yes      |
| 3  | countries                  | Country master data                      | No       |
| 4  | ports                      | Port of entry master data                | Yes      |
| 5  | commodity_categories       | HS code hierarchy/grouping               | Yes      |
| 6  | hs_codes                   | Harmonized tariff codes & rates          | Yes      |
| 7  | forex_rates                | Daily exchange rates                     | Yes      |
| 8  | consignments               | Physical shipment tracking               | Yes      |
| 9  | assessments                | Master declaration/assessment records    | Yes      |
| 10 | assessment_items           | Line items per assessment                | Yes      |
| 11 | assessment_documents       | Uploaded supporting documents            | Yes      |
| 12 | assessment_status_history  | Status change audit trail                | **No**   |
| 13 | assessment_comments        | Officer-importer communication           | Yes      |
| 14 | payment_records            | Payment tracking (partial payments)      | Yes      |
| 15 | scanning_reports           | Physical inspection results              | Yes      |
| 16 | assessment_appeals         | Dispute resolution workflow              | Yes      |
| 17 | rate_overrides             | Temporary government rate changes        | Yes      |
| 18 | daily_summaries            | Pre-computed daily revenue rollups       | Yes      |
| 19 | user_sessions              | Active login session tracking            | Yes      |
| 20 | password_history           | Prevent password reuse                   | **No**   |
| 21 | system_configs             | Feature flags & system settings          | Yes      |
| 22 | notification_templates     | Configurable notification templates      | Yes      |
| 23 | notifications              | Sent notification records                | Yes      |
| 24 | audit_logs                 | Immutable security audit trail           | **No**   |
