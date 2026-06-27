import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id param is required' });

  const response = await fetch(
    `https://api.football-data.org/v4/matches/${id}`,
    { headers: { 'X-Auth-Token': process.env.FOOTBALL_API_KEY! } }
  );

  const data = await response.json();
  res.status(response.status).json(data);
}
