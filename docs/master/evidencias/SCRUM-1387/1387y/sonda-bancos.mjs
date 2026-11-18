// Sonda J6 · SCRUM-1387y: para cada mutación de los 3 bancos heredados de J6,
// ¿el ancla «de» sigue (1 vez) en su sujeto? ¿algún test del catálogo declara ese mismo «de»?
// Población declarada; control positivo sembrado: una mutación fabricada que copia un «de» de un catálogo real.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = process.argv[2];
const r = (p) => path.join(RAIZ, p);

// Catálogo: todos los tests que exportan MUTACIONES_QUE_ME_TUMBAN, leído por texto (no se importan:
// importarlos registraría sus tests). Se busca el «de» literal en el fuente del test.
const tests = fs.readdirSync(r('tests')).filter((f) => f.endsWith('.test.mjs'));
const catalogo = tests.filter((f) => fs.readFileSync(r('tests/' + f), 'utf8').includes('MUTACIONES_QUE_ME_TUMBAN'));
const fuentes = catalogo.map((f) => [f, fs.readFileSync(r('tests/' + f), 'utf8')]);
const declaraDe = (de) => {
  const js = JSON.stringify(de).slice(1, -1); // como iría escrito dentro de comillas
  const sq = de.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
  return fuentes.filter(([, t]) => t.includes(js) || t.includes(sq)).map(([f]) => f);
};
const veces = (fich, de) => { try { return fs.readFileSync(r(fich), 'utf8').split(de).length - 1; } catch { return 'NO-EXISTE'; } };

const bancos = [];
// 1324: array de [id, de, a] sobre scripts/vigia-silencio-de-main.mjs
{
  const t = fs.readFileSync(r('docs/master/evidencias/SCRUM-1324/mutar.mjs'), 'utf8');
  const m = t.match(/const MUTACIONES = (\[[\s\S]*?\n\]);/);
  const lista = eval(m[1]);
  bancos.push({ banco: 'SCRUM-1324', muts: lista.map(([id, de]) => ({ id, fichero: 'scripts/vigia-silencio-de-main.mjs', de })) });
}
// 1345: objetos {id, fichero: SCRIPT|TEST, de, a}
{
  const t = fs.readFileSync(r('docs/master/evidencias/SCRUM-1345/mutar.mjs'), 'utf8');
  const SCRIPT = (t.match(/const SCRIPT = ['"]([^'"]+)['"]/) || [])[1] || 'scripts/guards-entrada.mjs';
  const TEST = (t.match(/const TEST = ['"]([^'"]+)['"]/) || [])[1] || 'tests/scrum976-guards-entrada-con-techo.test.mjs';
  const m = t.match(/const MUTACIONES = (\[[\s\S]*?\n\]);/);
  const lista = new Function('SCRIPT', 'TEST', 'return ' + m[1])(SCRIPT, TEST);
  bancos.push({ banco: 'SCRUM-1345', muts: lista.map((x) => ({ id: x.id, fichero: x.fichero, de: x.de })) });
}
// 908c: mutar2.mjs, una mutación sobre scrum267 (la nº 2 de scrum859)
{
  const t = fs.readFileSync(r('docs/master/evidencias/scrum908c/mutar2.mjs'), 'utf8');
  const de = eval(t.match(/const DE = ('[^\n]*');/)[1]);
  bancos.push({ banco: 'scrum908c/mutar2', muts: [{ id: 'mut2 de scrum859', fichero: 'tests/scrum267-ancla-de-medicion.test.mjs', de }] });
}
// Control positivo sembrado: un «de» copiado de un catálogo real tiene que salir «declarado».
{
  const [f, t] = fuentes.find(([, t]) => /de: '([^'\\]{12,})'/.test(t));
  const de = t.match(/de: '([^'\\]{12,})'/)[1];
  bancos.push({ banco: 'CONTROL-sembrado', muts: [{ id: 'copia de ' + f, fichero: 'tests/' + f, de }] });
}

let total = 0;
for (const b of bancos) {
  for (const m of b.muts) {
    total += b.banco.startsWith('CONTROL') ? 0 : 1;
    const v = veces(m.fichero, m.de);
    const d = declaraDe(m.de);
    console.log(`${b.banco} · ${m.id.slice(0, 60)} · ancla en ${m.fichero}: ${v} · catálogo: ${d.length ? d.join(',') : '—'}`);
  }
}
console.log(`población: ${bancos.length - 1} bancos · ${total} mutaciones · ${catalogo.length} tests con catálogo de ${tests.length}`);
