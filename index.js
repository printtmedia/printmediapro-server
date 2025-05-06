const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const { Readable } = require('stream');
const cors = require('cors'); // Add CORS middleware
const iconv = require('iconv-lite'); // Add for encoding/decoding file names

const app = express();

const PORT = process.env.PORT || 10000;

const upload = multer({ storage: multer.memoryStorage() });

// Enable CORS for all routes
app.use(cors({
  origin: 'https://printtmedia.github.io', // Allow requests from the GitHub Pages domain
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
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

app.post('/api/send-order', upload.array('files'), async (req, res) => {
  try {
    const formData = req.body;
    const files = req.files;

    const uploadedFiles = [];
    const fileLinks = [];

    // Handle file uploads
    for (const file of files) {
      // Decode the file name to handle non-ASCII characters (e.g., Cyrillic)
      const decodedFileName = iconv.decode(Buffer.from(file.originalname, 'binary'), 'utf8');

      // Convert Buffer to Readable stream
      const bufferStream = new Readable();
      bufferStream.push(file.buffer);
      bufferStream.push(null);

      const fileSizeMB = file.size / (1024 * 1024);
      const shouldUploadToDrive = fileSizeMB > 25;

      if (shouldUploadToDrive) {
        // Upload to Google Drive
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

        // Generate a shareable link
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
        // For small files, they will be sent directly via email (handled in email logic)
        uploadedFiles.push({ name: decodedFileName, size: file.size });
      }
    }

    // Prepare email notification (simplified for this example)
    // In a real implementation, use a library like nodemailer to send emails
    console.log('Email notification to printtmedia27@gmail.com:', {
      subject: `New Order #${formData.orderNumber}`,
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

app.post('/api/orders', upload.array('files'), async (req, res) => {
  try {
    const { name, email, details } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = [];
    for (const file of files) {
      // Decode the file name to handle non-ASCII characters
      const decodedFileName = iconv.decode(Buffer.from(file.originalname, 'binary'), 'utf8');

      // Convert Buffer to Readable stream
      const bufferStream = new Readable();
      bufferStream.push(file.buffer);
      bufferStream.push(null);

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});