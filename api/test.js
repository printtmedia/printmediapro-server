module.exports = async (req, res) => {
    // Добавляем CORS заголовки
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Логируем запрос
    console.log(`[test] Received ${req.method} request for ${req.url} from ${req.headers.origin || 'unknown origin'}`);

    if (req.method === 'OPTIONS') {
        console.log('[test] Handling OPTIONS request');
        res.status(204).end();
        return;
    }

    if (req.method !== 'GET') {
        console.log(`[test] Method ${req.method} not allowed for /api/test`);
        res.status(405).json({ message: `Метод ${req.method} не дозволений для /api/test. Використовуйте GET.` });
        return;
    }

    console.log('[test] Handling /api/test GET request');
    res.status(200).json({ message: 'Сервер працює!' });
};
