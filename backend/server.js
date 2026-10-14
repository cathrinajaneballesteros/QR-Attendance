const app = require('./app');
const { initDatabase } = require('./database/db');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    const db = await initDatabase();
    app.set('db', db);

    try {
      require('./services/notifications').startDailyNotifier(db);
    } catch (notifErr) {
      console.warn('Daily notifier notice:', notifErr.message);
    }

    app.listen(PORT, () => {
      console.log('Database ready (' + (db.isPostgres ? 'Supabase PostgreSQL' : 'Local SQLite') + ')');
      console.log('Server running on port ' + PORT);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();