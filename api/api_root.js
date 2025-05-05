module.exports = async (req, res) => {
    // Логируем запрос
    console.log(`[root] Received ${req.method} request for ${req.url} from ${req.headers.origin || 'unknown origin'}`);
    console.log('[root] Request headers:', req.headers);

    if (req.method === 'OPTIONS') {
        console.log('[root] Handling OPTIONS request');
        res.status(204).end();
        return;
    }

    if (req.url === '/favicon.ico' || req.url === '/favicon.png') {
        console.log('[root] Handling favicon request');
        res.status(204).end();
        return;
    }

    if (req.method !== 'GET') {
        console.log(`[root] Method ${req.method} not allowed for /`);
        res.status(405).json({ message: `Метод ${req.method} не дозволений для /. Використовуйте GET.` });
        return;
    }

    console.log('[root] Handling root GET request');
    res.status(200).json({ message: 'Сервер працює!' });
};