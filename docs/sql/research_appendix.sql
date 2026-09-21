-- ============================================================================
-- Q-Flow — SQL Research Appendix
-- Annotated example queries against the Q-Flow PostgreSQL schema
-- (users, counters, tickets, notification_logs)
--
-- Generated with the assistance of an AI assistant for an academic assignment.
-- These queries mirror the patterns documented in docs/SQL_RESEARCH.md.
-- ============================================================================

--------------------------------------------------------------------------------
-- 1. DDL: enums used by the tickets table
--------------------------------------------------------------------------------
CREATE TYPE ticket_status AS ENUM (
  'WAITING', 'CALLED', 'IN_SERVICE', 'SERVED',
  'SKIPPED', 'CANCELLED', 'AUTO_CANCELLED'
);

CREATE TYPE notification_trigger AS ENUM (
  'INITIAL_JOIN', 'THRESHOLD_ALERT', 'COUNTER_CALL',
  'AUTO_CANCELLED', 'CANCELLED'
);

--------------------------------------------------------------------------------
-- 2. DML: customer joins the queue (INSERT with next position)
--------------------------------------------------------------------------------
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

--------------------------------------------------------------------------------
-- 3. DML: staff calls the next ticket (lifecycle WAITING -> CALLED)
--------------------------------------------------------------------------------
UPDATE tickets
SET status = 'CALLED', called_at = now()
WHERE id = (
  SELECT id
  FROM tickets
  WHERE status = 'WAITING'
  ORDER BY joined_at
  LIMIT 1
)
RETURNING ticket_number, customer_name;

--------------------------------------------------------------------------------
-- 4. DML: start service (CALLED -> IN_SERVICE), bind counter and staff
--------------------------------------------------------------------------------
UPDATE tickets
SET status = 'IN_SERVICE',
    serviced_at = now(),
    counter_id = :counter_id,
    serviced_by_staff_id = :staff_id
WHERE id = :ticket_id
  AND status = 'CALLED'
RETURNING ticket_number;

--------------------------------------------------------------------------------
-- 5. DML: complete service (IN_SERVICE -> SERVED)
--------------------------------------------------------------------------------
UPDATE tickets
SET status = 'SERVED', completed_at = now()
WHERE id = :ticket_id
  AND status = 'IN_SERVICE'
RETURNING ticket_number;

--------------------------------------------------------------------------------
-- 6. DML: cancel a ticket (soft delete — history is preserved)
--------------------------------------------------------------------------------
UPDATE tickets
SET status = 'CANCELLED', cancelled_at = now()
WHERE id = :ticket_id;

--------------------------------------------------------------------------------
-- 7. JOIN: served tickets with the counter and staff who served them
--------------------------------------------------------------------------------
SELECT t.ticket_number,
       c.counter_name,
       u.full_name AS served_by
FROM tickets t
JOIN counters c ON c.id = t.counter_id
JOIN users    u ON u.id = t.serviced_by_staff_id
WHERE t.status = 'SERVED'
ORDER BY t.completed_at DESC;

--------------------------------------------------------------------------------
-- 8. LEFT JOIN: queue view that tolerates tickets not yet assigned
--------------------------------------------------------------------------------
SELECT t.ticket_number,
       t.customer_name,
       t.status,
       COALESCE(c.counter_name, '—') AS counter,
       COALESCE(u.full_name, '—')    AS served_by
FROM tickets t
LEFT JOIN counters c ON c.id = t.counter_id
LEFT JOIN users    u ON u.id = t.serviced_by_staff_id
ORDER BY t.joined_at;

--------------------------------------------------------------------------------
-- 9. AGGREGATE: live dashboard counters for today
--------------------------------------------------------------------------------
SELECT
  COUNT(*) FILTER (WHERE status = 'WAITING')    AS waiting,
  COUNT(*) FILTER (WHERE status = 'IN_SERVICE') AS in_service,
  COUNT(*) FILTER (WHERE status = 'SERVED')     AS served_today,
  COUNT(*) FILTER (WHERE status = 'SKIPPED')    AS skipped
FROM tickets
WHERE joined_at::date = CURRENT_DATE;

--------------------------------------------------------------------------------
-- 10. AGGREGATE: Average Service Time (feeds estimated waiting time)
--------------------------------------------------------------------------------
SELECT
  AVG(EXTRACT(EPOCH FROM (completed_at - serviced_at)) / 60.0) AS avg_service_minutes,
  COUNT(*) AS samples
FROM tickets
WHERE status = 'SERVED'
  AND serviced_at IS NOT NULL
  AND completed_at IS NOT NULL;

--------------------------------------------------------------------------------
-- 11. WINDOW: live queue position for every active ticket
--------------------------------------------------------------------------------
SELECT
  ticket_number,
  customer_name,
  joined_at,
  ROW_NUMBER() OVER (ORDER BY joined_at) AS queue_position
FROM tickets
WHERE status IN ('WAITING', 'CALLED');

--------------------------------------------------------------------------------
-- 12. CTE: the oldest active ticket per counter (next call candidates)
--------------------------------------------------------------------------------
WITH active_queue AS (
  SELECT t.*,
         ROW_NUMBER() OVER (PARTITION BY t.counter_id ORDER BY t.joined_at) AS pos
  FROM tickets t
  WHERE t.status IN ('WAITING', 'CALLED')
)
SELECT id, ticket_number, customer_name, counter_id
FROM active_queue
WHERE pos = 1;

--------------------------------------------------------------------------------
-- 13. TRANSACTION: cancel a ticket and log the SMS in one atomic unit
--------------------------------------------------------------------------------
BEGIN;

UPDATE tickets
SET status = 'CANCELLED', cancelled_at = now()
WHERE id = :ticket_id
RETURNING ticket_number;

INSERT INTO notification_logs (id, ticket_id, channel, trigger, message, sent_at)
VALUES (gen_random_uuid(), :ticket_id, 'SMS', 'CANCELLED',
        'Your Q-Flow ticket has been cancelled.', now());

COMMIT;
-- If the INSERT above fails, ROLLBACK undoes the status change as well.

--------------------------------------------------------------------------------
-- 14. CONCURRENCY: call a ticket safely with a row lock
--------------------------------------------------------------------------------
BEGIN;
SELECT id FROM tickets
WHERE id = :ticket_id AND status = 'WAITING'
FOR UPDATE;

UPDATE tickets
SET status = 'CALLED', called_at = now()
WHERE id = :ticket_id;

COMMIT;

--------------------------------------------------------------------------------
-- 15. SECURITY: parameterized query (prevents SQL injection)
--------------------------------------------------------------------------------
PREPARE find_ticket (TEXT) AS
  SELECT * FROM tickets WHERE phone_number = $1;
EXECUTE find_ticket('+233241112233');

--------------------------------------------------------------------------------
-- 16. SECURITY: least-privilege grants for the application role
--------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE
  ON tickets, counters, users, notification_logs TO qflow_app;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;

--------------------------------------------------------------------------------
-- 17. PERFORMANCE: verify the index on (status, joined_at) is used
--------------------------------------------------------------------------------
EXPLAIN ANALYZE
SELECT ticket_number, current_position
FROM tickets
WHERE status = 'WAITING'
ORDER BY joined_at;

-- Expected: Index Scan using tickets_status_joined_at_idx

--------------------------------------------------------------------------------
-- 18. ANALYTICS: peak hours — tickets joined per hour today
--------------------------------------------------------------------------------
SELECT
  to_char(joined_at, 'HH24:00') AS hour,
  COUNT(*)                      AS joined
FROM tickets
WHERE joined_at >= CURRENT_DATE
GROUP BY 1
ORDER BY 1;