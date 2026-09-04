# Technical Specification — Part 6: UI/UX, PDF/QR & Workflows

## 6.1 Application Routes

### Public Routes (No Auth)
```
/                          # Landing page with calculator
/calculator                # Full calculator page
/verify/:verificationHash  # QR code verification page
/login                     # Login page
/register                  # Registration page
/forgot-password           # Password reset request
```

### Authenticated Routes
```
/dashboard                 # Role-based redirect to appropriate dashboard
/dashboard/officer         # Officer workspace
/dashboard/admin           # Admin panel
/assessments               # List assessments (filtered by role)
/assessments/:id           # Assessment detail view
/assessments/new           # Create new assessment (draft)
/settings/hs-codes         # HS code management (tariff specialist+)
/settings/forex            # Forex rate management (tariff specialist+)
/settings/users            # User management (admin only)
/settings/overrides        # Rate overrides (tariff specialist+)
/audit                     # Audit logs (admin only)
/reports                   # Reports & analytics (specialist+)
/notifications             # Notification center
```

## 6.2 Page Specifications

### 6.2.1 Public Calculator Page

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  HEADER: Logo | Navigation | Login/Register buttons  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │  SECTION 1: HS Code Search                      │ │
│  │  [Search input with instant autocomplete]       │ │
│  │  - Shows code, description (EN), duty rate      │ │
│  │  - Click to select, adds to item list           │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │  SECTION 2: Item Details (per selected item)     │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │ │
│  │  │ Currency │ │ Quantity │ │ Unit Price       │ │ │
│  │  │ Dropdown │ │ Number   │ │ Number           │ │ │
│  │  └──────────┘ └──────────┘ └──────────────────┘ │ │
│  │  ┌──────────────────┐ ┌───────────────────────┐ │ │
│  │  │ Freight Amount   │ │ Insurance Amount      │ │ │
│  │  │ Number           │ │ Number                │ │ │
│  │  └──────────────────┘ └───────────────────────┘ │ │
│  │  [Remove Item]  [+ Add Another Item]            │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │  SECTION 3: Exemption Type (if applicable)       │ │
│  │  [None] [Diaspora] [Investment] [Diplomatic]     │ │
│  │  (Show explanation tooltip for each)             │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │  SECTION 4: Real-time Tax Breakdown              │ │
│  │                                                  │ │
│  │  CIF Value:           ETB 575,000.00             │ │
│  │  ████████████████████░░░░░░░░░░░  Duty (5%)      │ │
│  │  Customs Duty:        ETB  28,750.00             │ │
│  │  ░░░░████████░░░░░░░░░░░░░░░░░░  Excise (0%)    │ │
│  │  Excise Tax:          ETB       0.00             │ │
│  │  ████████████████████████████████  VAT (15%)    │ │
│  │  VAT:                 ETB  90,562.50             │ │
│  │  ██████████████████████░░░░░░░░░  Sur-Tax (10%) │ │
│  │  Sur-Tax:             ETB  60,375.00             │ │
│  │  ░░░░░░░░░░░░░░░░░░░░██████████  Withhold (3%) │ │
│  │  Withholding:         ETB  17,250.00             │ │
│  │  Scanning Fee:        ETB     200.00             │ │
│  │  ─────────────────────────────────               │ │
│  │  TOTAL PAYABLE:       ETB 197,137.50             │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  [Create Account to Save & Submit]                   │
│  [Sign in to Submit Official Assessment]             │
│                                                      │
├─────────────────────────────────────────────────────┤
│  FOOTER                                             │
└─────────────────────────────────────────────────────┘
```

**Behaviors:**
- Tax breakdown updates **in real-time** as inputs change (debounced 300ms)
- Visual progress bars scale proportionally to each tax component
- Currency dropdown auto-fills exchange rate from latest forex data
- Multiple items supported — totals aggregate across all items
- Responsive: stacks vertically on mobile
- No data persisted until user registers/submits

### 6.2.2 Officer Dashboard

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  SIDEBAR          │  MAIN CONTENT                    │
│                   │                                   │
│  📊 Dashboard     │  ┌──────┐ ┌──────┐ ┌──────────┐ │
│  📋 Assessments   │  │Pending│ │Today │ │Revenue   │ │
│  🔍 Search        │  │  12   │ │  8   │ │ETB 2.5M  │ │
│  🔔 Notifications │  └──────┘ └──────┘ └──────────┘ │
│  ⚙️ Settings      │                                   │
│                   │  ┌─────────────────────────────┐ │
│                   │  │ Pending Assessments Queue    │ │
│                   │  │ ┌─────────────────────────┐  │ │
│                   │  │ │ #001245 | John Doe | ... │  │ │
│                   │  │ │ Submitted 2h ago | VIEW  │  │ │
│                   │  │ └─────────────────────────┘  │ │
│                   │  │ ┌─────────────────────────┐  │ │
│                   │  │ │ #001244 | Amina | ...    │  │ │
│                   │  │ │ Submitted 3h ago | VIEW  │  │ │
│                   │  │ └─────────────────────────┘  │ │
│                   │  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 6.2.3 Assessment Detail / Review Page

**Layout (Split-screen for officers):**
```
┌────────────────────────────────────────────────────────────┐
│  ASSESSMENT #ECC-ADD-2026-001245                    [PDF] │
│  Status: SUBMITTED  |  Exemption: NONE                     │
├────────────────────────────┬───────────────────────────────┤
│  LEFT: Declaration Details │  RIGHT: Tax Breakdown & Actions│
│                            │                                │
│  Declarant: John Doe       │  ┌────────────────────────┐   │
│  TIN: 0012345678           │  │ Item 1: Smartphones    │   │
│  Branch: Bole Airport      │  │ HS: 8517.13.00         │   │
│  Currency: USD @ 57.50     │  │ Qty: 100 × $250        │   │
│                            │  │ CIF: ETB 575,000       │   │
│  Item List:                │  │ Duty: ETB 28,750       │   │
│  ┌────────────────────┐    │  │ Excise: ETB 0          │   │
│  │ #1 8517.13.00 ×100 │    │  │ VAT: ETB 90,562.50    │   │
│  │ #2 8471.30.00 × 50 │    │  │ Sur-Tax: ETB 60,375   │   │
│  └────────────────────┘    │  │ Withholding: ETB 17,250│   │
│                            │  └────────────────────────┘   │
│                            │                                │
│                            │  TOTAL: ETB 197,137.50        │
│                            │                                │
│                            │  Officer Notes:                │
│                            │  [________________________]   │
│                            │                                │
│                            │  [✓ APPROVE]  [✗ REJECT]      │
└────────────────────────────┴───────────────────────────────┘
```

### 6.2.4 QR Verification Page (Public)

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│         ┌───────────────────────────────┐            │
│         │     ✓  PAID & CLEARED         │  GREEN    │
│         │                               │            │
│         │  Assessment: ECC-ADD-2026-001245│          │
│         │  Declarant:  John Doe          │          │
│         │  TIN:        ****5678         │          │
│         │  Total Tax:  ETB 197,137.50    │          │
│         │  Approved:   Sep 4, 2026       │          │
│         │  Branch:     Bole Airport      │          │
│         │                               │            │
│         └───────────────────────────────┘            │
│                                                      │
│         Status colors:                               │
│         🟢 PAID & CLEARED (APPROVED + PAID)          │
│         🟡 UNDER REVIEW (SUBMITTED/APPROVED, unpaid) │
│         🔴 INVALID / NOT FOUND                       │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## 6.3 PDF Assessment Document Specification

### Layout

```
┌─────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────┐ │
│  │  ETHIOPIAN CUSTOMS COMMISSION                   │ │
│  │  የኢትዮጵያ የ customs ኮሚሽን                     │ │
│  │  [Logo]            Branch: Bole Airport Cargo   │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  OFFICIAL CUSTOMS ASSESSMENT NOTICE                  │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Assessment No:  ECC-ADD-2026-001245            │ │
│  │  Date:           September 4, 2026              │ │
│  │  Officer:        Badge #BO-1234                  │ │
│  │  Declarant:      John Doe                       │ │
│  │  TIN:            0012345678                     │ │
│  │  Passport:       A12345678                      │ │
│  │  Branch:         Bole Airport Cargo             │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  SECTION A: ITEMIZED TAX COMPUTATION                 │
│                                                      │
│  ┌────┬───────────┬──────┬────────┬────────────────┐ │
│  │ #  │ HS Code   │ Desc │ CIF ETB│ Tax Breakdown  │ │
│  ├────┼───────────┼──────┼────────┼────────────────┤ │
│  │ 1  │ 8517.13.00│Phone │575,000 │D:28,750 E:0   │ │
│  │    │           │      │        │V:90,562 S:60,375│ │
│  │    │           │      │        │W:17,250        │ │
│  └────┴───────────┴──────┴────────┴────────────────┘ │
│                                                      │
│  SECTION B: TAX SUMMARY                              │
│                                                      │
│  Customs Duty (ቀረጥ):          ETB    28,750.00      │
│  Excise Tax (ኤክሳይስ):         ETB         0.00      │
│  VAT (የተጨማሪ እሴት ታክስ):     ETB    90,562.50      │
│  Sur-Tax (ሰር ታክስ):          ETB    60,375.00      │
│  Withholding (የቅድሚያ ግብር):  ETB    17,250.00      │
│  Scanning/Admin Fee:           ETB       200.00      │
│  ──────────────────────────────────────────────      │
│  TOTAL PAYABLE:                ETB   197,137.50      │
│                                                      │
│  Total in Words:                                     │
│  One Hundred Ninety-Seven Thousand One Hundred       │
│  Thirty-Seven Birr and Fifty Cents Only              │
│                                                      │
│  ┌─────────────┐          ┌──────────────────┐      │
│  │ [QR Code]    │          │ Officer Stamp    │      │
│  │ Scan to      │          │ & Signature      │      │
│  │ verify       │          │                  │      │
│  │              │          │ ________________ │      │
│  └─────────────┘          └──────────────────┘      │
│                                                      │
│  Watermark: "DRAFT" (if not yet approved)            │
│  Watermark: "OFFICIAL" (after approval)              │
└─────────────────────────────────────────────────────┘
```

### PDF Generation Specs
- **Format**: A4 portrait
- **Font**: Embedded (supports Amharic characters via Noto Sans Ethiopic)
- **Bilingual**: Section headers in English + Amharic
- **Watermark**: Semi-transparent, diagonally placed
- **QR Code**: Bottom-left, 2cm × 2cm, high error correction (Level H)
- **File naming**: `ECC-ADD-2026-001245.pdf`
- **Content-Type**: `application/pdf`
- **Content-Disposition**: `attachment; filename="ECC-ADD-2026-001245.pdf"`

## 6.4 QR Code Specification

### QR Payload (Signed JWT)

```json
{
  "hash": "unique-assessment-hash",
  "assessmentNumber": "ECC-ADD-2026-001245",
  "status": "APPROVED",
  "totalPayable": 197137.50,
  "issuedAt": 1725456000,
  "expiresAt": 1756992000  // 1 year validity
}
```

- Signed with `QR_SIGNING_KEY` using HS256
- Verification endpoint checks signature + expiry + assessment status
- QR encodes URL: `https://customs.gov.et/verify/{jwt}`

### Verification Flow
```
1. Gate officer scans QR code
2. Browser opens verification URL
3. Server verifies JWT signature
4. Server checks assessment status in DB
5. Returns color-coded result:
   - GREEN: APPROVED + PAID
   - YELLOW: SUBMITTED or APPROVED but unpaid
   - RED: Invalid JWT, expired, or not found
```

## 6.5 Notification Specifications

| Event                     | Channel     | Recipient          | Template                    |
|---------------------------|-------------|--------------------|-----------------------------|
| Assessment submitted      | Email, SMS  | Declarant          | "Your assessment #X has been submitted for review" |
| Assessment approved       | Email, SMS  | Declarant          | "Your assessment #X has been approved. Total: ETB Y" |
| Assessment rejected       | Email       | Declarant          | "Your assessment #X was rejected. Reason: Z" |
| New assessment pending    | In-App      | Assigned officer   | "New assessment awaiting review" |
| Payment confirmed         | Email, SMS  | Declarant          | "Payment confirmed for assessment #X" |
| Forex rate updated        | In-App      | All active users   | "Daily forex rates have been updated" |
| Account locked            | Email       | Account holder     | "Your account has been locked due to..." |

## 6.6 Responsive Design Breakpoints

| Breakpoint | Width      | Layout Behavior                          |
|------------|------------|------------------------------------------|
| Mobile     | < 640px    | Single column, stacked cards, hamburger nav |
| Tablet     | 640-1024px | Two-column where possible                |
| Desktop    | > 1024px   | Full layout with sidebar                 |
| Large      | > 1280px   | Extended dashboard with more data density |

## 6.7 Accessibility (WCAG 2.1 AA)
- All form inputs have associated labels
- Color contrast ratio ≥ 4.5:1 for text
- Status indicators use color + text/icon (not color alone)
- Keyboard navigation for all interactive elements
- Screen reader announcements for dynamic content (ARIA live regions)
- Focus management on modal dialogs and page transitions
