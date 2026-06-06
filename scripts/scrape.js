const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PLAYLIST_URL = 'https://open.spotify.com/playlist/37i9dQZEVXbvlGjddLmO0N';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ru-RU',
  });

  const page = await context.newPage();

  // Open playlist (no login needed)
  console.log('Opening playlist...');
  await page.goto(PLAYLIST_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'debug-playlist.png' });

  // Scroll to load all tracks
  console.log('Scrolling to load tracks...');
  let prevHeight = 0;
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(600);
    const height = await page.evaluate(() => document.body.scrollHeight);
    if (height === prevHeight) break;
    prevHeight = height;
  }

  // Scrape tracks
  console.log('Scraping tracks...');
  const tracks = await page.evaluate(() => {
    const rows = document.querySelectorAll('[data-testid="tracklist-row"]');
    return Array.from(rows).map((row, index) => {
      const titleEl = row.querySelector('[data-testid="internal-track-link"] div');
      const artistEls = row.querySelectorAll('a[href*="/artist/"]');
      const title = titleEl ? titleEl.innerText.trim() : '';
      const artists = Array.from(artistEls).map(a => a.innerText.trim()).filter(Boolean);
      const linkEl = row.querySelector('a[href*="/track/"]');
      const link = linkEl ? linkEl.href : '';
      return { index: index + 1, title, artists, link };
    }).filter(t => t.title);
  });

  console.log(`Found ${tracks.length} tracks`);

  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  await browser.close();

  const html = generateHTML(tracks, dateStr);
  fs.writeFileSync(path.join(__dirname, '..', 'index.html'), html, 'utf8');
  console.log('index.html written.');
})();

function generateHTML(tracks, date) {
  const items = tracks.map(t => {
    const artistStr = t.artists.join(', ');
    const href = t.link || '#';
    return `
    <li class="track">
      <span class="num">${String(t.index).padStart(2, '0')}</span>
      <div class="info">
        <a class="title" href="${href}" target="_blank" rel="noopener">${t.title}</a>
        <span class="artist">${artistStr}</span>
      </div>
    </li>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Радар новинок</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@300;700&family=Martian+Mono:wght@300;400&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #0a0a0a;
      --surface: #111;
      --accent: #1ed760;
      --text: #e8e8e8;
      --muted: #555;
      --border: #1e1e1e;
    }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Martian Mono', monospace;
      min-height: 100vh;
      overflow-x: hidden;
    }

    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
      pointer-events: none;
      z-index: 100;
      opacity: 0.4;
    }

    header {
      padding: 4rem 2rem 2rem;
      border-bottom: 1px solid var(--border);
      position: relative;
      overflow: hidden;
    }

    header::after {
      content: 'RADAR';
      position: absolute;
      right: -1rem;
      top: 50%;
      transform: translateY(-50%);
      font-family: 'Unbounded', sans-serif;
      font-size: clamp(5rem, 18vw, 14rem);
      font-weight: 700;
      color: transparent;
      -webkit-text-stroke: 1px var(--border);
      letter-spacing: -0.05em;
      pointer-events: none;
      user-select: none;
    }

    .label {
      font-size: 0.65rem;
      font-weight: 300;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 1rem;
    }

    h1 {
      font-family: 'Unbounded', sans-serif;
      font-size: clamp(1.8rem, 5vw, 3.5rem);
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1;
      position: relative;
      z-index: 1;
    }

    .meta {
      margin-top: 1rem;
      font-size: 0.7rem;
      color: var(--muted);
      letter-spacing: 0.1em;
    }

    main {
      max-width: 860px;
      margin: 0 auto;
      padding: 2rem;
    }

    .count {
      font-size: 0.65rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 1.5rem;
    }

    ul.tracklist { list-style: none; }

    .track {
      display: flex;
      align-items: baseline;
      gap: 1.5rem;
      padding: 1rem 0;
      border-bottom: 1px solid var(--border);
      transition: background 0.15s;
      animation: fadeUp 0.4s both;
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .track:hover {
      background: var(--surface);
      margin: 0 -1rem;
      padding-left: 1rem;
      padding-right: 1rem;
    }

    .num {
      font-size: 0.65rem;
      color: var(--muted);
      min-width: 2rem;
      flex-shrink: 0;
      font-weight: 300;
    }

    .info {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      min-width: 0;
    }

    a.title {
      font-family: 'Unbounded', sans-serif;
      font-size: clamp(0.8rem, 2vw, 1rem);
      font-weight: 300;
      color: var(--text);
      text-decoration: none;
      letter-spacing: -0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    a.title:hover { color: var(--accent); }

    .artist {
      font-size: 0.65rem;
      color: var(--muted);
      letter-spacing: 0.05em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    footer {
      text-align: center;
      padding: 3rem 2rem;
      font-size: 0.6rem;
      color: var(--muted);
      letter-spacing: 0.15em;
      text-transform: uppercase;
    }

    footer a { color: var(--accent); text-decoration: none; }
  </style>
</head>
<body>
  <header>
    <p class="label">Spotify · Персональный плейлист</p>
    <h1>Радар<br>новинок</h1>
    <p class="meta">Обновлено: ${date}</p>
  </header>
  <main>
    <p class="count">${tracks.length} треков</p>
    <ul class="tracklist">
      ${items}
    </ul>
  </main>
  <footer>
    <a href="${PLAYLIST_URL}" target="_blank">Открыть в Spotify</a>
  </footer>
</body>
</html>`;
}
