require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const reportRoutes = require('./routes/reports');
const databaseRoutes = require('./routes/databases');
const analyticsRoutes = require('./routes/analytics');
const templateRoutes = require('./routes/templates');
const app = express();

// Check if environment variables are loaded
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not defined in environment variables');
  process.exit(1);
}

app.use(cors());
app.use(express.json());

// Connect to MongoDB using .env
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Routes
app.use('/auth', authRoutes);
app.use('/reports', reportRoutes);
app.use('/databases', databaseRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/api/templates', templateRoutes);

// Health check endpoint. Reports the database state so a failed connection
// is not masked by a healthy process.
app.get('/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'OK' : 'DEGRADED',
    database: connected ? 'connected' : 'disconnected'
  });
});

// Global error handler. Must be registered after the routes: Express matches
// error middleware in registration order, so mounting it earlier means route
// errors never reach it.
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Only listen when run directly, so tests can import the app without binding a port.
if (require.main === module) {
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`Server running on port ${port}`));
}

module.exports = app;