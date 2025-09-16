require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const reportRoutes = require('./routes/reports');
const databaseRoutes = require('./routes/databases');
const analyticsRoutes = require('./routes/analytics');
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

// Connect to MongoDB Atlas using .env
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected successfully'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Routes
app.use('/auth', authRoutes);
app.use('/reports', reportRoutes);
app.use('/databases', databaseRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/api/templates', require('./routes/templates'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

app.listen(5000, () => console.log('Server running on port 5000'));