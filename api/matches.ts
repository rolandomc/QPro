import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { competition, matchday, status, dateFrom, dateTo } = req.query;

  if (!competition) {
    return res.status(400).json({ error: 'competition param is required' });
  }

  const params = new URLSearchParams();
  if (matchday) params.set('matchday', String(matchday));
  if (dateFrom) params.set('dateFrom', String(dateFrom));
  if (dateTo) params.set('dateTo', String(dateTo));
  if (status && status !== 'ALL') params.set('status', String(status));

  const query = params.toString();
  const url = `https://api.football-data.org/v4/competitions/${competition}/matches${query ? '?' + query : ''}`;

  const response = await fetch(url, {
    headers: { 'X-Auth-Token': process.env.FOOTBALL_API_KEY! },
  });

  const data = await response.json();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(response.status).json(data);
}
