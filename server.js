require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Настройка Multer для обработки файлов
const upload = multer({ dest: 'uploads/' });

// Настройка Nodemailer с Gmail SMTP
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER, // printtmedia27@gmail.com (задаётся в .env или Vercel)
        pass: process.env.GMAIL_PASS  // App Password (задаётся в .env или Vercel)
    }
});

// Создание папки uploads, если не существует
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Маршрут для обработки формы
app.post('/send-order', upload.array('files'), async (req, res) => {
    try {
        const { order_image, ...formData } = req.body;
        const files = req.files;

        // Подготовка вложений
        const attachments = [];

        // Добавление PNG (base64)
        if (order_image) {
            const base64Data = order_image.replace(/^data:image\/png;base64,/, '');
            const pngPath = path.join(__dirname, 'uploads', `order_${Date.now()}.png`);
            fs.writeFileSync(pngPath, base64Data, 'base64');
            attachments.push({
                filename: 'order.png',
                path: pngPath
            });
        }

        // Добавление загруженных файлов
        files.forEach(file => {
            attachments.push({
                filename: file.originalname,
                path: file.path
            });
        });

        // Формирование тела письма
        const mailBody = `
            <h2>Замовлення №${formData.order_number}</h2>
            <p><strong>Дата замовлення:</strong> ${formData.order_date}</p>
            <p><strong>Замовник:</strong> ${formData.customer}</p>
            <p><strong>Контактна особа:</strong> ${formData.contact_person}</p>
            <p><strong>Телефон:</strong> ${formData.phone}</p>
            <p><strong>Email:</strong> ${formData.email}</p>
            <p><strong>Назва продукту:</strong> ${formData.product_name}</p>
            <p><strong>Сторони друку:</strong> ${formData.print_sides}</p>
            <p><strong>Кількість:</strong> ${formData.quantity}</p>
            <p><strong>Формат:</strong> ${formData.format}</p>
            <p><strong>Тип друку:</strong> ${formData.print_type}</p>
            <p><strong>Матеріал:</strong> ${formData.material}</p>
            <p><strong>Щільність паперу:</strong> ${formData.paper_weight}</p>
            <p><strong>Термін виконання:</strong> ${formData.deadline}</p>
            <p><strong>Післядрукарська обробка:</strong> ${formData.post_print}</p>
            <p><strong>Примітки:</strong> ${formData.notes || 'Немає'}</p>
        `;

        // Настройка письма
        const mailOptions = {
            from: process.env.GMAIL_USER, // printtmedia27@gmail.com
            to: 'printmediapro@gmail.com',
            subject: `Нове замовлення №${formData.order_number}`,
            html: mailBody,
            attachments: attachments
        };

        // Отправка письма
        await transporter.sendMail(mailOptions);

        // Удаление временных файлов
        attachments.forEach(attachment => {
            fs.unlinkSync(attachment.path);
        });

        res.status(200).json({ message: 'Замовлення успішно надіслано' });
    } catch (error) {
        console.error('Помилка відправки:', error);
        res.status(500).json({ error: 'Помилка надсилання замовлення' });
    }
});

// Запуск сервера
app.listen(port, () => {
    console.log(`Сервер запущено на порту ${port}`);
});