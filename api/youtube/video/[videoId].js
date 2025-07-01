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

    console.log(`[${new Date().toISOString()}] YouTube video page request:`, videoId);
    
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
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

    console.log(`[${new Date().toISOString()}] Fetching video page:`, videoUrl);
    
    const response = await fetch(videoUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(25000) // 25 second timeout for serverless
    });

    if (!response.ok) {
      console.error(`[${new Date().toISOString()}] YouTube video page responded with status:`, response.status);
      return res.status(response.status).json({
        error: `YouTube returned ${response.status}: ${response.statusText}`
      });
    }

    const html = await response.text();
    
    if (!html || html.length === 0) {
      console.error(`[${new Date().toISOString()}] Empty response from YouTube video page`);
      return res.status(502).json({
        error: 'Empty response from YouTube video page'
      });
    }

    // Parse HTML to detect embedding restrictions
    // Multiple approaches to catch different types of embedding restrictions
    
    // 1. Direct embedding flags
    const hasPlayableInEmbedFalse = html.includes('"playableInEmbed":false');
    const hasUnplayableStatus = html.includes('"status":"UNPLAYABLE"');
    const hasVideoUnavailable = html.includes('"reason":"Video unavailable"');
    const isPrivate = html.includes('"isPrivate":true');
    const isDeleted = html.includes('"isDeleted":true');
    
    // 2. Check for embed config restrictions
    const embedConfigBlocked = html.includes('"embedEnabled":false') || 
                              html.includes('"embeddable":false');
    
    // 3. Check for content restrictions (copyright, etc.)
    const hasContentRestrictions = html.includes('contentRestricted') ||
                                  html.includes('copyrightRestricted') ||
                                  html.includes('embedRestricted');
    
    // 4. Check for domain restrictions
    const hasDomainRestrictions = html.includes('allowedDomains') ||
                                 html.includes('blockedRegions');
    
    // 5. Check for specific error messages in player config
    const hasPlayerErrors = html.includes('"errorCode":') ||
                           html.includes('"unavailable":true') ||
                           html.includes('"unplayable":true');
    
    // 6. Check for age restrictions (which often block embedding)
    const hasAgeRestriction = html.includes('contentRating') ||
                             html.includes('isContentRatingRequired') ||
                             html.includes('ageGated');
    
    // Combine all checks - video is embeddable only if none of these flags are true
    const isEmbeddable = !hasPlayableInEmbedFalse && 
                        !hasUnplayableStatus &&
                        !hasVideoUnavailable &&
                        !isPrivate &&
                        !isDeleted &&
                        !embedConfigBlocked &&
                        !hasContentRestrictions &&
                        !hasDomainRestrictions &&
                        !hasPlayerErrors &&
                        !hasAgeRestriction;

    // Extract additional metadata for better decision making
    const videoTitle = html.match(/<title>([^<]+)<\/title>/)?.[1]?.replace(' - YouTube', '') || '';
    const channelName = html.match(/"ownerChannelName":"([^"]+)"/)?.[1] || '';
    const isLiveStream = html.includes('"isLiveContent":true') || html.includes('"isLive":true');
    
    console.log(`[${new Date().toISOString()}] Video embedding check - ID: ${videoId}, Embeddable: ${isEmbeddable}, Title: ${videoTitle}`);
    
    // Return structured response with embedding info
    res.json({
      videoId,
      isEmbeddable,
      metadata: {
        title: videoTitle,
        channelName,
        isLiveStream
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] YouTube video page error:`, error.message);
    
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