const multer = require('multer');
const nodemailer = require('nodemailer');

// Настройка хранилища для multer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Настройка nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

module.exports = async (req, res) => {
    // Добавляем CORS заголовки
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Логируем запрос
    console.log(`Received ${req.method} request for ${req.url} from ${req.headers.origin}`);

    // Обработка OPTIONS запросов
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    // Обработка favicon.ico и favicon.png
    if (req.url === '/favicon.ico' || req.url === '/favicon.png') {
        res.status(204).end();
        return;
    }

    // Тестовый эндпоинт
    if (req.method === 'GET' && req.url === '/api/test') {
        res.status(200).json({ message: 'Сервер працює!' });
        return;
    }

    // Корневой маршрут
    if (req.method === 'GET' && req.url === '/') {
        res.status(200).json({ message: 'Сервер працює!' });
        return;
    }

    // Обработка /api/send-order
    if (req.url !== '/api/send-order') {
        console.log(`Route ${req.url} not found`);
        res.status(404).json({ message: 'Маршрут не знайдено.' });
        return;
    }

    if (req.method !== 'POST') {
        console.log(`Method ${req.method} not allowed for /api/send-order`);
        res.status(405).json({ message: `Метод ${req.method} не дозволений для /api/send-order. Використовуйте POST.` });
        return;
    }

    // Обработка multipart/form-data
    const uploadMiddleware = upload.fields([
        { name: 'files', maxCount: 10 },
        { name: 'orderImage', maxCount: 1 }
    ]);

    uploadMiddleware(req, res, async (err) => {
        if (err) {
            console.error('Multer error:', err);
            res.status(500).json({ message: 'Помилка при обробці файлів.' });
            return;
        }

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
};