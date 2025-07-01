export default function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.json({ 
    status: 'healthy', 
    service: 'vorbis-player-proxy',
    timestamp: new Date().toISOString()
  });
}