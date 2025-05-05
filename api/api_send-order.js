const multer = require('multer');
const nodemailer = require('nodemailer');

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Непідтримуваний тип файлу'), false);
    }
  }
}).fields([
  { name: 'files', maxCount: 10 },
  { name: 'orderImage', maxCount: 1 }
]);

module.exports = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: `Помилка завантаження: ${err.message}` });
    }

    // Настройка транспортера для nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    try {
      // Логика отправки email с данными формы и файлами
      await transporter.sendMail({
        from: 'your-email@gmail.com',
        to: 'recipient@example.com',
        subject: 'Нове замовлення від PrintMediaPro',
        text: 'Деталі замовлення...',
        attachments: req.files ? req.files['files'].map(file => ({ filename: file.originalname, content: file.buffer })) : []
      });
      res.status(200).json({ message: 'Замовлення успішно відправлено' });
    } catch (error) {
      res.status(500).json({ message: `Помилка сервера: ${error.message}` });
    }
  });
};