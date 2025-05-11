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

// Увеличим таймаут сервера для обработки больших файлов
app.server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
app.server.setTimeout(10 * 60 * 1000); // 10 минут

// Настройка multer с хранением в памяти и лимитом в 2 ГБ
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2 ГБ
}).any();

// Enhanced CORS configuration
app.use(cors({
  origin: 'https://printtmedia.github.io',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '2gb' }));
app.use(express.urlencoded({ extended: true, limit: '2gb' }));

// Configure Google Drive API with automatic token refresh
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost' // Замените на реальный redirect URI, если требуется
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const drive = google.drive({
  version: 'v3',
  auth: oauth2Client, // OAuth2 client автоматически обновляет access_token
});

// Configure Nodemailer for Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Увеличим таймаут для nodemailer
transporter.options.poolTimeout = 10 * 60 * 1000; // 10 минут

app.post('/api/send-order', upload, async (req, res) => {
  try {
    const formData = req.body;
    const files = req.files || [];

    const uploadedFiles = [];
    const fileLinks = [];

    console.log('Starting file processing...');
    console.log('Form data:', formData);
    console.log('Files received:', files.map(f => ({ name: f.originalname, size: f.size, fieldName: f.fieldname })));

    // Validate received files against formData.filename
    const expectedFiles = formData.filename ? formData.filename.split(', ').filter(name => name && name !== 'Не вказано') : [];
    const receivedFileNames = files.map(f => f.originalname);
    const missingFiles = expectedFiles.filter(name => !receivedFileNames.includes(name));
    if (missingFiles.length > 0) {
      console.warn('Missing files:', missingFiles);
      formData.missingFiles = missingFiles.join(', ');
    }

    // Handle file uploads (including orderImage)
    for (const file of files) {
      const decodedFileName = iconv.decode(Buffer.from(file.originalname, 'binary'), 'utf8');
      const fileSizeMB = file.size / (1024 * 1024);
      console.log(`Processing file: ${decodedFileName}, Size: ${fileSizeMB.toFixed(2)}MB`);

      const shouldUploadToDrive = fileSizeMB > 1;

      if (shouldUploadToDrive) {
        console.log(`Uploading ${decodedFileName} to Google Drive...`);
        try {
          // Загружаем файл из памяти через поток
          const fileStream = Readable.from(file.buffer);
          const driveResponse = await drive.files.create({
            requestBody: {
              name: decodedFileName,
              parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
            },
            media: {
              mimeType: file.mimetype,
              body: fileStream,
            },
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

          const fileLink = `https://drive.google.com/uc?export=download&id=${fileId}`;
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

    // Prepare and send email notification to both email addresses
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'printtmedia27@gmail.com, printmediapro@gmail.com',
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