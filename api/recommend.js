// api/recommend.js — Vercel Node.js serverless function
// Accepts POST { address, parcel } and returns { recommendation } from Gemini

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { address, parcel } = body || {};
  if (!address) return res.status(400).json({ error: 'address is required' });

  const acreage = parcel?.ac != null ? `${Number(parcel.ac).toFixed(2)} acres` : 'unknown size';
  const acctType = parcel?.at || 'Residential';

  const prompt = `You are a friendly advisor for Summit Internet, a local broadband provider serving Teton County, Wyoming (Jackson Hole area).

A customer is asking for a plan recommendation. Their property:
- Address: ${address}
- Property size: ${acreage}
- Property type: ${acctType}

Summit Internet's four experience-tier plans:
- Basecamp ($49/mo): For smaller homes, condos, apartments. Whole-home WiFi, up to 8 devices.
- Ridgeline ($79/mo): For families and remote workers. Enhanced coverage, smart home integration, 20+ devices.
- Peak ($109/mo): Maximum whole-home mesh, unlimited devices, advanced smart home, 24/7 concierge support.
- Summit Outdoors ($149/mo): Everything in Peak plus outdoor WiFi for decks, yards, barns, and outbuildings. Built for larger properties.

Write 2-3 warm, conversational sentences recommending the best plan for this customer. Reference their property size or type if relevant. Mention life in Teton County or Jackson Hole where it feels natural. Focus on the experience — not speeds or technical specs. Name the plan you recommend and briefly explain why it fits them.`;

  try {
    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.75,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!geminiRes.ok) {
      const detail = await geminiRes.text();
      console.error('Gemini API error:', detail);
      return res.status(502).json({ error: `Gemini error ${geminiRes.status}: ${detail.slice(0, 200)}` });
    }

    const data = await geminiRes.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    if (!raw) return res.status(502).json({ error: 'Empty response from AI' });

    // Strip markdown bold/italic so the text reads cleanly in plain HTML
    const text = raw.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');

    return res.status(200).json({ recommendation: text });
  } catch (err) {
    console.error('Serverless error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
