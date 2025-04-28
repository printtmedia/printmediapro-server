const express = require('express');
const { google } = require('googleapis');

const app = express();
app.use(express.json());

// Временный маршрут для проверки сервера
app.get('/', (req, res) => {
  res.send('PrintMediaPro Server is running');
});

// Маршрут для начала OAuth-авторизации
app.get('/auth/google', (req, res) => {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.REDIRECT_URI
  );

  const url = auth.generateAuthUrl({
    scope: ['https://www.googleapis.com/auth/drive.file'],
  });

  res.redirect(url);
});

// Маршрут для обработки callback и получения refresh token
app.get('/auth/callback', async (req, res) => {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.REDIRECT_URI
  );

  const code = req.query.code;
  if (!code) {
    return res.status(400).send('No code provided');
  }

  try {
    const { tokens } = await auth.getToken(code);
    res.json({
      message: 'Refresh token received',
      refreshToken: tokens.refresh_token,
    });
  } catch (error) {
    res.status(500).send('Error retrieving tokens: ' + error.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});