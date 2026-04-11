/**
 * POST /api/log-lookup
 * Logs an address lookup to Vercel KV for the admin dashboard.
 * Fails silently — never returns an error to the client.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address, plan, acreage, acctType } = req.body;
    if (!address) return res.status(400).json({ error: 'address required' });

    const entry = JSON.stringify({
      ts:       Date.now(),
      address:  String(address).slice(0, 200),
      plan:     plan     || null,
      acreage:  acreage  != null ? Number(acreage) : null,
      acctType: acctType || null,
    });

    const kvUrl   = process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;

    if (!kvUrl || !kvToken) {
      // KV not configured — log locally and return ok so the UI never breaks
      console.log('[lookup]', entry);
      return res.status(200).json({ ok: true });
    }

    // Push to front of list (newest first), keep last 1000 entries
    await fetch(`${kvUrl}/lpush/lookups`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${kvToken}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify([entry]),
    });

    await fetch(`${kvUrl}/ltrim/lookups/0/999`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${kvToken}` },
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('log-lookup error:', err);
    res.status(200).json({ ok: true }); // always 200 — don't surface errors to visitor
  }
}
