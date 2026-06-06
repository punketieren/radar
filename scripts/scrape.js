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

  console.log('Opening playlist...');
  await page.goto(PLAYLIST_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'debug-playlist.png' });

  console.log('Scrolling to load tracks...');
  let prevHeight = 0;
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(600);
    const height = await page.evaluate(() => document.body.scrollHeight);
    if (height === prevHeight) break;
    prevHeight = height;
  }

  console.log('Scraping tracks...');
  const tracks = await page.evaluate(() => {
    const rows = document.querySelectorAll('[data-testid="tracklist-row"]');
    return Array.from(rows).map((row, index) => {
      const titleEl = row.querySelector('[data-testid="internal-track-link"] div');
      const artistEls = row.querySelectorAll('a[href*="/artist/"]');
      const albumEl = row.querySelector('a[href*="/album/"]');
      const title = titleEl ? titleEl.innerText.trim() : '';
      const artists = Array.from(artistEls).map(a => a.innerText.trim()).filter(Boolean);
      const album = albumEl ? albumEl.innerText.trim() : '';
      const linkEl = row.querySelector('a[href*="/track/"]');
      const link = linkEl ? linkEl.href : '';
      return { index: index + 1, title, artists, album, link };
    }).filter(t => t.title);
  });

  console.log(`Found ${tracks.length} tracks`);

  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  await browser.close();

  if (tracks.length === 0) {
    console.error('No tracks found! Check debug-playlist.png');
    process.exit(1);
  }

  const html = generateHTML(tracks, dateStr);
  fs.writeFileSync(path.join(__dirname, '..', 'index.html'), html, 'utf8');
  console.log('index.html written.');
})();

function generateHTML(tracks, date) {
  const items = tracks.map(t => {
    const artistStr = t.artists.join(', ');
    const href = t.link || '#';
    const albumLine = t.album ? `<span class="album">${t.album}</span>` : '';
    return `
    <li class="track">
      <span class="num">${String(t.index).padStart(2, '0')}</span>
      <div class="info">
        <a class="title" href="${href}" target="_blank" rel="noopener">${t.title}</a>
        <span class="artist">${artistStr}</span>
        ${albumLine}
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
  
  
  <link rel="stylesheet" href="styles.css">

</head>
<body>
  <header>
     
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
    <a href="https://open.spotify.com/playlist/37i9dQZEVXbvlGjddLmO0N" target="_blank">Открыть в Spotify</a>
  </footer>
</body>
</html>`;
}
