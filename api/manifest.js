export const config = { runtime: 'edge' };

const RTBGO_HEADERS = {
  "Referer": "https://www.rtbgo.bn/",
  "User-Agent": "RTBGo/2.0.21 (Linux;Android 15.0.0;) ExoPlayerLib/2.19.1",
  "x-dtv-key": "21X83_SECURE_PLAY",
  "x-core": "shield_hls"
};

const TELEWEBION_HEADERS = {
  "User-Agent": "OTT Navigator/hometv.finale (Linux;Android 14) ExoPlayerLib/2.13.2",
  "Accept-Encoding": "gzip",
  "x-dtv-key": "21X83_SECURE_PLAY",
  "x-core": "shield_hls"
};

const CHANNELS = {
  '1': {
    url: "https://d1211whpimeups.cloudfront.net/smil:rtbgo/chunklist_b4096000_slENG.m3u8",
    headers: RTBGO_HEADERS
  },
  '2': {
    url: "https://d1211whpimeups.cloudfront.net/smil:rtb2/chunklist_b4096000_slENG.m3u8", // Taruh URL ch 2 lu di sini
    headers: RTBGO_HEADERS
  },
  '3': {
    url: "https://live-aburayhan1103.telewebion.ir/ek/faratar/live/108050p/index.m3u8",
    headers: TELEWEBION_HEADERS
  }
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const currentUrl = new URL(req.url);
  const ch = currentUrl.searchParams.get('ch') || '1';
  const channelConfig = CHANNELS[ch];

  if (!channelConfig) {
    return new Response("Channel tidak ditemukan", { status: 404 });
  }

  try {
    const response = await fetch(channelConfig.url, { headers: channelConfig.headers });
    if (!response.ok) return new Response(`Error asal server: ${response.statusText}`, { status: 502 });

    const content = await response.text();
    const lines = content.split('\n');
    const newLines = [];
    const proxyBase = `${currentUrl.protocol}//${currentUrl.host}`;

    for (let line of lines) {
      const stripLine = line.trim();
      if (stripLine && !stripLine.startsWith('#') && !stripLine.startsWith('//')) {
        const fullUrl = new URL(stripLine, channelConfig.url).toString();
        
        if (stripLine.includes('.m3u8')) {
          const encoded = encodeURIComponent(fullUrl);
          newLines.push(`${proxyBase}/api/fetch?url=${encoded}`);
        } else {
          newLines.push(fullUrl);
        }
      } else {
        newLines.push(line);
      }
    }

    return new Response(newLines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 's-maxage=2, stale-while-revalidate=4'
      },
    });
  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 502 });
  }
}
