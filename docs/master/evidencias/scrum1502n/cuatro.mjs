// SCRUM-1502n · de un solo uso. Cuatro pasadas del guard (scrum921c, por su propio camino) sobre un
// worktree desechable fijado a main: {sin siembra, con siembra} × {guard de hoy, regla A}.
// Regla A = la mitad «a pelo» de sinCitas: un literal en docs/master/** deja de respaldar.
// Cada pasada en un proceso hijo, para que el import del guard no se cachee entre pasadas.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const WT = process.argv[2];
const SEM = process.argv[3];
const FOTO = process.argv[4]; // docs/master/evidencias/scrum1502h/foto.mjs
const HELPER = path.join(WT, 'tests/_respaldo-de-firma.mjs');
const ORIG = fs.readFileSync(HELPER, 'utf8');
const LINEA = 'return fuentesLocales(raiz).map((ruta) => {';
if (ORIG.split(LINEA).length !== 2) throw new Error('CIEGO: la línea a mutar no aparece exactamente una vez');
const MUT = ORIG.replace(LINEA, "return fuentesLocales(raiz).filter((r) => !r.startsWith('docs/master/')).map((ruta) => {");
const semT = path.join(WT, 'tests/zz-sembrada-1502n.test.mjs');
const semD = path.join(WT, 'docs/master/ZZ-SEMBRADA.md');
const res = {};
try {
  for (const siembra of [false, true]) {
    for (const regla of ['hoy', 'A']) {
      if (siembra) { fs.copyFileSync(path.join(SEM, 'semilla-marca.mjs.txt'), semT); fs.copyFileSync(path.join(SEM, 'semilla-fuente.md.txt'), semD); }
      else { for (const p of [semT, semD]) if (fs.existsSync(p)) fs.unlinkSync(p); }
      fs.writeFileSync(HELPER, regla === 'A' ? MUT : ORIG);
      const out = path.join(path.dirname(SEM), `foto-${siembra ? 'sem' : 'base'}-${regla}.json`);
      if (fs.existsSync(out)) fs.unlinkSync(out);
      // Con la regla A el propio guard cae al importarlo (su trinquete), y el proceso sale 1: la foto vale si se escribió.
      try { execFileSync(process.execPath, [FOTO, WT, out], { stdio: ['ignore', 'ignore', 'pipe'] }); } catch (e) { if (!fs.existsSync(out)) throw e; }
      const f = JSON.parse(fs.readFileSync(out, 'utf8'));
      res[`${siembra ? 'siembra' : 'base'}·${regla}`] = f;
      console.log(`${siembra ? 'siembra' : 'base   '} · ${regla.padEnd(3)} · sin=${f.congeladas.length} · ${JSON.stringify(f.porNivel)}`);
    }
  }
} finally {
  fs.writeFileSync(HELPER, ORIG);
  for (const p of [semT, semD]) if (fs.existsSync(p)) fs.unlinkSync(p);
}
const dif = (a, b) => res[b].congeladas.filter((x) => !res[a].congeladas.includes(x));
console.log('base: entran en sin-respaldo con la regla A →', JSON.stringify(dif('base·hoy', 'base·A')));
console.log('base: salen de sin-respaldo con la regla A →', JSON.stringify(res['base·hoy'].congeladas.filter((x) => !res['base·A'].congeladas.includes(x))));
console.log('siembra: entran con la regla A →', JSON.stringify(dif('siembra·hoy', 'siembra·A')));
console.log('siembra·hoy contiene la sembrada en sin-respaldo:', res['siembra·hoy'].congeladas.some((x) => x.includes('zz-sembrada')));
