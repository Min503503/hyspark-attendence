import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const distDir = join(process.cwd(), 'dist');
const baseHtml = readFileSync(join(distDir, 'index.html'), 'utf8');

const pages = [
  {
    audience: 'member',
    paths: ['networking/member/index.html', 'networking/member/toss/index.html'],
    title: '하이스파크 네트워킹 참여체크',
    description: '못 가면 체크. 해당 없으면 그냥 닫기.',
    image: 'https://hyspark-attendence.vercel.app/og-networking-member-hyspark-logo.png',
  },
  {
    audience: 'staff',
    paths: ['networking/staff/index.html', 'networking/staff/toss/index.html'],
    title: '하이스파크 네트워킹 참여체크',
    description: '참여하면 체크. 세션·네트워킹 모두 가는 운영진만.',
    image: 'https://hyspark-attendence.vercel.app/og-networking-staff-hyspark-logo.png',
  },
];

function replaceMeta(html, { title, description, image }) {
  return html
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description" content=".*?">/, `<meta name="description" content="${description}">`)
    .replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${description}" />`)
    .replace(/<meta property="og:image" content=".*?" \/>/, `<meta property="og:image" content="${image}" />`)
    .replace(/<meta name="twitter:title" content=".*?" \/>/, `<meta name="twitter:title" content="${title}" />`)
    .replace(/<meta name="twitter:description" content=".*?" \/>/, `<meta name="twitter:description" content="${description}" />`)
    .replace(/<meta name="twitter:image" content=".*?" \/>/, `<meta name="twitter:image" content="${image}" />`);
}

for (const page of pages) {
  for (const pagePath of page.paths) {
    const outputPath = join(distDir, pagePath);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, replaceMeta(baseHtml, page));
  }
}
