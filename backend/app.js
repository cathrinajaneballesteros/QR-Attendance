const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { initDatabase } = require('./database/db');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'sta-rosa-qr-secret-key-grade6-2026';

process.env.JWT_SECRET = JWT_SECRET;
app.set('JWT_SECRET', JWT_SECRET);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


// Ensure database is initialized before any request is handled
let dbPromise = null;
app.use(async (req, res, next) => {
  try {
    if (!req.app.get('db')) {
      if (!dbPromise) {
        dbPromise = initDatabase();
      }
      const db = await dbPromise;
      req.app.set('db', db);
    }
    next();
  } catch (err) {
    console.error('Database connection error in middleware:', err.message);
    res.status(500).json({ error: 'Database connection failed: ' + err.message });
  }
});

// Mount API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', require('./routes/students'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/sf2', require('./routes/sf2'));
app.use('/api/sms', require('./routes/sms'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/history', require('./routes/history'));
app.use('/api/student-account', require('./routes/student-account'));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: req.app.get('db')?.isPostgres ? 'supabase_postgresql' : 'sqlite',
    time: new Date().toISOString()
  });
});

// Static frontend serving (for local single-port server and fullstack testing)
const frontendCandidates = [
  path.resolve(__dirname, '..', 'frontend', 'dist'),
  path.resolve(__dirname, '..', 'frontend'),
  path.resolve(__dirname, 'frontend', 'dist'),
  path.resolve(__dirname, 'frontend'),
  path.resolve(process.cwd(), 'frontend', 'dist'),
  path.resolve(process.cwd(), 'frontend')
];

const frontendPath =
  frontendCandidates.find(folder => fs.existsSync(path.join(folder, 'index.html'))) ||
  frontendCandidates[0];

app.use(express.static(frontendPath, {
  setHeaders(res, filePath) {
    if (path.extname(filePath).toLowerCase() === '.html') {
      res.setHeader('Cache-Control', 'no-store');
    }
  }
}));

app.get('/', (req, res) => {
  if (fs.existsSync(path.join(frontendPath, 'index.html'))) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  } else {
    res.send('QR Attendance API is running.');
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

app.get('*', (req, res) => {
  if (fs.existsSync(path.join(frontendPath, 'index.html'))) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  } else {
    res.status(404).send('Not found');
  }
});

module.exports = app;
