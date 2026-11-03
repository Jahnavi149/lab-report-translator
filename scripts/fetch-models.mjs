// OPT-IN, for local evaluation only (never run by dev/build; the app does not use it). Downloads the model once: StanfordAIMI/stanford-deidentifier-base (MIT), the ONNX int8 build from
// onnx-community. It is a clinical de-identification model (names, hospitals, IDs, phones, dates) that runs inside
// this server, so report text never goes to a third party to be checked.
//
//   npm run models        (also runs before `npm run dev` and `npm run build`)
//
// Every file is pinned by SHA-256. A file that does not match is deleted and the script fails, so a swapped or
// truncated model can never be loaded.
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';

const BASE = 'https://huggingface.co/onnx-community/stanford-deidentifier-base-ONNX/resolve/main';
const DIR = 'models/ner';
const FILES = [
  { name: 'config.json', remote: 'config.json', sha256: '026bc4a9e3fed6e9ee0e6f26ca9f42f30b81c246e29d858365eb22d3c5819dfd' },
  { name: 'tokenizer.json', remote: 'tokenizer.json', sha256: '9355eae89d401cee6b1f7c9acaf4791191e3b22c918e5f616b6baea13b66e748' },
  { name: 'tokenizer_config.json', remote: 'tokenizer_config.json', sha256: 'ecf53e3bd811d5f76f3efba0dbf915c941245b011ab735d36aeedaf8470e61c1' },
  { name: 'model_int8.onnx', remote: 'onnx/model_int8.onnx', sha256: 'c62de8559f11e01351a5be6e8485841a5a81223fb0c8b56811331107c36a11e4' },
];

const sha256 = (path) => new Promise((resolve, reject) => {
  const h = createHash('sha256');
  createReadStream(path).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
});

mkdirSync(DIR, { recursive: true });
let downloaded = 0;
for (const f of FILES) {
  const path = `${DIR}/${f.name}`;
  if (existsSync(path) && (await sha256(path)) === f.sha256) continue;
  console.log(`Downloading ${f.remote} ...`);
  const res = await fetch(`${BASE}/${f.remote}`, { redirect: 'follow' });
  if (!res.ok || !res.body) { console.error(`Could not download ${f.remote} (HTTP ${res.status}).`); process.exit(1); }
  const tmp = `${path}.part`;
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
  if ((await sha256(tmp)) !== f.sha256) { rmSync(tmp, { force: true }); console.error(`${f.name} does not match its pinned SHA-256; refusing to use it.`); process.exit(1); }
  renameSync(tmp, path);
  downloaded++;
}
writeFileSync(`${DIR}/.ok`, new Date().toISOString());
console.log(downloaded === 0 ? 'Privacy model already in place and verified.' : `Privacy model ready (${downloaded} file${downloaded === 1 ? '' : 's'} downloaded and verified).`);
