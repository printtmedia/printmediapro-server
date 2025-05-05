module.exports = async (req, res) => {
    // Логируем запрос
    console.log(`[test] Received ${req.method} request for ${req.url} from ${req.headers.origin || 'unknown origin'}`);
    console.log('[test] Request headers:', req.headers);

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