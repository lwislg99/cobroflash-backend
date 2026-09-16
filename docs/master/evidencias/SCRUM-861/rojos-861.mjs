// docs/master/evidencias/SCRUM-861/rojos-861.mjs — los seis rojos de SCRUM-861, vistos caer
//
//   node docs/master/evidencias/SCRUM-861/rojos-861.mjs      (desde la raíz, con el árbol limpio)
//
// EVIDENCIA, NO GUARD. Aplica al oráculo (`tests/_microcopy-aprobada.mjs`) seis mutaciones, una a
// una, y comprueba que cae el test de `tests/scrum861-firma-por-delegacion.test.mjs` que tiene que
// caer. Después de cada una restaura los bytes originales y lo verifica con `Buffer.compare`.
//
// 🔴 CADA MUTACIÓN SE COMPRUEBA APLICADA ANTES DE CORRER: un rojo que no aparece puede ser una
// mutación que no entró (el ancla no casaba), y eso no es «el test no vigila» sino «no se probó».
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url));
const ORACULO = path.join(RAIZ, 'tests', '_microcopy-aprobada.mjs');
const TEST = path.join(RAIZ, 'tests', 'scrum861-firma-por-delegacion.test.mjs');
const ORIGINAL = fs.readFileSync(ORACULO);

const MUTACIONES = [
  {
    rojo: 'a',
    que: 'la firma delegada nunca cuenta',
    debeCaer: 'a) firma delegada',
    de: "aprobada: firmante === 'fundador' || (firmante === 'orquestador' && delegacion !== null && vigente),",
    a: "aprobada: firmante === 'fundador',",
  },
  {
    rojo: 'b',
    que: 'se ignora si la delegación sigue vigente',
    debeCaer: 'b) la misma firma con la delegación RETIRADA',
    de: "(firmante === 'orquestador' && delegacion !== null && vigente)",
    a: "(firmante === 'orquestador' && delegacion !== null)",
  },
  {
    rojo: 'c',
    que: 'no se exige la referencia al comentario de Jira',
    debeCaer: 'c) la misma firma SIN referencia',
    de: '    if (r) return { referencia: `SCRUM-${r[1]} comentario ${r[2]}` };',
    a: "    return { referencia: r ? `SCRUM-${r[1]} comentario ${r[2]}` : 'sin referencia' };",
  },
  {
    rojo: 'd',
    que: 'cualquier firma «por el orquestador» cuenta, sea o no la delegada',
    debeCaer: 'd) «por el orquestador» a secas',
    de: "(firmante === 'orquestador' && delegacion !== null && vigente)",
    a: "(firmante === 'orquestador' && vigente)",
  },
  {
    rojo: 'e',
    que: 'la firma delegada se lee también dentro de las citas',
    debeCaer: 'e) la firma delegada DENTRO de una cita',
    de: "  const lineas = String(texto).split(/\\r?\\n/).filter((l) => !/^\\s*>/.test(l));\n  for (const l of lineas) {\n    if (!FIRMA_DELEGADA.test(l)) continue;",
    a: "  const lineas = String(texto).split(/\\r?\\n/).map((l) => l.replace(/^\\s*>\\s?/, ''));\n  for (const l of lineas) {\n    if (!FIRMA_DELEGADA.test(l)) continue;",
  },
  {
    rojo: 'f',
    que: 'la firma del FUNDADOR pasa a depender de la delegación',
    debeCaer: 'f) CONTROL: la firma del fundador sigue contando',
    de: "aprobada: firmante === 'fundador' || (firmante === 'orquestador' && delegacion !== null && vigente),",
    a: "aprobada: (firmante === 'fundador' && vigente) || (firmante === 'orquestador' && delegacion !== null && vigente),",
  },
];

function correrTest() {
  try {
    return execFileSync(process.execPath, ['--test', TEST], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return String(e.stdout || '') + String(e.stderr || '');
  }
}

const falladosDe = (salida) => salida.split(/\r?\n/)
  .filter((l) => /^✖ SCRUM-861 · /.test(l))
  .map((l) => l.replace(/^✖ SCRUM-861 · /, '').replace(/\s*\(\d+(\.\d+)?ms\)\s*$/, ''));

let malos = 0;
try {
  const base = falladosDe(correrTest());
  if (base.length) {
    console.log(`🔴 CON EL ORÁCULO INTACTO ya fallan: ${[...new Set(base)].join(' | ')}. No se puede probar ningún rojo.`);
    process.exit(2);
  }
  console.log('✅ oráculo intacto: scrum861 en verde\n');

  for (const m of MUTACIONES) {
    const fuente = ORIGINAL.toString('utf8');
    const veces = fuente.split(m.de).length - 1;
    if (veces !== 1) {
      console.log(`🔴 ${m.rojo}) NO SE PUDO APLICAR: el ancla aparece ${veces} veces. Esto NO es un rojo probado.`);
      malos++;
      continue;
    }
    fs.writeFileSync(ORACULO, fuente.replace(m.de, m.a));
    const caidos = [...new Set(falladosDe(correrTest()))];
    fs.writeFileSync(ORACULO, ORIGINAL);
    if (Buffer.compare(fs.readFileSync(ORACULO), ORIGINAL) !== 0) {
      console.log('🔴 EL ORÁCULO NO QUEDÓ RESTAURADO BYTE A BYTE. Paro.');
      process.exit(3);
    }
    const cayoElQueToca = caidos.some((t) => t.startsWith(m.debeCaer));
    console.log(`${cayoElQueToca ? '✅' : '🔴'} ${m.rojo}) mutación «${m.que}» → caen ${caidos.length}: ${caidos.join(' | ') || '(ninguno)'}`);
    if (!cayoElQueToca) malos++;
  }
} finally {
  fs.writeFileSync(ORACULO, ORIGINAL);
}

const final = falladosDe(correrTest());
console.log(`\noráculo restaurado · Buffer.compare = ${Buffer.compare(fs.readFileSync(ORACULO), ORIGINAL)} · scrum861 tras restaurar: ${final.length ? '🔴 ' + final.join(' | ') : '✅ verde'}`);
console.log(malos ? `\n🔴 ${malos} rojo(s) sin probar` : '\n✅ los seis rojos, vistos caer');
process.exit(malos || final.length ? 1 : 0);
