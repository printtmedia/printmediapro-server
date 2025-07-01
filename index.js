require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const { Readable } = require('stream');
const cors = require('cors');
const iconv = require('iconv-lite');
const nodemailer = require('nodemailer');

const app = express();

const PORT = process.env.PORT || 10000;

// Налаштування сервера з таймаутом для великих файлів
app.server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
app.server.setTimeout(10 * 60 * 1000); // 10 хвилин

// Налаштування Multer для обробки файлів orderImage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2 ГБ
}).array('orderImage');

// Покращена конфігурація CORS
app.use(cors({
  origin: (origin, callback) => {
    console.log('CORS origin:', origin);
    if (!origin || origin === 'https://printtmedia.github.io') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
  optionsSuccessStatus: 200
}));
app.options('/api/send-order', cors());

// Парсинг JSON і URL-encoded даних
app.use(express.json({ limit: '2gb' }));
app.use(express.urlencoded({ extended: true, limit: '2gb' }));

// Налаштування Google Drive API та Gmail API з OAuth 2.0
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://printmediapro-server.onrender.com/oauth2callback'
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

// Логування оновлення токенів
oauth2Client.on('tokens', (tokens) => {
  if (tokens.refresh_token) {
    console.log('New refresh_token:', tokens.refresh_token);
  }
  console.log('New access_token:', tokens.access_token);
});

// Перевірка автентифікації перед запуском
async function verifyAuth() {
  try {
    const token = await oauth2Client.getAccessToken();
    if (!token.token) {
      throw new Error('Failed to obtain access token during initialization');
    }
    console.log('OAuth2 authentication successful');
  } catch (error) {
    console.error('OAuth2 authentication failed:', error.message);
  }
}
verifyAuth();

const drive = google.drive({
  version: 'v3',
  auth: oauth2Client,
});

// Налаштування Nodemailer для Gmail з OAuth 2.0
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: process.env.EMAIL_USER,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    accessToken: async () => {
      const token = await oauth2Client.getAccessToken();
      if (!token.token) {
        throw new Error('Failed to obtain access token');
      }
      return token.token;
    }
  }
});

transporter.options = { poolTimeout: 10 * 60 * 1000 }; // 10 хвилин

// Тестовий маршрут для Google Drive
app.get('/test-drive', async (req, res) => {
  try {
    const fileStream = require('fs').createReadStream('test.pdf');
    const driveResponse = await drive.files.create({
      requestBody: {
        name: 'test.pdf',
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID || 'root'],
      },
      media: {
        mimeType: 'application/pdf',
        body: fileStream,
      },
      fields: 'id, webViewLink'
    });
    res.json({ message: 'File uploaded', data: driveResponse.data });
  } catch (error) {
    console.error('Test drive error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Тестовий маршрут для Email
app.get('/test-email', async (req, res) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: 'printtmedia27@gmail.com',
      subject: 'Test Email',
      text: 'This is a test email'
    });
    res.json({ message: 'Email sent' });
  } catch (error) {
    console.error('Test email error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Основний маршрут для обробки замовлень
app.post('/api/send-order', upload, async (req, res) => {
  try {
    const formData = req.body;
    const files = req.files || [];

    const uploadedFiles = [];
    const fileLinks = [];

    console.log('Starting file processing...');
    console.log('Form data:', formData);
    console.log('Files received:', files.map(f => ({ name: f.originalname, size: f.size, fieldName: f.fieldname })));

    // Валідація отриманих файлів проти formData.filename
    const expectedFiles = Array.isArray(formData.filename)
      ? formData.filename.filter(name => name && name !== 'Не вказано')
      : formData.filename ? [formData.filename].filter(name => name && name !== 'Не вказано') : [];
    const receivedFileNames = files.map(f => iconv.decode(Buffer.from(f.originalname, 'binary'), 'utf8'));
    const missingFiles = expectedFiles.filter(name => !receivedFileNames.includes(name));
    if (missingFiles.length > 0) {
      console.warn('Missing files:', missingFiles);
      formData.missingFiles = missingFiles.join(', ');
    }

    // Обробка завантаження файлів
    for (const file of files) {
      const decodedFileName = iconv.decode(Buffer.from(file.originalname, 'binary'), 'utf8');
      const fileSizeMB = file.size / (1024 * 1024);
      console.log(`Processing file: ${decodedFileName}, Size: ${fileSizeMB.toFixed(2)}MB`);

      const shouldUploadToDrive = fileSizeMB > 1;

      if (shouldUploadToDrive) {
        console.log(`Uploading ${decodedFileName} to Google Drive...`);
        try {
          const fileStream = Readable.from(file.buffer);
          const driveResponse = await drive.files.create({
            requestBody: {
              name: decodedFileName,
              parents: [process.env.GOOGLE_DRIVE_FOLDER_ID || 'root'],
            },
            media: {
              mimeType: file.mimetype,
              body: fileStream,
            },
            fields: 'id, webViewLink'
          });

          const fileId = driveResponse.data.id;
          console.log(`File uploaded to Google Drive, ID: ${fileId}`);

          await drive.permissions.create({
            fileId: fileId,
            requestBody: {
              role: 'reader',
              type: 'anyone',
            },
          });

          const fileLink = `https://drive.google.com/file/d/${fileId}/view`;
          fileLinks.push(fileLink);
          uploadedFiles.push(driveResponse.data);
          console.log(`Google Drive link generated: ${fileLink}`);
        } catch (driveError) {
          console.error(`Failed to upload ${decodedFileName} to Google Drive:`, driveError.message);
          console.error('Error details:', driveError.response?.data || driveError);
          formData.uploadErrors = formData.uploadErrors || [];
          formData.uploadErrors.push(`Failed to upload ${decodedFileName}: ${driveError.message}`);
        }
      } else {
        console.log(`File ${decodedFileName} is under threshold, will be attached to email.`);
        uploadedFiles.push({ name: decodedFileName, size: file.size, buffer: file.buffer });
      }
    }

    // Підготовка та відправка email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: ['printtmedia27@gmail.com', 'printmediapro@gmail.com'],
      subject: `New Order #${formData.orderNumber || 'Unknown'}`,
      text: `Order received:\n${JSON.stringify(formData, null, 2)}\n\nDownload links for large files:\n${fileLinks.join('\n') || 'None'}${formData.missingFiles ? `\n\nWarning: The following files were not received by the server: ${formData.missingFiles}` : ''}${formData.uploadErrors ? `\n\nUpload Errors: ${formData.uploadErrors.join('\n')}` : ''}`,
      attachments: files
        .filter(file => file.size / (1024 * 1024) <= 1)
        .map(file => ({
          filename: iconv.decode(Buffer.from(file.originalname, 'binary'), 'utf8'),
          content: file.buffer,
        })),
    };

    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully to printtmedia27@gmail.com and printmediapro@gmail.com');

    res.status(200).json({
      message: 'Order created, files processed, and email sent successfully',
      order: formData,
      fileLinks: fileLinks,
    });
  } catch (error) {
    console.error('Error processing order:', error.message);
    console.error('Full error details:', error);
    res.status(500).json({ error: 'Failed to process order', details: error.message });
  }
});