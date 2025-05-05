const multer = require('multer');
const nodemailer = require('nodemailer');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Непідтримуваний тип файлу'), false);
  },
}).fields([{ name: 'files', maxCount: 10 }, { name: 'orderImage', maxCount: 1 }]);

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Метод не дозволений. Використовуйте POST.' });
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ message: `Помилка завантаження: ${err.message}` });
    if (!req.files || !req.files['files']) return res.status(400).json({ message: 'Файли не завантажені' });
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_TO || 'recipient@example.com',
        subject: 'Нове замовлення від PrintMediaPro',
        text: JSON.stringify(req.body, null, 2),
        attachments: [
          ...req.files['files'].map(file => ({ filename: file.originalname, content: file.buffer })),
          ...(req.files['orderImage'] ? req.files['orderImage'].map(file => ({ filename: 'order-image.png', content: file.buffer })) : []),
        ],
      });
      console.log('Замовлення успішно відправлено');
      res.status(200).json({ message: 'Замовлення успішно відправлено' });
    } catch (error) {
      console.error('Помилка відправки email:', error.message);
      res.status(500).json({ message: `Помилка сервера: ${error.message}` });
    }
  });
};