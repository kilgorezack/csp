/**
 * GET /api/admin-data?pw=<password>
 * Returns all logged lookups from Supabase. Password-protected.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(503).json({ error: 'Admin not configured' });
  }
  if (req.query.pw !== adminPassword) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(200).json({ lookups: [], total: 0 });
  }

  try {
    const sbRes = await fetch(
      `${supabaseUrl}/rest/v1/lookups?order=created_at.desc&limit=1000`,
      {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey':        supabaseKey,
        },
      }
    );

    const rows = await sbRes.json();
    if (!Array.isArray(rows)) throw new Error('Unexpected Supabase response');

    // Normalize to the shape the dashboard expects
    const lookups = rows.map(r => ({
      ts:       new Date(r.created_at).getTime(),
      address:  r.address,
      plan:     r.plan,
      acreage:  r.acreage,
      acctType: r.acct_type,
    }));

    res.status(200).json({ lookups, total: lookups.length });
  } catch (err) {
    console.error('admin-data error:', err);
    res.status(500).json({ error: 'Failed to load data' });
  }
}
