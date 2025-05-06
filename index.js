const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');

const app = express();

// Используем только порт, заданный Render через process.env.PORT
const PORT = process.env.PORT;

// Настройка multer для обработки файлов
const upload = multer({ storage: multer.memoryStorage() });

// Настройка Google Drive API
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

// Middleware для парсинга JSON
app.use(express.json());

// Middleware для парсинга form-data
app.use(express.urlencoded({ extended: true }));

// Эндпоинт для загрузки файлов
app.post('/api/orders', upload.array('files'), async (req, res) => {
  try {
    const { name, email, details } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = [];
    for (const file of files) {
      const driveResponse = await drive.files.create({
        requestBody: {
          name: file.originalname,
          parents: [process.env.GOOGLE_DRIVE_FOLDER_ID], // Папка в Google Drive
        },
        media: {
          mimeType: file.mimetype,
          body: file.buffer,
        },
      });
      uploadedFiles.push(driveResponse.data);
    }

    res.status(200).json({
      message: 'Order created and files uploaded successfully',
      order: { name, email, details },
      files: uploadedFiles,
    });
  } catch (error) {
    console.error('Error uploading files:', error.message);
    res.status(500).json({ error: 'Failed to upload files', details: error.message });
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});