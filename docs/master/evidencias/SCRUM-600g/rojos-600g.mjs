// docs/master/evidencias/SCRUM-600g/rojos-600g.mjs — los rojos de SCRUM-600g, vistos caer
//
//   node docs/master/evidencias/SCRUM-600g/rojos-600g.mjs      (desde la raíz, con el árbol limpio)
//
// EVIDENCIA, NO GUARD. Aplica una a una las mutaciones de abajo a la vista, a la fuente de rótulos
// o a la ficha de microcopy, y comprueba que cae el test de
// `tests/scrum600g-plantillas-en-el-documento-suelto.test.mjs` que tiene que caer. Después de cada
// una restaura los bytes originales de TODOS los ficheros tocados y lo verifica con `Buffer.compare`.
//
// 🔴 CADA MUTACIÓN SE COMPRUEBA APLICADA ANTES DE CORRER: un rojo que no aparece puede ser una
// mutación que no entró (el ancla no casaba), y eso no es «el test no vigila» sino «no se probó».
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url));
const TEST = path.join(RAIZ, 'tests', 'scrum600g-plantillas-en-el-documento-suelto.test.mjs');
const VISTA = path.join(RAIZ, 'public', 'dashboard', 'js', 'quotesView.js');
const ROTULOS = path.join(RAIZ, 'public', 'dashboard', 'js', 'rotulosDelDocumento.js');
const FICHA = path.join(RAIZ, 'docs', 'microcopy', '2026-09-15-SCRUM-600-plantillas-en-el-documento-suelto.md');
const ORIGINALES = new Map([VISTA, ROTULOS, FICHA].map((f) => [f, fs.readFileSync(f)]));

const MUTACIONES = [
  {
    rojo: 'a', fichero: VISTA, debeCaer: '①',
    que: 'vuelve la puerta de «📋 Usar plantilla»',
    de: '  linesHeader.appendChild(useTemplateBtn);',
    a: '  if (!esDocumentoSuelto) linesHeader.appendChild(useTemplateBtn);',
  },
  {
    rojo: 'b', fichero: VISTA, debeCaer: '①',
    que: 'vuelve la puerta de «💾 Guardar como plantilla»',
    de: '  actionsRow.appendChild(saveTemplateBtn);',
    a: '  if (!esDocumentoSuelto) actionsRow.appendChild(saveTemplateBtn);',
  },
  {
    rojo: 'c', fichero: VISTA, debeCaer: '②',
    que: 'la hoja «Usar» dice la frase del presupuesto también en la factura',
    de: '${esDocumentoSuelto ? window.rotulosDelDocumento.hojaUsarPlantilla() : ',
    a: '${false ? window.rotulosDelDocumento.hojaUsarPlantilla() : ',
  },
  {
    rojo: 'd', fichero: VISTA, debeCaer: '③',
    que: 'la hoja «Guardar» dice la frase del presupuesto también en la factura',
    de: '${esDocumentoSuelto ? window.rotulosDelDocumento.hojaGuardarPlantilla() : ',
    a: '${false ? window.rotulosDelDocumento.hojaGuardarPlantilla() : ',
  },
  {
    rojo: 'e', fichero: VISTA, debeCaer: '⑤',
    que: 'guardar la plantilla llama a la EMISIÓN (regla 38)',
    de: "await apiRequest('/admin/templates', {",
    a: "await apiRequest('/admin/invoices', {",
  },
  {
    rojo: 'f', fichero: VISTA, debeCaer: '④',
    que: '«3. Condiciones» se cuela en el documento suelto',
    de: '  if (!esDocumentoSuelto) leftCard.appendChild(blockConditions);',
    a: '  leftCard.appendChild(blockConditions);',
  },
  {
    rojo: 'g', fichero: VISTA, debeCaer: '④',
    que: '«4. Envío» se cuela en el documento suelto',
    de: '  if (!esDocumentoSuelto) leftCard.appendChild(blockDelivery);',
    a: '  leftCard.appendChild(blockDelivery);',
  },
  {
    rojo: 'h', fichero: VISTA, debeCaer: '⑥',
    que: 'el PRESUPUESTO pierde su frase y dice la del documento suelto',
    de: '${esDocumentoSuelto ? window.rotulosDelDocumento.hojaUsarPlantilla() : ',
    a: '${true ? window.rotulosDelDocumento.hojaUsarPlantilla() : ',
  },
  {
    rojo: 'i', fichero: ROTULOS, debeCaer: '⑦',
    que: 'aparece una variante justificante que nadie ha firmado',
    de: "hojaUsarPlantilla: function () { return 'Elige una plantilla para cargar sus líneas en este documento.'; },",
    a: "hojaUsarPlantilla: function () { return esJustificante() ? 'Elige una plantilla para cargar sus líneas en el justificante.' : 'Elige una plantilla para cargar sus líneas en este documento.'; },",
  },
  {
    rojo: 'j', fichero: VISTA, debeCaer: '⑧',
    que: 'la frase se escribe a pelo en la vista en vez de leerse de la fuente',
    de: 'window.rotulosDelDocumento.hojaGuardarPlantilla()',
    a: "'Dale un nombre a esta plantilla para reutilizar sus líneas más adelante.'",
  },
  {
    rojo: 'k', fichero: FICHA, debeCaer: '⓪',
    que: 'la firma delegada pierde la referencia al comentario de Jira',
    de: ' — SCRUM-600 comentario 15357.',
    a: '.',
  },
];

function correrTest() {
  try {
    return execFileSync(process.execPath, ['--test', TEST], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return String(e.stdout || '') + String(e.stderr || '');
  }
}

const falladosDe = (salida) => [...new Set(salida.split(/\r?\n/)
  .filter((l) => /^✖ SCRUM-600g · /.test(l))
  .map((l) => l.replace(/^✖ SCRUM-600g · /, '').replace(/\s*\(\d+(\.\d+)?ms\)\s*$/, '')))];

function restaurarTodo() {
  for (const [f, bytes] of ORIGINALES) fs.writeFileSync(f, bytes);
  return [...ORIGINALES].every(([f, bytes]) => Buffer.compare(fs.readFileSync(f), bytes) === 0);
}

let malos = 0;
try {
  const base = falladosDe(correrTest());
  if (base.length) {
    console.log(`🔴 CON EL ÁRBOL INTACTO ya fallan: ${base.join(' | ')}. No se puede probar ningún rojo.`);
    process.exit(2);
  }
  console.log('✅ árbol intacto: scrum600g en verde\n');

  for (const m of MUTACIONES) {
    const fuente = ORIGINALES.get(m.fichero).toString('utf8');
    const veces = fuente.split(m.de).length - 1;
    if (veces !== 1) {
      console.log(`🔴 ${m.rojo}) NO SE PUDO APLICAR: el ancla aparece ${veces} veces en ${path.basename(m.fichero)}. Esto NO es un rojo probado.`);
      malos++;
      continue;
    }
    fs.writeFileSync(m.fichero, fuente.replace(m.de, m.a));
    const caidos = falladosDe(correrTest());
    if (!restaurarTodo()) {
      console.log('🔴 LOS FICHEROS NO QUEDARON RESTAURADOS BYTE A BYTE. Paro.');
      process.exit(3);
    }
    const cayoElQueToca = caidos.some((t) => t.startsWith(m.debeCaer));
    console.log(`${cayoElQueToca ? '✅' : '🔴'} ${m.rojo}) «${m.que}» → caen ${caidos.length}: ${caidos.map((t) => t.slice(0, 60)).join(' | ') || '(ninguno)'}`);
    if (!cayoElQueToca) malos++;
  }
} finally {
  restaurarTodo();
}

const intactos = [...ORIGINALES].every(([f, bytes]) => Buffer.compare(fs.readFileSync(f), bytes) === 0);
const final = falladosDe(correrTest());
console.log(`\nficheros restaurados byte a byte: ${intactos ? 'sí' : '🔴 NO'} · scrum600g tras restaurar: ${final.length ? '🔴 ' + final.join(' | ') : '✅ verde'}`);
console.log(malos ? `\n🔴 ${malos} rojo(s) sin probar` : `\n✅ los ${MUTACIONES.length} rojos, vistos caer`);
process.exit(malos || final.length || !intactos ? 1 : 0);
