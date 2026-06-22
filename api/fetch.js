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

const ALLOWED_DOMAINS = [
  "d1211whpimeups.cloudfront.net", 
  "www.rtbgo.bn",
  "live-aburayhan1103.telewebion.ir" // Ditambahkan agar lolos validasi security
];

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
  const encodedUrl = currentUrl.searchParams.get('url');
  if (!encodedUrl) return new Response("Parameter url hilang", { status: 400 });

  const targetUrl = decodeURIComponent(encodedUrl);
  let parsed;
  
  try {
    parsed = new URL(targetUrl);
    if (!ALLOWED_DOMAINS.includes(parsed.hostname)) {
      return new Response("Forbidden: Domain tidak diizinkan", { status: 403 });
    }
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  // PILIH HEADER SECARA DINAMIS BERDASARKAN TARGET DOMAIN
  const headers = parsed.hostname.includes('telewebion.ir') ? TELEWEBION_HEADERS : RTBGO_HEADERS;

  try {
    const response = await fetch(targetUrl, { headers: headers });
    if (!response.ok) return new Response("Gagal mengambil sub-playlist", { status: 502 });

    const content = await response.text();
    const lines = content.split('\n');
    const newLines = [];
    const proxyBase = `${currentUrl.protocol}//${currentUrl.host}`;

    for (let line of lines) {
      const stripLine = line.trim();
      if (stripLine && !stripLine.startsWith('#') && !stripLine.startsWith('//')) {
        const fullUrl = new URL(stripLine, targetUrl).toString();
        
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
