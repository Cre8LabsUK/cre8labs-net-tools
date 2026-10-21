// Renders the full walkthrough and one video per chapter into out/.
// Usage: node scripts/render-all.mjs [compositionId ...]
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition, getCompositions} from '@remotion/renderer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serveUrl = await bundle({entryPoint: path.join(root, 'src', 'index.ts')});
const wanted = process.argv.slice(2);
const ids = wanted.length ? wanted : (await getCompositions(serveUrl)).map((c) => c.id);

for (const id of ids) {
  const composition = await selectComposition({serveUrl, id});
  const outputLocation = path.join(root, 'out', `${id}.mp4`);
  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    crf: 18,
    pixelFormat: 'yuv420p',
    outputLocation,
    onProgress: ({progress}) => {
      const pct = Math.floor(progress * 10) * 10;
      if (pct !== last) console.log(`${id}: ${pct}%`), (last = pct);
    },
  });
  console.log(`done ${outputLocation}`);
}
