module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'POST') return res.status(200).json({ message: 'Тестовий POST-запит успішний', body: req.body });
  res.status(200).json({ message: 'Тестовий API працює' });
};