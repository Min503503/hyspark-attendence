import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const publicDir = join(root, 'public');
const logoPath = resolve(root, 'src/assets/hyspark-logo.png');
const logoDataUri = `data:image/png;base64,${readFileSync(logoPath).toString('base64')}`;

const variants = [
  {
    file: 'og-networking-hyspark-logo.png',
  },
  {
    file: 'og-networking-member-hyspark-logo.png',
  },
  {
    file: 'og-networking-staff-hyspark-logo.png',
  },
];

const aliasMap = {
  'og-networking-hyspark-logo.png': ['og-networking.png'],
  'og-networking-member-hyspark-logo.png': [
    'og-networking-member-bold2.png',
    'og-networking-member-bold.png',
    'og-networking-member-toss2.png',
    'og-networking-member.png',
  ],
  'og-networking-staff-hyspark-logo.png': [
    'og-networking-staff-bold2.png',
    'og-networking-staff-bold.png',
    'og-networking-staff-toss2.png',
    'og-networking-staff.png',
  ],
};

function pageHtml(variant) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <style>
    @font-face {
      font-family: AppleSDGothicNeo;
      src: local("Apple SD Gothic Neo");
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 1200px;
      height: 630px;
      overflow: hidden;
      font-family: AppleSDGothicNeo, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at 50% 50%, rgba(18, 56, 255, 0.08) 0 18%, transparent 44%),
        linear-gradient(135deg, #f6faff 0%, #ffffff 48%, #edf5ff 100%);
      color: #071b3a;
    }
    .stage {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1200px;
      height: 630px;
    }
    .logoOnly {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 720px;
      height: 368px;
    }
    .logoOnly::before {
      content: "";
      position: absolute;
      inset: 12px 22px;
      border-radius: 999px;
      background: rgba(18, 56, 255, 0.08);
      filter: blur(42px);
    }
    .logoOnly img {
      position: relative;
      z-index: 1;
      width: 640px;
      height: auto;
      filter: drop-shadow(0 24px 46px rgba(18, 56, 255, 0.20));
    }
  </style>
</head>
<body>
  <div class="stage">
    <div class="logoOnly"><img src="${logoDataUri}" /></div>
  </div>
</body>
</html>`;
}

mkdirSync(publicDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });

for (const variant of variants) {
  await page.setContent(pageHtml(variant), { waitUntil: 'networkidle' });
  const output = join(publicDir, variant.file);
  await page.screenshot({ path: output, type: 'png', clip: { x: 0, y: 0, width: 1200, height: 630 } });
  const data = readFileSync(output);
  for (const alias of aliasMap[variant.file] || []) {
    writeFileSync(join(publicDir, alias), data);
  }
}

await browser.close();
