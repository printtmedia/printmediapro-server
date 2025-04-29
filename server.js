const express = require('express');

const app = express();

// Middleware для добавления CORS заголовков
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    console.log(`Received ${req.method} request for ${req.url} from ${req.headers.origin}`);
    next();
});

// Обработка OPTIONS запросов
app.options('*', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Обработка favicon.ico и favicon.png
app.get('/favicon.ico', (req, res) => {
    res.status(204).end();
});

app.get('/favicon.png', (req, res) => {
    res.status(204).end();
});

// Тестовый эндпоинт
app.get('/api/test', (req, res) => {
    res.status(200).json({ message: 'Сервер працює!' });
});

// Обработка корневого маршрута
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Сервер працює!' });
});

module.exports = app;