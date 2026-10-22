// Mutaciones de SCRUM-962c: cada una reintroduce una avería del censo viejo. Corre desde la raíz.
import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';

const D = 'scripts/_censo-distintos.mjs';
const C = 'scripts/censo-objetivo-tactil-panel.mjs';
const MUT = [
  ['M1 ⒞ vara fija de 44', D, 'if (m.tocable >= minimoPara(ancho)) return \'cumple\';', 'if (m.tocable >= 44) return \'cumple\';'],
  ['M2 ⒞ btn-sm no se separa', D, "if (m.clase === 'control' && esBtnSm(m.sel)) return 'exento';", ''],
  ['M3 ⒜ campos sumados a cortos', D, "if (m.clase === 'campo') return 'campo';", ''],
  ['M4 ⒝ sinMirar no mira lo visto', D, 'if (!vistos.has(k) && !sin.has(k))', 'if (!sin.has(k))'],
  ['M5 ⒜ población vieja', D, "export const POBLACION = CONTROLES + ', ' + CAMPOS;", 'export const POBLACION = INTERACTIVOS;'],
  ['M6 ⒟ árbitro de etiqueta con casillas', D, ".filter((s) => s !== 'input[type=\"checkbox\"]' && s !== 'input[type=\"radio\"]')", '.filter(() => true)'],
  ['M7 ⒟ sonda: no compara envuelta y suelta', D, "debe(!(env && sue) || env.tocable !== sue.tocable,", 'debe(true,'],
  ['M8 ⒝ sonda: no mira la oculta', D, "debe(rs.sinPintar.some((s) => s.id === '__sonda-oculta'),", 'debe(true,'],
  ['M9 ⒜ sonda: no mira el campo', D, "debe(campo && campo.clase === 'campo' && v('__sonda-campo') === 'campo',", 'debe(true,'],
  ['M10 ⒟ censo: etiqueta sin exigir control', C, 'lab && lab.control === el && pinta(lab)', 'lab && pinta(lab)'],
  ['M11 censo: sondas viejas', C, 'pagina(s.html + SONDAS_HTML)', "pagina(s.html + '<button id=\"__sonda\">.</button>')"],
  ['M12 ⒝ censo: estado que no abre no sale 2', C, 'if (estadosFallidos.length) noSupe(', 'if (false) noSupe('],
];
const TEST = 'tests/scrum962c-censo-tactil-poblacion-vara-etiqueta.test.mjs';
const env = { ...process.env }; delete env.FORCE_COLOR;
const correr = () => {
  const r = spawnSync(process.execPath, ['--test', TEST], { encoding: 'utf8', env });
  const n = (k) => Number((r.stdout.match(new RegExp(`ℹ ${k} (\\d+)`)) || [])[1]);
  return { code: r.status, tests: n('tests'), pass: n('pass'), fail: n('fail') };
};
const base = correr();
console.log('BASE', JSON.stringify(base));
if (base.fail !== 0 || !(base.tests > 0)) { console.log('BASE no verde: aborto'); process.exit(2); }
let vivas = 0, ciegas = 0;
for (const [nom, f, de, a] of MUT) {
  const t = fs.readFileSync(f, 'utf8');
  if (t.split(de).length !== 2) { console.log(`CIEGA ${nom}: el patrón aparece ${t.split(de).length - 1} veces`); ciegas++; continue; }
  fs.writeFileSync(f, t.replace(de, a));
  const ns = execFileSync('git', ['diff', '--numstat', '--', f], { encoding: 'utf8' }).trim();
  const r = correr();
  execFileSync('git', ['restore', '--source=HEAD', '--', f]);
  const veredicto = r.fail > 0 ? 'MUERTA' : (r.tests > 0 ? 'VIVA' : 'CIEGA');
  if (veredicto === 'VIVA') vivas++; if (veredicto === 'CIEGA') ciegas++;
  console.log(`${veredicto.padEnd(7)} ${nom.padEnd(42)} tests ${r.tests} fail ${r.fail} · numstat «${ns}»`);
}
const limpio = execFileSync('git', ['status', '--porcelain', '--', 'scripts', 'tests'], { encoding: 'utf8' }).trim();
console.log(`vivas ${vivas} · ciegas ${ciegas} · de ${MUT.length} · árbol restaurado: ${limpio === '' ? 'sí' : 'NO → ' + limpio}`);
console.log('EXIT=' + (vivas || ciegas || limpio ? 1 : 0));
process.exit(vivas || ciegas || limpio ? 1 : 0);
