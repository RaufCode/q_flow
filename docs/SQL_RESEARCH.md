# SQL Research: Relational Database Design for the Q-Flow Queue Management System

> **Note:** This document was generated with the assistance of an AI assistant as part of an academic assignment. It researches **SQL** — the Structured Query Language — and applies the concepts directly to the **Q-Flow** queue management system's PostgreSQL database (tables: `users`, `counters`, `tickets`, `notification_logs`).

---

## Table of Contents

1. [Introduction to SQL and Relational Databases](#1-introduction-to-sql-and-relational-databases)
2. [Why PostgreSQL for Q-Flow](#2-why-postgresql-for-q-flow)
3. [Relational Schema Design and Normalization](#3-relational-schema-design-and-normalization)
4. [Data Definition Language (DDL)](#4-data-definition-language-ddl)
5. [Data Manipulation Language (DML)](#5-data-manipulation-language-dml)
6. [Querying with Joins](#6-querying-with-joins)
7. [Aggregation and Analytics](#7-aggregation-and-analytics)
8. [Advanced SQL: Window Functions and CTEs](#8-advanced-sql-window-functions-and-ctes)
9. [Indexing and Query Performance](#9-indexing-and-query-performance)
10. [Transactions, ACID, and Concurrency](#10-transactions-acid-and-concurrency)
11. [Constraints and Data Integrity](#11-constraints-and-data-integrity)
12. [Database Security](#12-database-security)
13. [SQL in the Q-Flow Codebase](#13-sql-in-the-q-flow-codebase)
14. [Summary and Conclusion](#14-summary-and-conclusion)
15. [References](#15-references)

---

## 1. Introduction to SQL and Relational Databases

**Structured Query Language (SQL)** is the standard language used to create, read, update, and delete data in a **relational database management system (RDBMS)**. It was first developed at IBM in the 1970s and standardized by ANSI and ISO, which is why almost every modern database — MySQL, PostgreSQL, Microsoft SQL Server, Oracle, SQLite — speaks the same core dialect of SQL.

A relational database organizes data into **tables** (relations). Each table has **columns** (attributes) and **rows** (records). Tables are connected through **primary keys** and **foreign keys**, which encode relationships like *"a notification log belongs to a ticket"*.

SQL splits into several sub-languages:

| Sub-language | Purpose | Examples |
| ------------- | ------- | -------- |
| **DDL** | Define/modify structure | `CREATE`, `ALTER`, `DROP` |
| **DML** | Manipulate data | `INSERT`, `UPDATE`, `DELETE`, `SELECT` |
| **DCL** | Control access | `GRANT`, `REVOKE` |
| **TCL** | Manage transactions | `BEGIN`, `COMMIT`, `ROLLBACK` |

For a system like Q-Flow, SQL is the foundation that guarantees the queue data (customers, counters, tickets, notifications) is stored safely, queryable in real time, and never corrupted by concurrent writes.

---

## 2. Why PostgreSQL for Q-Flow

Q-Flow uses **PostgreSQL** through the Prisma ORM (the Prisma datasource provider is `"postgresql"`). PostgreSQL was chosen because it offers:

- **ACID compliance** — critical for queue operations where two staff members might call tickets at the same moment.
- **Strong constraint support** — `CHECK`, `UNIQUE`, foreign-key `ON DELETE` behavior, and enums.
- **Advanced indexing** (B-tree, partial indexes) for fast queue lookups.
- **Window functions and CTEs** natively — used heavily for queue position and waiting-time analytics.
- **JSON/JSONB support** for flexible data if the schema evolves.
- **Open source** and free, deployed on Railway for this project.

---

## 3. Relational Schema Design and Normalization

### 3.1 Entities in Q-Flow

From the Prisma schema (`database/prisma/schema.prisma`), Q-Flow models four core entities:

| Table (mapped name) | Model | Purpose |
| --------------------- | ------- | ------- |
| `users` | User | Staff and admin accounts (`ADMIN`, `COUNTER_STAFF`) |
| `counters` | Counter | Physical service counters (counter 1, 2, 3...) |
| `tickets` | Ticket | A customer's place in the queue with lifecycle status |
| `notification_logs` | NotificationLog | Records of every SMS/WhatsApp event sent |

### 3.2 Relationships

- **User ↔ Counter**: a counter optionally binds one `currentStaff` (one-to-one, `ON DELETE SET NULL`).
- **Counter ↔ Ticket**: one counter serves many tickets (one-to-many).
- **User ↔ Ticket**: one staff services many tickets (`StaffServicedTickets`, `ON DELETE SET NULL`).
- **Ticket ↔ NotificationLog**: one ticket has many logs (one-to-many, `ON DELETE CASCADE`).

### 3.3 Normalization (1NF, 2NF, 3NF)

The Q-Flow schema already satisfies **First, Second, and Third Normal Forms**:

- **1NF (atomic values):** every column holds a single value — e.g., `phoneNumber` stores one phone number, not a list; arrays are not used anywhere.
- **2NF (no partial dependency):** there are no composite primary keys, so no column can depend on only part of a key. Every table has a surrogate `id UUID` primary key.
- **3NF (no transitive dependency):** non-key columns depend only on the key. For example, a ticket's `counter` is referenced by `counterId` (a foreign key) rather than duplicating counter details (`counterName`, `isActive`) inside the `tickets` table. This avoids update anomalies — if a counter's name changes, only one row needs to be updated.

**Example of an anomaly 3NF prevents:** if `tickets` stored `counterName` directly and the counter was renamed, every historical ticket row would need updating, risking inconsistency. Storing only `counterId` and joining keeps data consistent.

---

## 4. Data Definition Language (DDL)

### 4.1 Tables in Q-Flow

The physical tables are created from the Prisma models, which map to:

```sql
-- Simplified DDL for the Q-Flow schema

CREATE TABLE users (
  id            UUID PRIMARY KEY,
  employee_id   TEXT UNIQUE NOT NULL,
  full_name     TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'COUNTER_STAFF',  -- ADMIN | COUNTER_STAFF
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL
);

CREATE TABLE counters (
  id             UUID PRIMARY KEY,
  counter_number INT UNIQUE NOT NULL,
  counter_name   TEXT NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  updated_at     TIMESTAMPTZ NOT NULL,
  current_staff_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE tickets (
  id                       UUID PRIMARY KEY,
  ticket_number            TEXT NOT NULL,
  customer_name            TEXT NOT NULL,
  phone_number             TEXT NOT NULL,
  preferred_channel        TEXT NOT NULL DEFAULT 'WHATSAPP',
  status                   TEXT NOT NULL DEFAULT 'WAITING',
  initial_position         INT NOT NULL,
  current_position         INT NOT NULL,
  estimated_wait_time_minutes INT NOT NULL DEFAULT 0,
  skip_count               INT NOT NULL DEFAULT 0,
  joined_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  called_at                TIMESTAMPTZ,
  serviced_at              TIMESTAMPTZ,
  completed_at             TIMESTAMPTZ,
  skipped_at               TIMESTAMPTZ,
  cancelled_at             TIMESTAMPTZ,
  counter_id               UUID REFERENCES counters(id) ON DELETE SET NULL,
  serviced_by_staff_id     UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX tickets_status_joined_at_idx ON tickets(status, joined_at);

CREATE TABLE notification_logs (
  id       UUID PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  channel  TEXT NOT NULL,
  trigger  TEXT NOT NULL,
  message  TEXT NOT NULL,
  sent_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4.2 Enumerated Types

Status and channel values are modeled as PostgreSQL enums. Using an enum instead of a plain `TEXT` column adds a database-level guard: an application bug can never insert `"WAITINGGG"` into `tickets.status` because PostgreSQL rejects values outside the enum.

```sql
CREATE TYPE ticket_status AS ENUM (
  'WAITING', 'CALLED', 'IN_SERVICE', 'SERVED',
  'SKIPPED', 'CANCELLED', 'AUTO_CANCELLED'
);
```

---

## 5. Data Manipulation Language (DML)

### 5.1 INSERT — Joining the Queue

When a customer joins the queue, the application inserts a new ticket. Every queue has an ordering rule, so the next position is one greater than the current maximum among active tickets:

```sql
INSERT INTO tickets (
  id, ticket_number, customer_name, phone_number,
  preferred_channel, status, initial_position, current_position
)
SELECT
  gen_random_uuid(),
  'T-' || lpad(nextval('ticket_seq')::text, 4, '0'),
  'Ama Serwaa',
  '+233241112233',
  'WHATSAPP',
  'WAITING',
  COALESCE(MAX(current_position), 0) + 1,
  COALESCE(MAX(current_position), 0) + 1
FROM tickets
WHERE status IN ('WAITING', 'CALLED');
```

### 5.2 UPDATE — The Ticket Lifecycle

A ticket moves through `WAITING → CALLED → IN_SERVICE → SERVED`. Each transition is a targeted `UPDATE`:

```sql
UPDATE tickets
SET status = 'IN_SERVICE',
    serviced_at = now(),
    counter_id = '...counter uuid...',
    serviced_by_staff_id = '...staff uuid...'
WHERE id = '...ticket uuid...'
RETURNING ticket_number, customer_name;
```

The `RETURNING` clause lets the application read the updated row in the same round trip — Prisma exposes the same behavior through `UPDATE ... RETURNING *`.

### 5.3 DELETE and Soft-Delete

Hard `DELETE` is used on `notification_logs` (cascades when a ticket is removed) but tickets themselves are **never hard-deleted** — they are cancelled by flipping `status = 'CANCELLED'`. Keeping history is essential for queue analytics:

```sql
-- Hard delete (only safe for associated logs)
DELETE FROM notification_logs WHERE ticket_id = '...';

-- Business-correct: soft cancel a ticket
UPDATE tickets
SET status = 'CANCELLED', cancelled_at = now()
WHERE id = '...';
```

---

## 6. Querying with Joins

Joins combine rows from multiple tables on a key. Q-Flow joins constantly: a dashboard needs the ticket **with** its counter **and** the staff who served it.

### 6.1 INNER JOIN

Only rows with a match on both sides:

```sql
SELECT t.ticket_number,
       c.counter_name,
       u.full_name AS served_by
FROM tickets t
JOIN counters c      ON c.id = t.counter_id
JOIN users    u      ON u.id = t.serviced_by_staff_id
WHERE t.status = 'SERVED';
```

### 6.2 LEFT JOIN

Keeps every left-side row even without a match — perfect for showing `NULL` "served_by" for waiting tickets:

```sql
SELECT t.ticket_number,
       t.status,
       COALESCE(u.full_name, '—') AS served_by
FROM tickets t
LEFT JOIN users u ON u.id = t.serviced_by_staff_id
ORDER BY t.joined_at DESC;
```

### 6.3 Counting active tickets per counter with a GROUP BY + JOIN

```sql
SELECT c.counter_name,
       COUNT(t.id) AS open_tickets
FROM counters c
LEFT JOIN tickets t
  ON t.counter_id = c.id
 AND t.status IN ('WAITING', 'CALLED')
GROUP BY c.counter_name
ORDER BY c.counter_name;
```

---

## 7. Aggregation and Analytics

SQL aggregate functions (`COUNT`, `SUM`, `AVG`, `MIN`, `MAX`) summarize many rows into one. These power Q-Flow's admin stats:

### 7.1 Live dashboard counters

```sql
SELECT
  COUNT(*) FILTER (WHERE status = 'WAITING') AS waiting,
  COUNT(*) FILTER (WHERE status = 'IN_SERVICE') AS in_service,
  COUNT(*) FILTER (WHERE status = 'SERVED')    AS served_today,
  COUNT(*) FILTER (WHERE status = 'SKIPPED')   AS skipped
FROM tickets
WHERE joined_at::date = CURRENT_DATE;
```

### 7.2 Average Service Time (AST)

The estimated waiting time in the app relies on average service time from real, completed tickets:

```sql
SELECT
  AVG(EXTRACT(EPOCH FROM (completed_at - serviced_at)) / 60.0) AS avg_service_minutes,
  COUNT(*) AS samples
FROM tickets
WHERE status = 'SERVED'
  AND serviced_at IS NOT NULL
  AND completed_at IS NOT NULL;
```

### 7.3 Peak hours — hourly ticket volume

```sql
SELECT
  to_char(joined_at, 'HH24:00') AS hour,
  COUNT(*)                      AS joined
FROM tickets
WHERE joined_at >= CURRENT_DATE
GROUP BY 1
ORDER BY 1;
```

---

## 8. Advanced SQL: Window Functions and CTEs

### 8.1 Window functions

A window function computes a value across a set of rows *without* collapsing them, so each row keeps its identity. `ROW_NUMBER()` reproduces the "position in queue" concept directly:

```sql
SELECT
  ticket_number,
  customer_name,
  joined_at,
  ROW_NUMBER() OVER (ORDER BY joined_at) AS queue_position
FROM tickets
WHERE status IN ('WAITING', 'CALLED');
```

Because Prisma stores `current_position`, the application writes the same number a window function would compute. `RANK()` and `DENSE_RANK()` matter when ties exist (e.g., tickets joined in the same millisecond).

### 8.2 Common Table Expressions (CTEs)

A CTE (`WITH ...`) names a temporary result set, making complex queries readable and reusable. Example: the "next ticket to call, only counting active queues":

```sql
WITH active_queue AS (
  SELECT t.*,
         ROW_NUMBER() OVER (PARTITION BY t.counter_id ORDER BY t.joined_at) AS pos
  FROM tickets t
  WHERE t.status IN ('WAITING', 'CALLED')
)
SELECT *
FROM active_queue
WHERE pos = 1;
```

### 8.3 Recursive CTEs (seen in production queue systems)

Recursive CTEs can build running counts or walk parent/child chains. In Q-Flow they could compute a live cumulative waiting-time projection:

```sql
WITH RECURSIVE queue_projection AS (
  SELECT id, ticket_number, 0 AS waited_minutes
  FROM tickets
  WHERE status = 'WAITING'
  ORDER BY joined_at
  LIMIT 1
)
SELECT * FROM queue_projection;
```

Window functions and CTEs keep analytics on the **database server**, avoiding pulling thousands of rows into the application to count in JavaScript.

---

## 9. Indexing and Query Performance

### 9.1 What an index does

An index is a sorted structure (usually a B-tree) that lets PostgreSQL locate rows without scanning the whole table. The Q-Flow schema declares:

```prisma
@@index([status, joinedAt])
```

This becomes:

```sql
CREATE INDEX tickets_status_joined_at_idx ON tickets(status, joined_at);
```

### 9.2 Why this composite index is correct

The two hottest queries filter by `status` (e.g., `WHERE status = 'WAITING'`) and order by `joined_at`. A **composite** index on `(status, joined_at)` serves both at once:

```sql
-- Fast path: index is a prefix match on status, then ordered by joined_at
SELECT ticket_number, current_position
FROM tickets
WHERE status = 'WAITING'
ORDER BY joined_at;
```

### 9.3 Using EXPLAIN to verify

```sql
EXPLAIN ANALYZE
SELECT ticket_number FROM tickets WHERE status = 'WAITING' ORDER BY joined_at;
```

The plan should show `Index Scan using tickets_status_joined_at_idx` instead of `Seq Scan`. Other good candidates for Q-Flow:

- Index on `notifications.ticket_id` (already implied by the FK) for fast history lookup.
- Index on `tickets.counter_id` for per-counter filtering.

### 9.4 Trade-off

Indexes speed up reads but slow down writes slightly (each `INSERT`/`UPDATE` must also update the index) and consume disk space. Q-Flow accepts this because reads dominate (dashboards and position polling).

---

## 10. Transactions, ACID, and Concurrency

### 10.1 ACID

A **transaction** groups statements into one atomic unit with four guarantees:

| Property | Meaning | Q-Flow example |
| -------- | ------- | -------------- |
| **A**tomicity | All-or-nothing | A ticket created + its initial notification log insert either both succeed or both roll back |
| **C**onsistency | DB stays in valid state | Constraint violations abort the whole transaction |
| **I**solation | Concurrent transactions don't interfere | Two staff cannot see/call the same ticket as writable |
| **D**urability | Committed data survives crashes | Committed tickets remain after a restart |

### 10.2 Real Q-Flow scenario

When a ticket is cancelled, the service does several writes that must be atomic:

```sql
BEGIN;

UPDATE tickets
SET status = 'CANCELLED', cancelled_at = now()
WHERE id = 'ticket-1';

INSERT INTO notification_logs (id, ticket_id, channel, trigger, message, sent_at)
VALUES (gen_random_uuid(), 'ticket-1', 'SMS', 'CANCELLED',
        'Your ticket has been cancelled.', now());

COMMIT;
-- If the SMS insert fails, ROLLBACK undoes the status change too.
```

### 10.3 Isolation levels and row locking

Two staff calling the **same** ticket simultaneously is a classic race. The safe pattern is a `SELECT ... FOR UPDATE` (row lock) before the state transition, which serializes writers:

```sql
BEGIN;
SELECT id FROM tickets WHERE id = 'ticket-1' FOR UPDATE;
UPDATE tickets SET status = 'CALLED', called_at = now() WHERE id = 'ticket-1';
COMMIT;
```

PostgreSQL's default `READ COMMITTED` isolation is usually enough because the application performs each transition in its own transaction via Prisma.

---

## 11. Constraints and Data Integrity

Constraints are the database's own rules; the application cannot bypass them.

| Constraint | Q-Flow usage | Benefit |
| ---------- | ------------ | ------- |
| `PRIMARY KEY` | `id UUID` on every table | Uniquely identifies each row; indexing backbone |
| `UNIQUE` | `users.employee_id`, `counters.counter_number`, `counters.current_staff_id` | No duplicate employee IDs or counter numbers; one staff per counter |
| `NOT NULL` | `ticket_number`, `customer_name`, `phone_number` | A ticket always names a customer |
| `FOREIGN KEY` | `tickets.counter_id → counters.id`, `notification_logs.ticket_id → tickets.id` | Referential integrity |
| `ON DELETE SET NULL` | counter/staff on tickets | History is preserved even if a counter is removed |
| `ON DELETE CASCADE` | logs → tickets | Deleting a ticket cleans up its logs automatically |

### 11.1 A constraint preventing a bug

```sql
-- This fails at the DB level: no row can have status 'WAITINGGG'
UPDATE tickets SET status = 'WAITINGGG' WHERE ticket_number = 'T-0001';
-- ERROR: invalid input value for enum ticket_status: "WAITINGGG"
```

A `CHECK` constraint could additionally enforce a sensible rule, e.g. a served ticket must have a `serviced_at` timestamp:

```sql
ALTER TABLE tickets ADD CONSTRAINT chk_served_has_time
CHECK (status <> 'SERVED' OR serviced_at IS NOT NULL);
```

---

## 12. Database Security

### 12.1 SQL injection

An **SQL injection** attack inserts hostile SQL through user input. This classic pattern is exploitable:

```sql
-- NEVER do this (string concatenation):
-- const sql = `SELECT * FROM tickets WHERE phone = '${phone}'`
-- phone = "' OR '1'='1"  --> returns every ticket
```

The defense is **parameterized queries**: the database treats input as data, never as code.

```sql
PREPARE find_ticket (TEXT) AS
  SELECT * FROM tickets WHERE phone_number = $1;
EXECUTE find_ticket('+233241112233');
```

PostgreSQL's `$1` placeholders — and ORMs like Prisma, which always parameterize — neutralize injection entirely.

### 12.2 Principle of least privilege

- The app's DB user should only have the privileges it needs (`SELECT`, `INSERT`, `UPDATE`, `DELETE` on the four tables), never `CREATE DATABASE` or `DROP`.
- Secrets (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, SMS keys) live in environment variables, **never** in the repository — per the README's explicit rule.

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON tickets, counters, users, notification_logs TO qflow_app;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
```

### 12.3 Protecting stored data

- **Passwords** are stored as salted bcrypt hashes (`passwordHash`), never plain text.
- **Encryption in transit**: the hosted database uses TLS on the connection URL (`DATABASE_URL`).
- **Firewall / allow-listing**: Railway-hosted databases restrict connections to the app's network.

---

## 13. SQL in the Q-Flow Codebase

Q-Flow talks to the database through **Prisma** (TypeScript). Prisma translates its fluent API into SQL under the hood, but every Prisma call maps to the SQL concepts above:

| Prisma code (used in Q-Flow) | Equivalent SQL concept |
| ---------------------------- | ---------------------- |
| `prisma.ticket.create({ data })` | `INSERT INTO tickets ...` |
| `prisma.ticket.update({ where, data })` | `UPDATE tickets SET ... WHERE id = ...` |
| `prisma.ticket.findMany({ where, orderBy: { joinedAt: 'asc' } })` | `SELECT ... WHERE ... ORDER BY joined_at` |
| `prisma.user.findFirst({ where: { employeeId } })` | `SELECT ... FROM users WHERE employee_id = $1 LIMIT 1` |
| `prisma.$transaction([...])` | `BEGIN ... COMMIT` (transaction) |
| `@@index` / `@unique` / `@relation` in schema | `CREATE INDEX` / `UNIQUE` / foreign keys |

Understanding the underlying SQL matters because it determines **query performance, data integrity, and security** even when an ORM hides the syntax.

---

## 14. Summary and Conclusion

This research examined SQL and how it underpins the Q-Flow queue management system:

1. **Relational design** — four normalized tables (`users`, `counters`, `tickets`, `notification_logs`) connected by primary/foreign keys satisfy 1NF–3NF and avoid data anomalies.
2. **DDL/DML** — enums, constraints, and targeted `INSERT`/`UPDATE` statements implement the ticket lifecycle (`WAITING → CALLED → IN_SERVICE → SERVED`).
3. **Querying** — joins, aggregates, window functions, and CTEs deliver real-time queue positions and analytics without client-side processing.
4. **Performance** — the composite `(status, joined_at)` index makes the hottest queue queries index scans instead of table scans.
5. **Correctness** — transactions and `FOR UPDATE` locking keep concurrent staff actions safe under ACID.
6. **Security** — parameterized queries, least-privilege grants, hashed passwords, and externalized secrets defend against injection and leakage.

SQL is therefore not merely a persistence detail in Q-Flow — it is the engine that guarantees fast, consistent, and secure queue operations for every customer and staff interaction.

---

## 15. References

- PostgreSQL Documentation — *SQL Language Reference*: https://www.postgresql.org/docs/current/sql.html
- PostgreSQL Documentation — *Indexes*: https://www.postgresql.org/docs/current/indexes.html
- PostgreSQL Documentation — *Transactions and Concurrency*: https://www.postgresql.org/docs/current/mvcc.html
- Prisma Documentation — *Database schema & Prisma models*: https://www.prisma.io/docs/orm/prisma-schema/overview
- Prisma Documentation — *Transactions*: https://www.prisma.io/docs/orm/prisma-client/queries/transactions
- MDN Web Docs — *SQL Injection*: https://developer.mozilla.org/en-US/docs/Glossary/SQL_Injection
- OWASP — *SQL Injection Prevention Cheat Sheet*: https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
- Elmasri, R. & Navathe, S. B. — *Fundamentals of Database Systems* (relational model & normalization)
- Date, C. J. — *An Introduction to Database Systems* (SQL & relational theory)