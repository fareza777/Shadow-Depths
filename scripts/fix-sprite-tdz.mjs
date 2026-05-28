/**
 * Move export const blocks from file top to bottom (TDZ fix).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'rendering');

const FILES = [
  { file: 'enemySpritesBoss.js', exportName: 'BOSS_SPRITE_DEFS' },
  { file: 'enemySpritesHandCraftedExtended.js', exportName: 'HAND_CRAFTED_EXTENDED' },
  { file: 'enemySpritesRevisedPass2.js', exportName: 'REVISED_PASS2' },
  { file: 'enemySpritesRevisedPass3.js', exportName: 'REVISED_PASS3' },
];

for (const { file, exportName } of FILES) {
  const fp = path.join(ROOT, file);
  let src = fs.readFileSync(fp, 'utf8');
  const re = new RegExp(`export const ${exportName} = \\{[\\s\\S]*?\\};\\s*\\n`, 'm');
  const m = src.match(re);
  if (!m) {
    console.error(`${file}: export block not found`);
    process.exit(1);
  }
  const exportBlock = m[0].trimEnd();
  src = src.replace(re, '').trimEnd();
  src += '\n\n// Export after all grid/palette consts — avoids TDZ during module evaluation.\n' + exportBlock + '\n';
  fs.writeFileSync(fp, src);
  console.log(`fixed ${file}`);
}
