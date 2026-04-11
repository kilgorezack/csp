/**
 * GET /api/admin-data?pw=<password>
 * Returns all logged lookups. Password-protected.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Password check
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(503).json({ error: 'Admin not configured' });
  }
  if (req.query.pw !== adminPassword) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!kvUrl || !kvToken) {
    return res.status(200).json({ lookups: [], total: 0 });
  }

  try {
    const kvRes = await fetch(`${kvUrl}/lrange/lookups/0/-1`, {
      headers: { Authorization: `Bearer ${kvToken}` },
    });
    const { result } = await kvRes.json();
    const lookups = (result || []).map(s => {
      try { return JSON.parse(s); } catch { return null; }
    }).filter(Boolean);

    res.status(200).json({ lookups, total: lookups.length });
  } catch (err) {
    console.error('admin-data error:', err);
    res.status(500).json({ error: 'Failed to load data' });
  }
}
