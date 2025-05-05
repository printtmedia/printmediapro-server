module.exports = async (req, res) => {
  console.log(`[root] Received ${req.method} request for ${req.url} from ${req.headers.origin || 'unknown origin'}`);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.url === '/favicon.ico' || req.url === '/favicon.png') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ message: `Метод ${req.method} не дозволений для /. Використовуйте GET.` });
  res.status(200).json({ message: 'Сервер працює!' });
};