import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { App } = await server.ssrLoadModule('/src/App.tsx');
  const file = new URL('../dist/index.html', import.meta.url);
  const html = await readFile(file, 'utf8');
  if (!html.includes('<div id="root"></div>')) throw new Error('Missing landing root');
  const body = renderToString(createElement(App));
  await writeFile(file, html.replace('<div id="root"></div>', `<div id="root">${body}</div>`));
  console.log(`Landing prerendered: ${body.length} characters of real React content`);
} finally { await server.close(); }
