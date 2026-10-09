// 公開のたびに実行する：読み込むファイル名に版番号（?v=日時）を付けて、スマホに古い版が残らないようにする。
// 使い方: node bump.mjs
import fs from "fs";
const v = new Date().toISOString().replace(/\D/g, "").slice(0, 12);
const files = fs.readdirSync(".").filter(f => /\.(js|html)$/.test(f) && f !== "server.js" && f !== "bump.mjs");
for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  const out = s
    .replace(/(from\s+["']\.\/[\w-]+\.js)(\?v=\d+)?(["'])/g, `$1?v=${v}$3`)
    .replace(/(import\(\s*["']\.\/[\w-]+\.js)(\?v=\d+)?(["'])/g, `$1?v=${v}$3`)
    .replace(/(src=["'](?:app\.js|style\.css))(\?v=\d+)?(["'])/g, `$1?v=${v}$3`)
    .replace(/(href=["']style\.css)(\?v=\d+)?(["'])/g, `$1?v=${v}$3`);
  if (out !== s) fs.writeFileSync(f, out);
}
console.log("version", v);
