const { google } = require('googleapis');
require('dotenv').config();

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.REDIRECT_URI) {
  console.error('Помилка: відсутні змінні оточення GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET або REDIRECT_URI');
  process.exit(1);
}

const auth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URI
);

const url = auth.generateAuthUrl({
  scope: ['https://www.googleapis.com/auth/drive.file'],
});

console.log('Авторизуйте додаток, відвідавши цю URL:', url);

// Run this script locally and replace 'code' with the received code
const code = 'вставте_отриманий_code_тут';

if (code === 'вставте_отриманий_code_тут') {
  console.error('Будь ласка, замініть "code" на отриманий код з URL після авторизації.');
  process.exit(1);
}

auth.getToken(code, (err, tokens) => {
  if (err) {
    console.error('Помилка при отриманні токенів:', err.message);
    return;
  }
  console.log('Refresh Token:', tokens.refresh_token);
});