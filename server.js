const express = require('express');
const multer = require('multer');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();

// Настройка хранилища для multer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Разрешаем CORS для всех источников (временно для теста)
app.use(cors({
    origin: '*', // Позже можно вернуть 'https://printtmedia.github.io'
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: false
}));

// Явно обрабатываем OPTIONS запросы
app.options('*', cors());

// Логируем все входящие запросы
app.use((req, res, next) => {
    console.log(`Received ${req.method} request for ${req.url} from ${req.headers.origin}`);
    res.header('Access-Control-Allow-Origin', '*'); // Дополнительно добавляем заголовок
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Настройка nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Обработка favicon.ico
app.get('/favicon.ico', (req, res) => {
    res.status(204).end();
});

// Тестовый эндпоинт
app.get('/api/test', (req, res) => {
    res.status(200).json({ message: 'Сервер працює!' });
});

// Эндпоинт для обработки заказов
app.post('/api/send-order', upload.fields([
    { name: 'files', maxCount: 10 },
    { name: 'orderImage', maxCount: 1 }
]), async (req, res) => {
    try {
        console.log('Received order data:', req.body);
        if (req.files['files']) {
            console.log('Received files:', req.files['files'].map(file => ({
                filename: file.originalname,
                size: file.size
            })));
        }
        if (req.files['orderImage']) {
            console.log('Received order image:', {
                filename: req.files['orderImage'][0].originalname,
                size: req.files['orderImage'][0].size
            });
        }

        // Отправка email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: `Нове замовлення №${req.body.orderNumber}`,
            text: JSON.stringify(req.body, null, 2),
            attachments: [
                ...(req.files['files'] || []).map(file => ({
                    filename: file.originalname,
                    content: file.buffer
                })),
                ...(req.files['orderImage'] ? [{
                    filename: 'order.png',
                    content: req.files['orderImage'][0].buffer
                }] : [])
            ]
        };

        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully');

        res.status(200).json({ message: 'Замовлення успішно отримано!' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Помилка при обробці замовлення.' });
    }
});

// Обработка корневого маршрута
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Сервер працює!' });
});

module.exports = app;