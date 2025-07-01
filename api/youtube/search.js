export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { q: query } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        error: 'Missing query parameter "q"' 
      });
    }

    console.log(`[${new Date().toISOString()}] YouTube search request:`, query);
    
    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://www.youtube.com/results?search_query=${encodedQuery}`;
    
    // Simulate browser headers
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0'
    };

    console.log(`[${new Date().toISOString()}] Fetching:`, searchUrl);
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(25000) // 25 second timeout for serverless
    });

    if (!response.ok) {
      console.error(`[${new Date().toISOString()}] YouTube responded with status:`, response.status);
      return res.status(response.status).json({
        error: `YouTube API returned ${response.status}: ${response.statusText}`
      });
    }

    const html = await response.text();
    
    if (!html || html.length === 0) {
      console.error(`[${new Date().toISOString()}] Empty response from YouTube`);
      return res.status(502).json({
        error: 'Empty response from YouTube'
      });
    }

    console.log(`[${new Date().toISOString()}] Success! Response length:`, html.length);
    
    // Return the raw HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
    
    res.send(html);
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Proxy error:`, error.message);
    
    if (error.name === 'AbortError' || error.code === 'ETIMEDOUT') {
      return res.status(504).json({
        error: 'Request timeout - YouTube took too long to respond',
        details: error.message
      });
    }
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return res.status(502).json({
        error: 'Network error - unable to reach YouTube',
        details: error.message
      });
    }
    
    res.status(500).json({
      error: 'Internal proxy error',
      details: error.message
    });
  }
}