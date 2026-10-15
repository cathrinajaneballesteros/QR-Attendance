# Database Parity Reference Guide

### 1. Unified Interface API Reference

Both the SQLite wrapper and the PostgreSQL wrapper expose the exact same API surface:

```javascript
const db = req.app.get('db');

// 1. Get a single row
const user = await db.prepare('SELECT * FROM users WHERE username = ?').get('teacher');

// 2. Get multiple rows
const list = await db.prepare('SELECT * FROM students WHERE sex = ?').all('M');

// 3. Execute INSERT/UPDATE/DELETE
const result = await db.prepare('UPDATE students SET is_enrolled = ? WHERE id = ?').run(1, 42);
// result.lastInsertRowid provides the auto-generated row id

// 4. Execute raw DDL batch
await db.exec('CREATE TABLE IF NOT EXISTS sample (id INTEGER PRIMARY KEY)');
```

---

### 2. Supported SQL Features & Gotchas

| Feature | Support Status | Guidance |
| :--- | :--- | :--- |
| `?` placeholders | ✅ Fully Supported | Universal. Handled by driver translation. |
| `$1, $2` placeholders | ⚠️ Avoid in routes | Breaks SQLite `sql.js`. Always use `?`. |
| `ON CONFLICT (...) DO UPDATE` | ✅ Supported | Fully supported in both SQLite 3.24+ and Postgres 9.5+. |
| `RETURNING *` | ⚠️ Avoid | Not standard in older SQLite builds. Query row separately if needed. |
| `ILIKE` | ❌ PostgreSQL only | Use `LIKE` with uppercase transformation: `UPPER(name) LIKE ?`. |
| Case sensitivity | Differing defaults | Always normalize strings with `.toLowerCase()` or `.toUpperCase()`. |

---

### 3. Verification Checklist for Schema Changes
When introducing any new database changes:
1. Did you test locally with `npm run dev` (offline SQLite)?
2. Did you check that queries run without parameter count mismatch errors?
3. Did you add the corresponding DDL to `qr-attendance-system/supabase_schema.sql`?
4. Did you update the automated check script (`check-core-integrity.js`) if new tables or columns were added?
