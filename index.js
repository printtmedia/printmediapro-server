const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const fs = require('fs');
const cors = require('cors');
const iconv = require('iconv-lite');
const nodemailer = require('nodemailer');

const app = express();

const PORT = process.env.PORT || 10000;

// Configure multer with disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '/tmp'); // Use temporary directory
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage: storage }).any();

// Enhanced CORS configuration
app.use(cors({
  origin: 'https://printtmedia.github.io',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
  optionsSuccessStatus: 200
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure Google Drive API
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

// Configure Nodemailer for Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

app.post('/api/send-order', upload, async (req, res) => {
  try {
    const formData = req.body;
    const files = req.files || [];

    const uploadedFiles = [];
    const fileLinks = [];

    console.log('Starting file processing...');
    console.log('Form data:', formData);
    console.log('Files received:', files.map(f => ({ name: f.originalname, size: f.size, fieldName: f.fieldname, path: f.path })));

    // Validate received files against formData.filename
    const expectedFiles = formData.filename ? formData.filename.split(', ').filter(name => name && name !== 'Не вказано') : [];
    const receivedFileNames = files.map(f => f.originalname);
    const missingFiles = expectedFiles.filter(name => !receivedFileNames.includes(name));
    if (missingFiles.length > 0) {
      console.warn('Missing files:', missingFiles);
      formData.missingFiles = missingFiles.join(', '); // Add to formData for email notification
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
          const fileStream = fs.createReadStream(file.path);
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
          throw driveError;
        } finally {
          fs.unlink(file.path, (err) => {
            if (err) console.error(`Failed to delete temporary file ${file.path}:`, err);
          });
        }
      } else {
        console.log(`File ${decodedFileName} is under threshold, will be attached to email.`);
        uploadedFiles.push({ name: decodedFileName, size: file.size, path: file.path });
      }
    }

    // Prepare and send email notification
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'printtmedia27@gmail.com',
      subject: `New Order #${formData.orderNumber || 'Unknown'}`,
      text: `Order received:\n${JSON.stringify(formData, null, 2)}\n\nDownload links for large files:\n${fileLinks.join('\n') || 'None'}`,
      attachments: files
        .filter(file => file.size / (1024 * 1024) <= 1)
        .map(file => ({
          filename: iconv.decode(Buffer.from(file.originalname, 'binary'), 'utf8'),
          path: file.path,
        })),
    };

    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully to printtmedia27@gmail.com');

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});