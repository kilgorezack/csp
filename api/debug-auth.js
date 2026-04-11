/**
 * Temporary diagnostic — DELETE after fixing auth.
 * GET /api/debug-auth?pw=yourpassword
 */
export default function handler(req, res) {
  const stored = process.env.ADMIN_PASSWORD || '';
  const received = req.query.pw || '';
  res.status(200).json({
    storedLength:   stored.trim().length,
    receivedLength: received.trim().length,
    match:          stored.trim() === received.trim(),
    storedChars:    [...stored.trim()].map(c => c.charCodeAt(0)),
    receivedChars:  [...received.trim()].map(c => c.charCodeAt(0)),
  });
}
