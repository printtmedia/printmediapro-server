const express = require('express');
const cors = require('cors');
const multer = require('multer');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Добавляем поддержку .env для локального запуска

const app = express();
const port = process.env.PORT || 3000;

// Создаем директорию /tmp/uploads, если она не существует
const uploadDir = '/tmp/uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Настройка Multer для загрузки файлов
const upload = multer({
    storage: multer.diskStorage({
        destination: '/tmp/uploads', // Используем /tmp для Vercel
        filename: (req, file, cb) => {
            const uniqueName = `${Date.now()}-${file.originalname}`;
            cb(null, uniqueName);
        }
    }),
    limits: {
        fileSize: 50 * 1024 * 1024 // Лимит размера файла 50MB
    }
});

// Применяем middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Настройка CORS
app.use(cors());

// Обработка запросов к /favicon.ico и /favicon.png
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/favicon.png', (req, res) => res.status(204).end());

// Настройка Nodemailer с Gmail SMTP
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER, // printtmedia27@gmail.com
        pass: process.env.GMAIL_PASS
    }
});

// Проверка соединения с Gmail SMTP
transporter.verify((error, success) => {
    if (error) {
        console.error('Ошибка подключения к Gmail SMTP:', error);
    } else {
        console.log('Подключение к Gmail SMTP успешно');
    }
});

// Маршрут для обработки формы
app.post('/send-order', upload.array('files'), async (req, res) => {
    try {
        const { order, image, ...formData } = req.body;
        const files = req.files || [];

        // Проверка наличия файлов
        if (!files.length) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        // Проверка наличия обязательных полей
        if (!order) {
            return res.status(400).json({ error: 'Order number is required' });
        }

        // Подготовка вложений
        const attachments = [];
        files.forEach((file) => {
            const filePath = path.join(uploadDir, file.filename);
            attachments.push({
                path: filePath
            });
        });

        // Формирование тела письма
        const mailBody = `
            <h1>Новая заявка</h1>
            <p><strong>Номер заказа:</strong> ${order}</p>
            <p><strong>Комментарий к заказу:</strong> ${image || 'не указан'}</p>
            <p><strong>Список товаров:</strong> ${files.map(file => file.filename).join(', ')}</p>
            <p><strong>Сторона печати:</strong> ${formData.print_sides || 'не указано'}</p>
        `;

        // Создание письма для отправки
        const mailOptions = {
            from: process.env.GMAIL_USER, // printtmedia27@gmail.com
            to: 'printmediapro@gmail.com', // Фиксированный получатель
            subject: `Новая заявка #${order}`,
            html: mailBody,
            attachments: attachments
        };

        // Отправка письма
        const info = await transporter.sendMail(mailOptions);
        console.log('Письмо отправлено:', info.messageId);

        // Удаление временных файлов
        attachments.forEach((attachment) => {
            if (fs.existsSync(attachment.path)) {
                fs.unlinkSync(attachment.path);
            }
        });

        res.status(200).json({ message: 'Заявка успешно отправлена' });
    } catch (error) {
        console.error('Ошибка отправки письма:', error);
        res.status(500).json({ error: 'Ошибка отправки письма', details: error.message });
    }
});

// Обработка ошибок Multer
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 50MB' });
        }
        return res.status(400).json({ error: 'File upload error', details: err.message });
    }
    next(err);
});

// Запуск сервера
app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});