/**
 * POST /api/log-lookup
 * Logs an address lookup to Supabase for the admin dashboard.
 * Fails silently — never returns an error to the client.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address, plan, acreage, acctType } = req.body;
    if (!address) return res.status(400).json({ error: 'address required' });

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.log('[lookup]', { address, plan, acreage, acctType });
      return res.status(200).json({ ok: true });
    }

    await fetch(`${supabaseUrl}/rest/v1/lookups`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey':        supabaseKey,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({
        address:   String(address).slice(0, 200),
        plan:      plan     || null,
        acreage:   acreage  != null ? Number(acreage) : null,
        acct_type: acctType || null,
      }),
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('log-lookup error:', err);
    res.status(200).json({ ok: true }); // always 200 — don't surface errors to visitor
  }
}
