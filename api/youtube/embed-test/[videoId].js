export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { videoId } = req.query;
    
    if (!videoId) {
      return res.status(400).json({ 
        error: 'Missing video ID parameter' 
      });
    }

    console.log(`[${new Date().toISOString()}] Testing YouTube embed for:`, videoId);
    
    const embedUrl = `https://www.youtube.com/embed/${videoId}`;
    
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

    console.log(`[${new Date().toISOString()}] Fetching embed page:`, embedUrl);
    
    const response = await fetch(embedUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(25000) // 25 second timeout for serverless
    });

    if (!response.ok) {
      console.error(`[${new Date().toISOString()}] YouTube embed responded with status:`, response.status);
      return res.json({
        videoId,
        isEmbeddable: false,
        reason: `Embed endpoint returned ${response.status}`,
        metadata: {},
        timestamp: new Date().toISOString()
      });
    }

    const html = await response.text();
    
    if (!html || html.length === 0) {
      console.error(`[${new Date().toISOString()}] Empty response from YouTube embed`);
      return res.json({
        videoId,
        isEmbeddable: false,
        reason: 'Empty response from embed endpoint',
        metadata: {},
        timestamp: new Date().toISOString()
      });
    }

    // Check for specific error patterns in embed page
    const hasVideoUnavailable = html.includes('Video unavailable') ||
                               html.includes('This video is unavailable') ||
                               html.includes('Video nicht verfügbar') ||
                               html.includes('Vídeo no disponible');
    
    const hasEmbedDisabled = html.includes('Watch this video on YouTube') ||
                            html.includes('embedded videos') ||
                            html.includes('embedding has been disabled');
    
    const hasContentRestriction = html.includes('not available in your country') ||
                                 html.includes('copyright') ||
                                 html.includes('blocked in your country');
    
    const hasAgeRestriction = html.includes('age-restricted') ||
                             html.includes('Sign in to confirm your age');
    
    const hasPrivacyRestriction = html.includes('private video') ||
                                 html.includes('This video is private');
    
    // Look for player error messages
    const hasPlayerError = html.includes('"status":"UNPLAYABLE"') ||
                          html.includes('"reason":"') ||
                          html.includes('errorMessage');
    
    const isEmbeddable = !hasVideoUnavailable &&
                        !hasEmbedDisabled &&
                        !hasContentRestriction &&
                        !hasAgeRestriction &&
                        !hasPrivacyRestriction &&
                        !hasPlayerError;
    
    let reason = '';
    if (!isEmbeddable) {
      if (hasVideoUnavailable) reason = 'Video unavailable';
      else if (hasEmbedDisabled) reason = 'Embedding disabled';
      else if (hasContentRestriction) reason = 'Content restriction';
      else if (hasAgeRestriction) reason = 'Age restriction';
      else if (hasPrivacyRestriction) reason = 'Privacy restriction';
      else if (hasPlayerError) reason = 'Player error';
      else reason = 'Unknown restriction';
    }
    
    console.log(`[${new Date().toISOString()}] Embed test - ID: ${videoId}, Embeddable: ${isEmbeddable}, Reason: ${reason || 'OK'}`);
    
    // Return structured response with embedding info
    res.json({
      videoId,
      isEmbeddable,
      reason: reason || null,
      metadata: {
        responseLength: html.length,
        hasPlayerConfig: html.includes('ytInitialPlayerResponse')
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] YouTube embed test error:`, error.message);
    
    res.json({
      videoId: req.query.videoId,
      isEmbeddable: false,
      reason: `Network error: ${error.message}`,
      metadata: {},
      timestamp: new Date().toISOString()
    });
  }
}