const multer = require('multer');
const nodemailer = require('nodemailer');

// Налаштування multer з обмеженням розміру файлів (4MB для Vercel)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 4 * 1024 * 1024 } // 4MB ліміт
}).fields([
    { name: 'files', maxCount: 10 },
    { name: 'orderImage', maxCount: 1 }
]);

// Налаштування nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

module.exports = (req, res) => {
    // Логируем запрос
    console.log(`[send-order] Received ${req.method} request for ${req.url} from ${req.headers.origin || 'unknown origin'}`);
    console.log('[send-order] Request headers:', req.headers);

    if (req.method === 'OPTIONS') {
        console.log('[send-order] Handling OPTIONS request');
        res.status(204).end();
        return;
    }

    if (req.method !== 'POST') {
        console.log(`[send-order] Method ${req.method} not allowed for /api/send-order`);
        res.status(405).json({ message: `Метод ${req.method} не дозволений для /api/send-order. Використовуйте POST.` });
        return;
    }

    console.log('[send-order] Handling /api/send-order POST request');

    // Проверяем переменные окружения
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('[send-order] Missing environment variables: EMAIL_USER or EMAIL_PASS');
        res.status(500).json({ message: 'Помилка сервера: відсутні змінні оточення для email.' });
        return;
    }

    // Обработка multipart/form-data
    upload(req, res, async (err) => {
        if (err) {
            console.error('[send-order] Multer error:', err.message);
            res.status(500).json({ message: 'Помилка при обробці файлів: ' + err.message });
            return;
        }

        try {
            console.log('[send-order] Received order data:', req.body);
            if (req.files['files']) {
                console.log('[send-order] Received files:', req.files['files'].map(file => ({
                    filename: file.originalname,
                    size: file.size
                })));
            } else {
                console.log('[send-order] No files received');
            }
            if (req.files['orderImage']) {
                console.log('[send-order] Received order image:', {
                    filename: req.files['orderImage'][0].originalname,
                    size: req.files['orderImage'][0].size
                });
            } else {
                console.log('[send-order] No order image received');
            }

            // Отправка email
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: process.env.EMAIL_USER,
                subject: `Нове замовлення №${req.body.orderNumber || 'невказано'}`,
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
            console.log('[send-order] Email sent successfully');

            res.status(200).json({ message: 'Замовлення успішно отримано!' });
        } catch (error) {
            console.error('[send-order] Error:', error.message);
            res.status(500).json({ message: 'Помилка при обробці замовлення: ' + error.message });
        }
    });
};