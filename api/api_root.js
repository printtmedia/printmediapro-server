module.exports = async (req, res) => {
  console.log(`[root] Received ${req.method} request for ${req.url} from ${req.headers.origin || 'unknown origin'}`);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.url === '/favicon.ico' || req.url === '/favicon.png') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    console.log(`[root] Method ${req.method} not allowed for /`);
    res.status(405).json({ message: `Метод ${req.method} не дозволений для /. Використовуйте GET.` });
    return;
  }

  res.status(200).json({ message: 'Сервер працює!' });
};