export const config = { runtime: 'edge' };

// Hanya menyisakan header RTBGo yang terpakai
const RTBGO_HEADERS = {
  "Referer": "https://www.rtbgo.bn/",
  "User-Agent": "RTBGo/2.0.21 (Linux;Android 15.0.0;) ExoPlayerLib/2.19.1",
  "x-dtv-key": "21X83_SECURE_PLAY",
  "x-core": "shield_hls"
};

// Struktur channel disederhanakan karena cuma butuh URL saja
const CHANNELS = {
  '1': "https://d1211whpimeups.cloudfront.net/smil:rtbgo/chunklist_b4096000_slENG.m3u8",
  '2': "https://d1211whpimeups.cloudfront.net/smil:rtb2/chunklist_b4096000_slENG.m3u8"
};

export default async function handler(req) {
  // 1. Handle CORS Preflight untuk browser
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

  // 2. Ambil parameter channel (?ch=)
  const currentUrl = new URL(req.url);
  const ch = currentUrl.searchParams.get('ch') || '1';
  const sourceUrl = CHANNELS[ch];

  if (!sourceUrl) {
    return new Response("Channel tidak ditemukan", { status: 404 });
  }

  try {
    // 3. Fetch manifest m3u8 dari server asli menggunakan header bypass
    const response = await fetch(sourceUrl, { headers: RTBGO_HEADERS });
    
    if (!response.ok) {
      return new Response(`Error asal server: ${response.statusText}`, { status: 502 });
    }

    const content = await response.text();

    // 4. Parsing dan rewrite isi teks manifest (Lebih clean menggunakan .map)
    const rewrittenManifest = content.split('\n').map(line => {
      const stripLine = line.trim();
      
      // Deteksi baris yang berisi link file (bukan komentar atau baris kosong)
      if (stripLine && !stripLine.startsWith('#') && !stripLine.startsWith('//')) {
        // Langsung konversi link video potongan (.ts) menjadi URL Absolute sumber aslinya
        return new URL(stripLine, sourceUrl).toString();
      }
      
      return line; // Biarkan baris tag/komentar HLS apa adanya
    }).join('\n');

    // 5. Kembalikan teks manifest yang sudah di-rewrite ke browser
    return new Response(rewrittenManifest, {
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
