const express = require('express');
const multer = require('multer');
const cors = require('cors');

const app = express();

// Настройка хранилища для multer (временное сохранение файлов)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Разрешаем CORS для всех источников (или укажите конкретный домен)
app.use(cors({
    origin: '*', // Для тестов. В продакшене замените на 'https://printtmedia.github.io'
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

// Парсим JSON и URL-encoded данные
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Эндпоинт для обработки заказов
app.post('/api/send-order', upload.fields([
    { name: 'files', maxCount: 10 }, // Поле для файлов
    { name: 'orderImage', maxCount: 1 } // Поле для изображения заказа
]), (req, res) => {
    try {
        // Логируем текстовые поля
        console.log('Received order data:', req.body);

        // Логируем информацию о файлах
        if (req.files['files']) {
            console.log('Received files:', req.files['files'].map(file => ({
                filename: file.originalname,
                size: file.size
            })));
        }

        // Логируем информацию об изображении
        if (req.files['orderImage']) {
            console.log('Received order image:', {
                filename: req.files['orderImage'][0].originalname,
                size: req.files['orderImage'][0].size
            });
        }

        // Отправляем успешный ответ
        res.status(200).json({ message: 'Замовлення успішно отримано!' });
    } catch (error) {
        console.error('Error processing order:', error);
        res.status(500).json({ error: 'Помилка при обробці замовлення.' });
    }
});

// Тестовый эндпоинт для проверки работы сервера
app.get('/api/test', (req, res) => {
    res.json({ message: 'Сервер працює!' });
});

// Запускаем сервер (Vercel автоматически управляет портом)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app; // Экспортируем для Vercel