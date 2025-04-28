const express = require('express');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

// Временный маршрут для проверки сервера
app.get('/', (req, res) => {
  res.send('PrintMediaPro Server is running');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});