const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const { Readable } = require('stream');
const cors = require('cors');
const iconv = require('iconv-lite');

const app = express();

const PORT = process.env.PORT || 10000;

// Configure multer to handle all fields, including files
const upload = multer({ storage: multer.memoryStorage() }).any();

// Enhanced CORS configuration
app.use(cors({
  origin: 'https://printtmedia.github.io',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

app.post('/api/send-order', upload, async (req, res) => {
  try {
    const formData = req.body;
    const files = req.files || [];

    const uploadedFiles = [];
    const fileLinks = [];

    // Handle file uploads (including orderImage)
    for (const file of files) {
      const decodedFileName = iconv.decode(Buffer.from(file.originalname, 'binary'), 'utf8');
      const bufferStream = new Readable();
      bufferStream.push(file.buffer);
      bufferStream.push(null);

      const fileSizeMB = file.size / (1024 * 1024);
      const shouldUploadToDrive = fileSizeMB > 25;

      if (shouldUploadToDrive) {
        const driveResponse = await drive.files.create({
          requestBody: {
            name: decodedFileName,
            parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
          },
          media: {
            mimeType: file.mimetype,
            body: bufferStream,
          },
        });

        const fileId = driveResponse.data.id;
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
      } else {
        uploadedFiles.push({ name: decodedFileName, size: file.size });
      }
    }

    // Prepare email notification (placeholder)
    console.log('Email notification to printtmedia27@gmail.com:', {
      subject: `New Order #${formData.orderNumber || 'Unknown'}`,
      body: `Order received:\n${JSON.stringify(formData, null, 2)}\n\nDownload links for large files:\n${fileLinks.join('\n')}`,
      attachments: files.filter(file => file.size / (1024 * 1024) <= 25).map(file => ({
        filename: iconv.decode(Buffer.from(file.originalname, 'binary'), 'utf8'),
        content: file.buffer,
      })),
    });

    res.status(200).json({
      message: 'Order created and files processed successfully',
      order: formData,
      fileLinks: fileLinks,
    });
  } catch (error) {
    console.error('Error processing order:', error.message);
    res.status(500).json({ error: 'Failed to process order', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});