---
name: dual-database-guard
description: >-
  Use this skill when designing database schemas, writing SQL queries, adding migrations,
  or modifying database drivers in backend/database/db.js to guarantee 100% parity between
  local SQLite (sql.js) and Supabase PostgreSQL (pg).
---

# Dual-Database Guard Skill

This skill enforces strict cross-compatibility between the local offline SQLite database and the cloud Supabase PostgreSQL database.

## When to Use This Skill
- Whenever writing raw SQL queries in route handlers (`backend/routes/*.js`).
- Whenever adding new columns, tables, or indexes to the schema.
- Whenever updating `backend/database/db.js` or `supabase_schema.sql`.
- When diagnosing database connectivity, pooling, or transaction errors.

---

## Dual-Engine Architecture Overview

```text
                  ┌──────────────────────────────────────────────┐
                  │           Unified db wrapper API             │
                  │   db.prepare(sql).get(...), .all(...), .run() │
                  └──────────────────────┬───────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
                 ▼                                               ▼
     [Local Offline Mode]                             [Cloud Production Mode]
  sqlite / sql.js (WASM)                          Supabase PostgreSQL (pg.Pool)
  File: backend/attendance.db                     Target: process.env.DATABASE_URL
  Trigger: DATABASE_URL is empty                  Trigger: DATABASE_URL is set
```

---

## The 4 Golden Rules of SQL Compatibility

### 1. Parameter Placeholders
- **ALWAYS write SQL using `?` placeholders:**
  ```javascript
  // CORRECT:
  await db.prepare('SELECT * FROM students WHERE id = ? AND teacher_id = ?').get(id, teacherId);
  ```
- The wrapper in `backend/database/db.js` automatically parses SQL and translates `?` into PostgreSQL-style `$1, $2, ...` when connected to Supabase.
- **NEVER** hardcode `$1, $2` directly in routes, because SQLite does not natively recognize Postgres dollar parameter syntax.

### 2. Universal Data Types
Ensure columns are declared using types that parse identically across both engines:
| Purpose | Portable Type | Notes |
| :--- | :--- | :--- |
| Primary Key | `SERIAL PRIMARY KEY` (PG) / `INTEGER PRIMARY KEY AUTOINCREMENT` (SQLite) | Handled by initialization scripts |
| Text, Names, QR Codes | `TEXT` | Standard in both |
| Flags, Booleans | `INTEGER` (values `0` or `1`) | Standard boolean representation |
| Dates & Times | `TEXT` (format: `YYYY-MM-DD`, `HH:MM AM/PM`) | Guarantees timezone consistency |
| Coordinates | `DOUBLE PRECISION` (PG) / `REAL` (SQLite) | Floating point coordinates |
| Timestamps | `TIMESTAMPTZ DEFAULT NOW()` (PG) / `DATETIME DEFAULT CURRENT_TIMESTAMP` (SQLite) | Audit timestamps |

### 3. Dual Schema Synchronization
Whenever a new column or table is added:
1. **Update `supabase_schema.sql`:** Add the `CREATE TABLE IF NOT EXISTS` or `ALTER TABLE` statement for cloud deployment.
2. **Update SQLite dynamic schema checks:** Add PRAGMA checks and dynamic `ALTER TABLE` execution in `backend/database/db.js` or the route initialization function (e.g. `ensureStudentColumns(db)`).

### 4. Zero Offline Regressions
- The application must always start cleanly without errors when running with `DATABASE_URL` unset.
- Local writes must trigger `saveSqliteDB(db)` to flush the WASM database state to `attendance.db`.

---

## Code Snippet: Safe Column Migration Pattern
```javascript
async function ensureCustomColumns(db) {
  if (db.isPostgres) return; // Supabase uses supabase_schema.sql migrations
  try {
    const columns = (await db.prepare("PRAGMA table_info(my_table)").all() || []).map(c => c.name);
    if (!columns.includes('new_column')) {
      await db.exec("ALTER TABLE my_table ADD COLUMN new_column TEXT DEFAULT ''");
    }
  } catch (err) {
    console.warn('Column migration notice:', err.message);
  }
}
```
