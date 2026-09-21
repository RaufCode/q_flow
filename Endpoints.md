# Q-Flow API Reference

Complete technical dictionary and payload reference for the Q-Flow queue-management backend.

Base URL: `https://q-flow-backend.vercel.app/api/v1` (production base URL may differ)
Interactive docs (Swagger UI): `/docs` — Raw OpenAPI JSON: `/docs/json`

---

## Table of Contents

- [1. Conventions & Shared Types](#1-conventions--shared-types)
- [2. Public — Customer Check-In (`/tickets`)](#2-public--customer-check-in-tickets)
- [3. Authentication & Shift Binding (`/auth`)](#3-authentication--shift-binding-auth)
- [4. Counter Staff (`/staff`)](#4-counter-staff-staff)
- [5. Admin — Infrastructure & Users (`/admin`)](#5-admin--infrastructure--users-admin)
- [6. Admin — Queue Overrides & Priority (`/admin`)](#6-admin--queue-overrides--priority-admin)
- [7. Admin — Analytics & Operational Metrics (`/admin/analytics`)](#7-admin--analytics--operational-metrics-adminanalytics)

---

## 1. Conventions & Shared Types

### 1.1 Access & Security Model

| Area | Auth | Header |
| --- | --- | --- |
| Customer check-in & ticket tracking | None (public) | — |
| Staff endpoints | `COUNTER_STAFF` role | `Authorization: Bearer <token>` |
| Admin endpoints | `ADMIN` role | `Authorization: Bearer <token>` |

- All tokens are JWTs issued by `POST /auth/login`, valid for **12 hours**.
- Tokens missing/invalid → `401 { error: "..." }`; authenticated but wrong role → `403 { error: "..." }`.

### 1.2 Rate Limiting

| Scope | Window | Limit | Notes |
| --- | --- | --- | --- |
| Global API rimiter (all `/api/*`) | 15 minutes | 100 requests/IP | Prevents spam ticket generation |
| Login (`/auth/login`) | 15 minutes | 500 requests/IP | Stricter anti-brute-force |

Exceeding a limit → `429 { error: "Too many requests. Please try again later." }`.

### 1.3 Enums (authoritative values)

**TicketStatus** — `WAITING`, `CALLED`, `IN_SERVICE`, `SERVED`, `SKIPPED`, `CANCELLED`, `AUTO_CANCELLED`

**NotificationChannel (`preferredChannel`)** — `WHATSAPP`, `SMS`, `NONE`

**UserRole** — `ADMIN`, `COUNTER_STAFF`

### 1.4 Lifecycle of a ticket

```
WAITING ──(call-next)──▶ CALLED ──(start)──▶ IN_SERVICE ──(complete)──▶ SERVED
   │                        │                    │
   │                        └──(skip)──▶ WAITING (skipCount+1)  (+2 more skips → AUTO_CANCELLED)
   └──(cancel)──▶ CANCELLED
```

- Tickets with `skipCount` reaching **3** are `AUTO_CANCELLED` automatically.
- Calling/Serving/Cancelling a ticket recomputes `currentPosition` for all tickets behind it and broadcasts a real-time socket event.

### 1.5 Standard error envelope

Errors are always returned as:

```json
{ "error": "Human readable reason." }
```

with a `4xx` / `5xx` status code.

---

## 2. Public — Customer Check-In (`/tickets`)

These endpoints are **unauthenticated** to allow seamless self-check-in via QR-code scan on mobile.

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/tickets/check-in` | Public | Issue a new ticket & join the queue |
| `GET` | `/api/v1/tickets/:id/status` | Public | Fetch real-time wait position & status |
| `POST` | `/api/v1/tickets/:id/cancel` | Public | Self-cancel an active ticket |

### 2.1 `POST /api/v1/tickets/check-in`

Allows a customer to join the virtual queue. Assigns a sequential ticket number (`A-001`…), calculates the initial position, estimates the wait time (≈3 min per waiting ticket), sends a join notification, and triggers real-time socket events.

**Headers**

| Header | Value |
| --- | --- |
| `Content-Type` | `application/json` |

**Request Body**

```json
{
  "customerName": "Kweku Ananse",
  "phoneNumber": "+233241234567",
  "preferredChannel": "WHATSAPP"
}
```

**Payload Constraints**

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `customerName` | string | **Yes** | 2–100 chars; letters (any language), spaces, `.`, `'`, `-` |
| `phoneNumber` | string | **Yes** | Ghanaian number, e.g. `0241234567` or `+233241234567` (normalized to `23324...`) |
| `preferredChannel` | string | No | `WHATSAPP` \| `SMS` \| `NONE`. Defaults to `WHATSAPP` |

**Response `201 Created`**

```json
{
  "message": "Check-in successful",
  "ticket": {
    "id": "tkt_888aaa111...",
    "ticketNumber": "A-042",
    "customerName": "Kweku Ananse",
    "phoneNumber": "233241234567",
    "preferredChannel": "WHATSAPP",
    "status": "WAITING",
    "initialPosition": 15,
    "currentPosition": 15,
    "estimatedWaitTimeMinutes": 45,
    "skipCount": 0,
    "joinedAt": "2026-09-15T09:15:00.000Z",
    "calledAt": null,
    "servicedAt": null,
    "completedAt": null,
    "skippedAt": null,
    "cancelledAt": null,
    "counterId": null,
    "servicedByStaffId": null
  }
}
```

> The returned `ticket` is the **full** ticket record. `estimatedWaitTimeMinutes = currentPosition × 3`.

**Errors** — `400` missing/invalid fields (`error`), `500` server failure.

---

### 2.2 `GET /api/v1/tickets/:id/status`

Live status lookup used by the customer's mobile web view to render real-time position, estimated wait time, and counter assignment.

**Path Parameters**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | **Yes** | Ticket ID returned during check-in |

**Request Body** — None. **Headers** — None.

**Response `200 OK` — waiting in queue**

```json
{
  "ticket": {
    "id": "tkt_888aaa111...",
    "ticketNumber": "A-042",
    "customerName": "Kweku Ananse",
    "status": "WAITING",
    "currentPosition": 3,
    "estimatedWaitTimeMinutes": 9,
    "skipCount": 0,
    "counter": null
  }
}
```

**Response `200 OK` — called to counter**

```json
{
  "ticket": {
    "id": "tkt_888aaa111...",
    "ticketNumber": "A-042",
    "customerName": "Kweku Ananse",
    "status": "CALLED",
    "currentPosition": 0,
    "estimatedWaitTimeMinutes": 0,
    "skipCount": 0,
    "counter": {
      "counterNumber": 2,
      "counterName": "Express Desk 2"
    }
  }
}
```

> `counter` is `null` until the ticket has been called (`CALLED`) and bound to a desk. `currentPosition: 0` means the customer is at (or past) the counter.

**Errors** — `404` ticket not found.

---

### 2.3 `POST /api/v1/tickets/:id/cancel`

Lets a customer self-cancel before being served. Recomputes wait positions for everyone behind them and broadcasts a queue update.

**Path Parameters**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | **Yes** | Ticket ID |

**Request Body** — None. **Headers** — None.

**Response `200 OK`**

```json
{
  "message": "Your ticket has been successfully cancelled.",
  "ticket": {
    "id": "tkt_888aaa111...",
    "ticketNumber": "A-042",
    "customerName": "Kweku Ananse",
    "status": "CANCELLED",
    "currentPosition": 0,
    "cancelledAt": "2026-09-15T09:25:00.000Z"
  }
}
```

**Errors** — `400` ticket not in `WAITING`/`CALLED` state, `404` ticket not found.

---

## 3. Authentication & Shift Binding (`/auth`)

Staff and admins obtain their JWT here, and counter staff bind/unbind their active shift.

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/login` | Public (rate-limited) | Authenticate & receive JWT |
| `POST` | `/api/v1/auth/bind-shift` | Bearer token | Bind shift to a counter |
| `POST` | `/api/v1/auth/unbind-shift` | Bearer token | End shift & free the counter |

### 3.1 `POST /api/v1/auth/login`

**Request Body**

```json
{
  "employeeId": "ADM-001",
  "password": "YourSecurePassword123!"
}
```

**Response `200 OK`**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr_789xyz...",
    "employeeId": "ADM-001",
    "fullName": "System Administrator",
    "role": "ADMIN",
    "activeCounter": null
  }
}
```

> Send the returned token as `Authorization: Bearer <token>` on all protected requests. `activeCounter` is non-null only for staff currently bound to a desk.

**Errors** — `400` missing fields, `401` invalid credentials, `429` rate limited.

---

### 3.2 `POST /api/v1/auth/bind-shift`

Binds the authenticated staff member to a counter for their active shift. Unbinds them from any previous counter first.

**Request Body**

```json
{
  "counterId": "cnt_12345"
}
```

**Response `200 OK`**

```json
{
  "message": "Shift successfully bound.",
  "counter": {
    "id": "cnt_12345",
    "counterNumber": 1,
    "counterName": "Express Desk 1",
    "isActive": true,
    "currentStaffId": "usr_789xyz..."
  }
}
```

> A counter must be `isActive: true` and not already bound to another staff member.

**Errors** — `400` invalid/inactive counter or already occupied, `401` unauthenticated.

---

### 3.3 `POST /api/v1/auth/unbind-shift`

Frees the current staff member's counter (i.e., logout / clock out).

**Request Body** — None.

**Response `200 OK`**

```json
{
  "message": "Shift unbound successfully."
}
```

**Errors** — `400` no active shift binding, `401` unauthenticated.

---

## 4. Counter Staff (`/staff`)

Used by counter personnel during an active shift to manage call flows and service transitions. **All routes require a `COUNTER_STAFF` JWT.**

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/staff/shift-overview` | `COUNTER_STAFF` | Current counter, active ticket, queue count & waiting list |
| `GET` | `/api/v1/staff/history` | `COUNTER_STAFF` | Finalized tickets previously handled by this staff |
| `GET` | `/api/v1/staff/counters` | `COUNTER_STAFF` | List counters for shift binding (staff-accessible) |
| `POST` | `/api/v1/staff/call-next` | `COUNTER_STAFF` | Call the next waiting customer |
| `POST` | `/api/v1/staff/tickets/:id/start` | `COUNTER_STAFF` | Mark ticket `IN_SERVICE` |
| `POST` | `/api/v1/staff/tickets/:id/complete` | `COUNTER_STAFF` | Mark ticket `SERVED` |
| `POST` | `/api/v1/staff/tickets/:id/skip` | `COUNTER_STAFF` | Skip a no-show (3-skip auto-cancel) |

### 4.1 `GET /api/v1/staff/shift-overview`

Fetches the staff member's active counter binding, the currently called/in-service ticket, the total waiting queue count, and the ordered list of waiting tickets.

**Request Body** — None.

**Response `200 OK`**

```json
{
  "counter": {
    "id": "clx123abc...",
    "counterNumber": 1,
    "counterName": "Express Desk 1",
    "isActive": true,
    "currentStaffId": "usr_789xyz..."
  },
  "activeTicket": {
    "id": "tkt_456def...",
    "ticketNumber": "A-014",
    "customerName": "Kwame Mensah",
    "phoneNumber": "233240000000",
    "status": "CALLED",
    "calledAt": "2026-09-15T08:30:00.000Z"
  },
  "waitingCount": 2,
  "waiting": [
    {
      "id": "tkt_456def...",
      "ticketNumber": "A-016",
      "customerName": "Abena Osei",
      "phoneNumber": "233240000000",
      "preferredChannel": "SMS",
      "status": "WAITING",
      "currentPosition": 1,
      "estimatedWaitTimeMinutes": 5,
      "skipCount": 0,
      "joinedAt": "2026-09-15T08:31:00.000Z"
    }
  ]
}
```

> `activeTicket` may be `null` when no ticket is currently called/in service at this counter. `waiting` is ordered by `currentPosition` ascending and contains full ticket records. `counter` is the full counter record (`isActive`, not `isOnline`).

**Errors** — `400` no active shift bound, `401` unauthenticated, `403` wrong role.

---

### 4.1b `GET /api/v1/staff/history`

Returns tickets with a terminal status (`SERVED`, `SKIPPED`, `CANCELLED`, `AUTO_CANCELLED`) that were handled by the authenticated staff member, newest first.

**Request Body** — None.

**Response `200 OK`**

```json
{
  "tickets": [
    {
      "id": "tkt_456def...",
      "ticketNumber": "A-014",
      "customerName": "Kwame Mensah",
      "phoneNumber": "233240000000",
      "preferredChannel": "SMS",
      "status": "SERVED",
      "joinedAt": "2026-09-15T08:00:00.000Z",
      "servicedAt": "2026-09-15T08:12:00.000Z",
      "completedAt": "2026-09-15T08:20:00.000Z",
      "servicedByStaffId": "usr_789xyz..."
    }
  ]
}
```

**Errors** — `401` unauthenticated, `400` on service failure.

---

### 4.1c `GET /api/v1/staff/counters`

Lists all counters with their active staff binding, so counter staff can choose a counter to bind to without admin privileges.

**Request Body** — None.

**Response `200 OK`**

```json
{
  "counters": [
    {
      "id": "clx123abc...",
      "counterNumber": 1,
      "counterName": "Express Desk 1",
      "isActive": true,
      "currentStaffId": null,
      "currentStaff": {
        "id": "usr_789xyz...",
        "employeeId": "STF-004",
        "fullName": "Akosua Boateng"
      }
    }
  ]
}
```

**Errors** — `401` unauthenticated, `403` wrong role.

---

### 4.2 `POST /api/v1/staff/call-next`

Pops the next highest-priority waiting customer (`WAITING`, oldest first), binds them to the staff member's counter, sets `status: CALLED`, notifies the customer, and clears their position to `0`.

**Request Body** — None.

**Response `200 OK`**

```json
{
  "message": "Next customer called.",
  "data": {
    "counter": {
      "id": "clx123abc...",
      "counterNumber": 1,
      "counterName": "Express Desk 1",
      "isActive": true,
      "currentStaffId": "usr_789xyz..."
    },
    "ticket": {
      "id": "tkt_456def...",
      "ticketNumber": "A-015",
      "customerName": "Abena Osei",
      "status": "CALLED",
      "currentPosition": 0,
      "calledAt": "2026-09-15T08:35:00.000Z",
      "counterId": "clx123abc...",
      "servicedByStaffId": "usr_789xyz..."
    }
  }
}
```

> Note: `data` contains both `counter` and `ticket`.

**Errors** — `400` staff not bound to an active counter or no waiting customers, `401`/`403` auth failures.

---

### 4.3 `POST /api/v1/staff/tickets/:id/start`

Transitions a `CALLED` ticket to `IN_SERVICE` when the customer physically arrives at the counter.

**Path Parameters**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | **Yes** | Ticket ID |

**Request Body** — None.

**Response `200 OK`**

```json
{
  "message": "Service started.",
  "ticket": {
    "id": "tkt_456def...",
    "ticketNumber": "A-015",
    "customerName": "Abena Osei",
    "status": "IN_SERVICE",
    "servicedAt": "2026-09-15T08:37:12.000Z",
    "servicedByStaffId": "usr_789xyz..."
  }
}
```

**Errors** — `400` ticket not in `CALLED` status, `401`/`403` auth failures.

---

### 4.4 `POST /api/v1/staff/tickets/:id/complete`

Marks an `IN_SERVICE` ticket as `SERVED` upon successful transaction completion and clears its position.

**Path Parameters**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | **Yes** | Ticket ID |

**Request Body** — None.

**Response `200 OK`**

```json
{
  "message": "Service completed.",
  "ticket": {
    "id": "tkt_456def...",
    "ticketNumber": "A-015",
    "customerName": "Abena Osei",
    "status": "SERVED",
    "completedAt": "2026-09-15T08:42:05.000Z",
    "currentPosition": 0
  }
}
```

**Errors** — `400` ticket not in `IN_SERVICE` status, `401`/`403` auth failures.

---

### 4.5 `POST /api/v1/staff/tickets/:id/skip`

Skips a no-show customer. Increments `skipCount` and re-queues the ticket at the back of the line. **Auto-cancels** (`AUTO_CANCELLED`) when the skip count reaches 3.

**Path Parameters**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | **Yes** | Ticket ID |

**Request Body** — None.

**Response `200 OK` — re-queued (skipCount < 3)**

```json
{
  "message": "Ticket skipped.",
  "ticket": {
    "id": "tkt_456def...",
    "ticketNumber": "A-015",
    "customerName": "Abena Osei",
    "status": "WAITING",
    "skipCount": 1,
    "currentPosition": 13,
    "skippedAt": "2026-09-15T08:40:00.000Z"
  }
}
```

**Response `200 OK` — auto-cancelled (skipCount = 3)**

```json
{
  "message": "Ticket skipped.",
  "ticket": {
    "id": "tkt_456def...",
    "ticketNumber": "A-015",
    "customerName": "Abena Osei",
    "status": "AUTO_CANCELLED",
    "skipCount": 3,
    "currentPosition": 0,
    "cancelledAt": "2026-09-15T08:40:00.000Z"
  }
}
```

**Errors** — `400` processing failure, `404` ticket not found, `401`/`403` auth failures.

---

## 5. Admin — Infrastructure & Users (`/admin`)

Used by administrators to manage configuration, physical counters, and user provisioning. **All routes require an `ADMIN` JWT.**

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/admin/qr-code` | `ADMIN` | Static QR code for self check-in |
| `POST` | `/api/v1/admin/counters` | `ADMIN` | Provision a new counter |
| `GET` | `/api/v1/admin/counters` | `ADMIN` | List all counters + staff bindings |
| `PATCH` | `/api/v1/admin/counters/:id/toggle` | `ADMIN` | Enable / disable a counter |
| `POST` | `/api/v1/admin/counters/:id/force-unbind` | `ADMIN` | Force-release a bound staff member |
| `POST` | `/api/v1/admin/users` | `ADMIN` | Provision staff/admin account |
| `GET` | `/api/v1/admin/users` | `ADMIN` | List all users & shift status |
| `POST` | `/api/v1/admin/users/:id/reset-password` | `ADMIN` | Reset any account's password |

### 5.1 `GET /api/v1/admin/qr-code`

Generates (or retrieves) the static QR assets pointing to the customer self-check-in URL. **Note:** `checkInUrl` may optionally be passed in the request body to override the default.

**Request Body** — optional

```json
{
  "checkInUrl": "https://qflow.enterprise.com/join"
}
```

**Response `200 OK`**

```json
{
  "message": "Static QR code generated successfully.",
  "data": {
    "targetUrl": "https://qflow.enterprise.com/join",
    "pngDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "svgString": "<svg xmlns=\"http://www.w3.org/2000/svg\" ...>"
  }
}
```

> `pngDataUrl` is for UI previews / image downloads; `svgString` is for high-quality printing & signage.

**Errors** — `401`/`403` auth failures, `500` generation failure.

---

### 5.2 `POST /api/v1/admin/counters`

Provisions a new physical counter / register desk. New counters are created as `isActive: true`.

**Request Body**

```json
{
  "counterNumber": 3,
  "counterName": "VIP / Priority Desk"
}
```

**Response `201 Created`**

```json
{
  "message": "Counter created successfully.",
  "counter": {
    "id": "cnt_999aaa...",
    "counterNumber": 3,
    "counterName": "VIP / Priority Desk",
    "isActive": true,
    "currentStaffId": null
  }
}
```

**Errors** — `400` missing fields or `counterNumber` already exists.

---

### 5.3 `GET /api/v1/admin/counters`

Lists all provisioned counters ordered by `counterNumber`, with their current active state and assigned staff details.

**Request Body** — None.

**Response `200 OK`**

```json
{
  "counters": [
    {
      "id": "cnt_999aaa...",
      "counterNumber": 1,
      "counterName": "Express Desk 1",
      "isActive": true,
      "currentStaffId": "usr_789xyz...",
      "currentStaff": {
        "id": "usr_789xyz...",
        "employeeId": "STF-001",
        "fullName": "Kofi Mensah",
        "role": "COUNTER_STAFF"
      }
    }
  ]
}
```

> `currentStaff` is `null` when the counter is unbound.

---

### 5.4 `PATCH /api/v1/admin/counters/:id/toggle`

Enables or disables a counter desk. **Deactivating (`isActive: false`) automatically force-unbinds any attached staff member.**

**Path Parameters**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | **Yes** | Counter ID |

**Request Body**

```json
{
  "isActive": false
}
```

**Response `200 OK`**

```json
{
  "message": "Counter status updated.",
  "counter": {
    "id": "cnt_999aaa...",
    "counterNumber": 1,
    "counterName": "Express Desk 1",
    "isActive": false,
    "currentStaffId": null
  }
}
```

**Errors** — `400` non-boolean `isActive`, `404` counter not found.

---

### 5.5 `POST /api/v1/admin/counters/:id/force-unbind`

Administratively unbinds staff from a counter (forgotten logout, emergency shift handover, etc.).

**Path Parameters**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | **Yes** | Counter ID |

**Request Body** — None.

**Response `200 OK`**

```json
{
  "message": "Staff shift successfully unbound.",
  "counter": {
    "id": "cnt_999aaa...",
    "counterNumber": 1,
    "counterName": "Express Desk 1",
    "isActive": true,
    "currentStaffId": null
  }
}
```

**Errors** — `400` no active staff bound, `404` counter not found.

---

### 5.6 `POST /api/v1/admin/users`

Provisions a new staff or admin account with a hashed password. Default role is `COUNTER_STAFF` when omitted.

**Request Body**

```json
{
  "employeeId": "STF-004",
  "fullName": "Ama Tutu",
  "password": "SecurePassword123!",
  "role": "COUNTER_STAFF"
}
```

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `employeeId` | string | **Yes** | Unique, e.g. `STF-004`, `ADM-001` |
| `fullName` | string | **Yes** | — |
| `password` | string | **Yes** | Hashed with bcrypt; ≥ 6 chars for resets |
| `role` | string | No | `ADMIN` \| `COUNTER_STAFF` (default `COUNTER_STAFF`) |

**Response `201 Created`**

```json
{
  "message": "User provisioned successfully.",
  "user": {
    "id": "usr_111bbb...",
    "employeeId": "STF-004",
    "fullName": "Ama Tutu",
    "role": "COUNTER_STAFF",
    "createdAt": "2026-09-15T08:45:00.000Z"
  }
}
```

**Errors** — `400` missing fields or `employeeId` already registered.

---

### 5.7 `GET /api/v1/admin/users`

Lists all system users and their active shift attachment status. Optional `?role=COUNTER_STAFF|ADMIN` query filter.

**Request Body** — None.

**Response `200 OK`**

```json
{
  "users": [
    {
      "id": "usr_111bbb...",
      "employeeId": "STF-004",
      "fullName": "Ama Tutu",
      "role": "COUNTER_STAFF",
      "createdAt": "2026-09-15T08:45:00.000Z",
      "updatedAt": "2026-09-15T08:45:00.000Z",
      "activeCounter": null
    }
  ]
}
```

> `activeCounter` is `null` for unbound staff, otherwise the bound counter object `{ id, counterNumber, counterName, isActive }`.

**Query Params**

| Param | Type | Description |
| --- | --- | --- |
| `role` | string | Optional filter: `ADMIN` \| `COUNTER_STAFF` |

---

### 5.8 `POST /api/v1/admin/users/:id/reset-password`

Admin password override for any managed account.

**Path Parameters**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | **Yes** | User ID |

**Request Body**

```json
{
  "newPassword": "NewTempPassword2026!"
}
```

**Response `200 OK`**

```json
{
  "message": "Password successfully reset for employee ID: STF-004"
}
```

**Errors** — `400` missing/short password, `404` user not found.

---

## 6. Admin — Queue Overrides & Priority (`/admin`)

Manual queue interventions, priority insertions, and state corrections. **All routes require an `ADMIN` JWT.**

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/admin/tickets/priority` | `ADMIN` | Insert VIP ticket at position 1 |
| `PATCH` | `/api/v1/admin/tickets/:id/override` | `ADMIN` | Force a state change on any ticket |
| `GET` | `/api/v1/admin/tickets` | `ADMIN` | List tickets w/ filter, search, pagination |

### 6.1 `POST /api/v1/admin/tickets/priority`

Issues a VIP ticket that shifts all existing `WAITING` tickets down by 1 position and inserts the new ticket at **Position 1**.

**Request Body**

```json
{
  "customerName": "Executive Guest",
  "phoneNumber": "+233200000000",
  "preferredChannel": "WHATSAPP"
}
```

Same constraints as `POST /tickets/check-in` (`phoneNumber` normalized to `23320...`, `preferredChannel` defaults to `WHATSAPP`).

**Response `201 Created`**

```json
{
  "message": "Priority ticket issued at position 1.",
  "ticket": {
    "id": "tkt_vip001...",
    "ticketNumber": "VIP-001",
    "customerName": "Executive Guest",
    "phoneNumber": "233200000000",
    "preferredChannel": "WHATSAPP",
    "status": "WAITING",
    "initialPosition": 1,
    "currentPosition": 1,
    "estimatedWaitTimeMinutes": 1,
    "skipCount": 0,
    "joinedAt": "2026-09-15T09:16:00.000Z"
  }
}
```

**Errors** — `400` missing/invalid fields.

---

### 6.2 `PATCH /api/v1/admin/tickets/:id/override`

Forces a state change on any ticket (cancel, force-serve, re-queue a cancelled customer, etc.).

**Path Parameters**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | **Yes** | Ticket ID |

**Request Body**

```json
{
  "status": "WAITING",
  "reason": "Admin corrective action"
}
```

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `status` | string | **Yes** | `WAITING` \| `CALLED` \| `IN_SERVICE` \| `SERVED` \| `SKIPPED` \| `CANCELLED` \| `AUTO_CANCELLED` |
| `reason` | string | No | Audit note broadcast with the socket event |

**State-specific side effects**

| Target status | Effects |
| --- | --- |
| `WAITING` | Re-queued at the back (`currentPosition = waitingCount + 1`), `skipCount` reset to `0` |
| `CALLED` | `calledAt` set, `currentPosition: 0` |
| `IN_SERVICE` | `servicedAt` set, `currentPosition: 0` |
| `SERVED` | `completedAt` set, `currentPosition: 0` |
| `SKIPPED` | `skippedAt` set, `currentPosition: 0` |
| `CANCELLED` / `AUTO_CANCELLED` | `cancelledAt` set, `currentPosition: 0` |

**Response `200 OK`** (example: override to `WAITING`)

```json
{
  "message": "Ticket status successfully overridden to WAITING.",
  "ticket": {
    "id": "tkt_456def...",
    "ticketNumber": "A-015",
    "status": "WAITING",
    "currentPosition": 14,
    "skipCount": 0
  }
}
```

**Errors** — `400` invalid `status`, `404` ticket not found.

---

### 6.3 `GET /api/v1/admin/tickets`

Lists queue tickets with optional status filtering, text search, and pagination.

**Request Body** — None.

**Query Params**

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| `status` | string | — | Filter by any `TicketStatus`, e.g. `SERVED`, `WAITING` |
| `search` | string | — | Case-insensitive match against `ticketNumber`, `customerName`, `phoneNumber` |
| `page` | number | `1` | Page number |
| `limit` | number | `50` | Results per page |

Example: `GET /api/v1/admin/tickets?status=SERVED&search=042&page=1&limit=50`

**Response `200 OK`**

```json
{
  "tickets": [
    {
      "id": "uuid",
      "ticketNumber": "A-042",
      "customerName": "Kwame Mensah",
      "phoneNumber": "233241234567",
      "preferredChannel": "WHATSAPP",
      "status": "SERVED",
      "initialPosition": 15,
      "currentPosition": 0,
      "estimatedWaitTimeMinutes": 45,
      "skipCount": 0,
      "joinedAt": "2026-09-11T12:00:00.000Z",
      "calledAt": "2026-09-11T12:15:00.000Z",
      "servicedAt": "2026-09-11T12:16:00.000Z",
      "completedAt": "2026-09-11T12:20:00.000Z",
      "skippedAt": null,
      "cancelledAt": null,
      "counterId": "cnt_123abc...",
      "counter": {
        "counterNumber": 1,
        "counterName": "Express Pickup"
      },
      "servicedByStaffId": "usr_111bbb...",
      "servicedByStaff": {
        "employeeId": "EMP-101",
        "fullName": "Ama Kofi"
      }
    }
  ],
  "pagination": {
    "totalCount": 142,
    "page": 1,
    "limit": 50,
    "totalPages": 3
  }
}
```

> `counter` and `servicedByStaff` are `null` until the ticket is called & serviced. Use `pagination.totalPages` for pager UI.

**Errors** — `401`/`403` auth failures.

---

## 7. Admin — Analytics & Operational Metrics (`/admin/analytics`)

High-level operational metrics for dashboards. **All routes require an `ADMIN` JWT.**

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/admin/analytics/overview` | `ADMIN` | Daily ticket counts, status breakdown, avg wait & service times |
| `GET` | `/api/v1/admin/analytics/staff-efficiency` | `ADMIN` | Tickets served per employee & avg handling speed |

### 7.1 `GET /api/v1/admin/analytics/overview`

Returns high-level daily queue metrics: total issued tickets, status breakdown, average wait time, and average service duration.

**Request Body** — None.

**Response `200 OK`**

```json
{
  "analytics": {
    "date": "2026-09-16",
    "totalTicketsToday": 142,
    "avgWaitTimeMinutes": 12,
    "avgServiceTimeMinutes": 4,
    "statusBreakdown": {
      "WAITING": 18,
      "CALLED": 3,
      "IN_SERVICE": 4,
      "SERVED": 105,
      "CANCELLED": 8,
      "AUTO_CANCELLED": 4
    }
  }
}
```

> **`avgWaitTimeMinutes` and `avgServiceTimeMinutes` return `null` instead of `0`** when no tickets have been served yet today — distinguishes "no data" from a genuine zero-minute average. Rendered timings are rounded to whole minutes. `date` is `YYYY-MM-DD` (day start).

**Errors** — `401`/`403` auth failures.

---

### 7.2 `GET /api/v1/admin/analytics/staff-efficiency`

Evaluates counter-staff productivity for the current day: tickets served per employee, assigned register, and average handling time.

**Request Body** — None.

**Response `200 OK`**

```json
{
  "staffEfficiency": [
    {
      "staffId": "usr_789xyz...",
      "employeeId": "STF-001",
      "fullName": "Kwesi Opoku",
      "activeCounter": "Register 1",
      "totalTicketsServedToday": 42,
      "avgHandlingTimeMinutes": 3
    },
    {
      "staffId": "usr_111bbb...",
      "employeeId": "STF-004",
      "fullName": "Ama Tutu",
      "activeCounter": "Register 2",
      "totalTicketsServedToday": 38,
      "avgHandlingTimeMinutes": 5
    },
    {
      "staffId": "usr_222ccc...",
      "employeeId": "STF-009",
      "fullName": "Yaw Darko",
      "activeCounter": "Unbound",
      "totalTicketsServedToday": 0,
      "avgHandlingTimeMinutes": null
    }
  ]
}
```

> Only users with role `COUNTER_STAFF` are included. `activeCounter` is `"Register <number>"`, or `"Unbound"` for staff not bound to a counter. `avgHandlingTimeMinutes` returns `null` (not `0`) for staff who have served no tickets today.

**Errors** — `401`/`403` auth failures.

---

## Endpoint Index

| Method | Endpoint | Auth | Section |
| --- | --- | --- | --- |
| `POST` | `/api/v1/tickets/check-in` | Public | [2.1](#21-post-apiticketscheck-in) |
| `GET` | `/api/v1/tickets/:id/status` | Public | [2.2](#22-get-apiticketsidstatus) |
| `POST` | `/api/v1/tickets/:id/cancel` | Public | [2.3](#23-post-apiticketsidcancel) |
| `POST` | `/api/v1/auth/login` | Public | [3.1](#31-post-apivauthlogin) |
| `POST` | `/api/v1/auth/bind-shift` | Bearer | [3.2](#32-post-apivauthbind-shift) |
| `POST` | `/api/v1/auth/unbind-shift` | Bearer | [3.3](#33-post-apivauthunbind-shift) |
| `GET` | `/api/v1/staff/shift-overview` | `COUNTER_STAFF` | [4.1](#41-get-apiv1staffshift-overview) |
| `GET` | `/api/v1/staff/history` | `COUNTER_STAFF` | [4.1b](#41b-get-apiv1staffhistory) |
| `GET` | `/api/v1/staff/counters` | `COUNTER_STAFF` | [4.1c](#41c-get-apiv1staffcounters) |
| `POST` | `/api/v1/staff/call-next` | `COUNTER_STAFF` | [4.2](#42-post-apiv1staffcall-next) |
| `POST` | `/api/v1/staff/tickets/:id/start` | `COUNTER_STAFF` | [4.3](#43-post-apiv1staffticketsidstart) |
| `POST` | `/api/v1/staff/tickets/:id/complete` | `COUNTER_STAFF` | [4.4](#44-post-apiv1staffticketsidcomplete) |
| `POST` | `/api/v1/staff/tickets/:id/skip` | `COUNTER_STAFF` | [4.5](#45-post-apiv1staffticketsidskip) |
| `GET` | `/api/v1/admin/qr-code` | `ADMIN` | [5.1](#51-get-apiv1adminqr-code) |
| `POST` | `/api/v1/admin/counters` | `ADMIN` | [5.2](#52-post-apiv1admincounters) |
| `GET` | `/api/v1/admin/counters` | `ADMIN` | [5.3](#53-get-apiv1admincounters) |
| `PATCH` | `/api/v1/admin/counters/:id/toggle` | `ADMIN` | [5.4](#54-patch-apiv1admincountersidtoggle) |
| `POST` | `/api/v1/admin/counters/:id/force-unbind` | `ADMIN` | [5.5](#55-post-apiv1admincountersidforce-unbind) |
| `POST` | `/api/v1/admin/users` | `ADMIN` | [5.6](#56-post-apiv1adminusers) |
| `GET` | `/api/v1/admin/users` | `ADMIN` | [5.7](#57-get-apiv1adminusers) |
| `POST` | `/api/v1/admin/users/:id/reset-password` | `ADMIN` | [5.8](#58-post-apiv1adminusersidreset-password) |
| `POST` | `/api/v1/admin/tickets/priority` | `ADMIN` | [6.1](#61-post-apiv1adminticketspriority) |
| `PATCH` | `/api/v1/admin/tickets/:id/override` | `ADMIN` | [6.2](#62-patch-apiv1adminticketsidoverride) |
| `GET` | `/api/v1/admin/tickets` | `ADMIN` | [6.3](#63-get-apiv1admintickets) |
| `GET` | `/api/v1/admin/analytics/overview` | `ADMIN` | [7.1](#71-get-apiv1adminanalyticsoverview) |
| `GET` | `/api/v1/admin/analytics/staff-efficiency` | `ADMIN` | [7.2](#72-get-apiv1adminanalyticsstaff-efficiency) |