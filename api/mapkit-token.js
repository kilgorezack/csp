/**
 * Returns the MapKit JS authorization token from the environment.
 * Client fetches this once on map init; token is cached at the CDN edge.
 */
export default function handler(req, res) {
  const token = process.env.MAPKIT_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'MapKit token not configured' });
  }
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  res.json({ token });
}
