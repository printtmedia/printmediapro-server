const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const { Readable } = require('stream'); // Add this to create a stream from Buffer

const app = express();

const PORT = process.env.PORT;

const upload = multer({ storage: multer.memoryStorage() });

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/api/orders', upload.array('files'), async (req, res) => {
  try {
    const { name, email, details } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = [];
    for (const file of files) {
      // Convert Buffer to Readable stream
      const bufferStream = new Readable();
      bufferStream.push(file.buffer);
      bufferStream.push(null); // Signal the end of the stream

      const driveResponse = await drive.files.create({
        requestBody: {
          name: file.originalname,
          parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
        },
        media: {
          mimeType: file.mimetype,
          body: bufferStream, // Use the stream instead of file.buffer
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