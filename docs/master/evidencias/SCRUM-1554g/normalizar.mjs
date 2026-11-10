// Deshace las dos transformaciones conocidas del camino de servir (Cloudflare Email Obfuscation y el sello ?v= /
// __BUILD_ID__ del dashboard) y dice si, deshechas, el servido es idéntico al blob. Uso: node normalizar.mjs <tree> <prod> <build>
import { readFileSync } from 'node:fs';
const [t, p, build] = process.argv.slice(2);
const tree = readFileSync(t, 'utf8').replace(/\r\n/g, '\n');
let prod = readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const decode = (hex) => { const k = parseInt(hex.slice(0, 2), 16); let s = ''; for (let i = 2; i < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ k); return s; };
let correos = 0;
prod = prod.replace(/<a href="\/cdn-cgi\/l\/email-protection#([0-9a-f]+)"><span class="__cf_email__" data-cfemail="([0-9a-f]+)">\[email&#160;protected\]<\/span><\/a>/g,
  (_, h, c) => { correos++; const m = decode(c); return `<a href="mailto:${decode(h).replace(/^mailto:/, '')}">${m}</a>`; });
prod = prod.replace('<script data-cfasync="false" src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"></script></body>', '</body>');
let sellos = 0;
prod = prod.replace(/\?v=[0-9a-f]{10}"/g, () => { sellos++; return '"'; });
if (build) prod = prod.replace(`content="${build}"`, 'content="__BUILD_ID__"');
const quedan = (prod.match(/\[email&#160;protected\]/g) || []).length;
console.log(JSON.stringify({ fichero: t, correos_ofuscados: correos, sellos_v: sellos, ofuscados_sin_deshacer: quedan, identico_tras_normalizar: tree === prod }));
