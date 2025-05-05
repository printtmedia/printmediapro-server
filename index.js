const express = require('express');
const testRoute = require('./api/test');
const sendOrderRoute = require('./api/send-order');
const rootRoute = require('./api/root');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount API routes
app.use('/api/test', testRoute);
app.use('/api/send-order', sendOrderRoute);
app.use('/', rootRoute);

// Global error handler
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.url}: ${err.message}`);
  res.status(500).json({ message: `Server Error: ${err.message}` });
});

module.exports = app;