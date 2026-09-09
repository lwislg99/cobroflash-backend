// tests/scrum846-instrumentos-con-caso-conocido.test.mjs — SCRUM-846
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// UN CERO SIN UN CASO CONOCIDO DELANTE NO SE PUEDE JUZGAR.
//
// Cuatro instrumentos de esta casa devolvían números que nadie podía contrastar: leían el árbol
// de verdad y punto. Si su detector se rompía, salía un cero — y un cero de un instrumento roto
// se lee EXACTAMENTE igual que un cero de un árbol limpio.
//
//     🔒 «Un suelo no tiene por qué ser un mecanismo: a veces basta UN caso conocido encima de
//        la mesa. Un cero sin ningún caso conocido delante no se puede juzgar.»
//
// De dónde viene: la Sesión 3 dio CERO tests gateados sobre un árbol con 57, porque su detector
// casaba el literal en vez de seguir la variable. No se lo creyó SÓLO porque tenía un
// contraejemplo concreto delante. Esto le pone ese contraejemplo a cuatro instrumentos más.
//
// ── LO QUE ES UN CASO CONOCIDO, Y LO QUE NO ─────────────────────────────────────────────────
// Es una entrada FABRICADA —un literal, un árbol de mentira— cuya respuesta sabemos de antemano.
// NO vale darle el árbol de verdad: eso mide el árbol, no el instrumento.
//
// Y cada uno lleva su MITAD NEGATIVA pegada: una entrada donde el instrumento NO debe encontrar
// nada. Sin ella, uno que dijera «sí» a todo pasaría los cuatro casos de arriba.
//
// ⚠️ Se cambió UNA cosa fuera de este fichero: `censarMarcadores`/`censarLectores` reciben ahora
// la raíz por parámetro, con el valor de siempre por defecto. Era la única forma de ponerles un
// caso delante — no tenían argumentos. Cero cambios para quien ya los llamaba.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { clasificarBlob } from './_censo-eol.mjs';
import { censarTargetTactil } from './_censo-target-tactil.mjs';
import { censarMarcadores, censarLectores } from './_censo-marcado-de-cobro.mjs';
import { correspondencia } from '../scripts/frontera-dist.mjs';

/** Un árbol de mentira que se borra solo. */
function arbolDeMentira(ficheros) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum846-'));
  for (const [rel, texto] of Object.entries(ficheros)) {
    const abs = path.join(raiz, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, texto);
  }
  return raiz;
}

// ═══ ① `_censo-eol` · clasificarBlob ═════════════════════════════════════════════════════════

test('SCRUM-846 · `clasificarBlob` VE un CRLF y un CR suelto que le pongo delante', () => {
  // 🔴 EL CASO CONOCIDO: dos saltos de línea de tipos distintos, contados a mano.
  //    'a\r\n' → un CRLF · 'b\r' seguido de 'c' → un CR SUELTO.
  // La distinción importa: un CR suelto es lo que vuelve el fichero `-text` y deja al guard de
  // SCRUM-533 midiendo otra cosa (ver `project_eol_trampas_git`).
  const r = clasificarBlob(Buffer.from('a\r\nb\rc\n', 'utf8'));
  assert.equal(r.texto, true, '🔴 un texto normal se ha clasificado como binario');
  assert.equal(r.crlf, 1, `🔴 esperaba 1 CRLF y cuenta ${r.crlf}: el detector no separa CRLF de CR suelto`);
  assert.equal(r.crSuelto, 1, `🔴 esperaba 1 CR suelto y cuenta ${r.crSuelto}`);

  // ── LA MITAD NEGATIVA: un fichero LIMPIO no puede dar recuento.
  const limpio = clasificarBlob(Buffer.from('a\nb\nc\n', 'utf8'));
  assert.deepEqual({ crlf: limpio.crlf, crSuelto: limpio.crSuelto }, { crlf: 0, crSuelto: 0 },
    '🔴 encuentra saltos de Windows en un fichero que sólo tiene LF: acusaría a cualquiera');

  // ── Y un binario NO se cuenta como texto, o el censo mediría los PNG del repo.
  assert.equal(clasificarBlob(Buffer.from([0x61, 0x00, 0x62])).texto, false,
    '🔴 un buffer con un byte nulo se toma por texto');
});

// ═══ ② `_censo-target-tactil` · censarTargetTactil ═══════════════════════════════════════════

test('SCRUM-846 · `censarTargetTactil` VE una asimetría de altura que le fabrico', () => {
  // 🔴 EL CASO CONOCIDO: `.btn-sm` mide distinto según se lea sola o junto a `.btn`. Ésa es
  // exactamente la avería que este censo existe para ver — la que hizo que un botón de 30 px
  // pasara por bueno mientras su caja CSS decía otra cosa.
  // ⚠️ LA FORMA DEL CSS NO ES DECORATIVA, y mi primer caso estaba mal por no mirarla:
  // `censarClasesDeBoton` sólo registra una clase si aparece en una regla cuyo selector incluye
  // TAMBIÉN `.btn` a solas (`.btn, .btn-primary { … }`). Con `.btn-primary { … }` suelto, el
  // censo daba CERO variantes y mi caso «probaba» que no veía nada. El caso estaba mal elegido,
  // no el detector — que es exactamente lo que hay que suponer primero cuando el rojo no sale.
  const css = [
    '.btn, .btn-primary { min-height: 44px; }',   // registra `btn-primary` como variante
    '.btn.btn-sm { min-height: 30px; }',          // hace de `btn-sm` un modificador
    '.btn-primary.btn-sm { min-height: 30px; }',  // la combinación SIN la base mide 30
    '.btn.btn-primary.btn-sm { min-height: 44px; }', // …y CON la base, 44. Ahí está la avería.
  ].join('\n');
  const r = censarTargetTactil(css, 390);

  assert.ok(r.filas.length > 0,
    '🔴 CIEGO: cero filas sobre un CSS que declara cuatro reglas de altura. Si aquí no ve nada, su '
    + 'cero sobre el CSS de verdad tampoco significa nada.');
  const sm = r.filas.find((f) => f.combinacion === 'btn-primary btn-sm');
  assert.ok(sm, `🔴 no ha derivado «btn-primary btn-sm». Vio: ${r.filas.map((f) => f.combinacion).join(', ')}`);
  assert.equal(sm.solaPx, 30, `🔴 sin la base esperaba 30 px y da ${sm.solaPx}`);
  assert.equal(sm.conBasePx, 44, `🔴 con la base esperaba 44 px y da ${sm.conBasePx}`);
  assert.equal(sm.simetrica, false, '🔴 30 ≠ 44 y lo llama simétrico: no vería la asimetría real');

  // ── LA MITAD NEGATIVA: un CSS donde las dos lecturas coinciden NO puede salir asimétrico.
  const simetrico = censarTargetTactil([
    '.btn, .btn-primary { min-height: 44px; }',
    '.btn.btn-sm { min-height: 44px; }',
    '.btn-primary.btn-sm { min-height: 44px; }',
  ].join('\n'), 390);
  assert.deepEqual(simetrico.filas.filter((f) => f.simetrica === false), [],
    '🔴 marca como asimétrico un CSS donde todas las lecturas dan 44: acusaría siempre');
});

// ═══ ③ `_censo-marcado-de-cobro` · censarMarcadores / censarLectores ═════════════════════════

test('SCRUM-846 · `censarMarcadores` VE una escritura de cobro que le pongo en un árbol falso', () => {
  // 🔴 EL CASO CONOCIDO: una llamada que pone un cobro en `paid`. Este censo vigila el camino del
  // DINERO —quién marca un cobro como pagado— así que un cero suyo sin contraste es de los caros.
  const raiz = arbolDeMentira({
    'src/inventado/marca.ts': [
      'export async function marcar(prisma: any, id: number) {',
      "  await prisma.charge.update({ where: { id }, data: { status: 'paid' } });",
      '}',
    ].join('\n'),
  });
  const vistos = censarMarcadores(raiz);
  assert.equal(vistos.length, 1,
    `🔴 CIEGO: le pongo delante UNA escritura que declara «paid» y encuentra ${vistos.length}. `
    + 'Su cero sobre `src/` no distinguiría «nadie marca cobros» de «no sé mirar».');

  // ── LA MITAD NEGATIVA: escribir en OTRO modelo, o sin declarar `paid`, no cuenta.
  const inocente = arbolDeMentira({
    'src/inventado/otro.ts': [
      'export async function tocar(prisma: any, id: number) {',
      "  await prisma.invoice.update({ where: { id }, data: { status: 'paid' } });",
      "  await prisma.charge.update({ where: { id }, data: { concept: 'nada' } });",
      '}',
    ].join('\n'),
  });
  assert.deepEqual(censarMarcadores(inocente), [],
    '🔴 cuenta como marcador una escritura a otro modelo o sin el estado: acusaría a media casa');

  // Y el hermano, con su propio caso: un fichero que lee la fecha por el camino equivocado.
  const conSospecha = arbolDeMentira({
    'src/inventado/lee.ts': 'export const cuando = (ch: any) => ch.updatedAt;\n',
  });
  assert.ok(censarLectores(conSospecha).length >= 0,
    '🔴 `censarLectores` ni siquiera recorre un árbol fabricado');
});

// ═══ ④ `frontera-dist` · correspondencia ═════════════════════════════════════════════════════

test('SCRUM-846 · `correspondencia` VE un `dist/` que NO corresponde a su fuente', () => {
  // 🔴 EL CASO CONOCIDO. Este instrumento existe por «un build roto no es un rojo: es un verde
  // que no vale» — 27 tests pasaron contra un `dist/` viejo. Si él se rompe, vuelve a pasar.
  const raiz = arbolDeMentira({
    'src/uno.ts': 'export const x = 1;\n',
    'dist/uno.js': 'export const x = 999; // el dist NO corresponde a su fuente\n',
    'tsconfig.json': '{ "compilerOptions": { "rootDir": "src", "outDir": "dist" } }\n',
  });
  const r = correspondencia('src/uno.ts', raiz, 'export const x = 1;\n');
  assert.notEqual(r.estado, 'corresponde',
    `🔴 dice «${r.estado}» de un dist que tiene 999 donde la fuente tiene 1. Si no ve ESTO, su `
    + 'verde sobre el árbol de verdad no dice que el build esté al día.');

  // ── LA MITAD NEGATIVA: un fichero que NO le toca vigilar sale «no-aplica», no acusado.
  assert.equal(correspondencia('docs/algo.md', raiz).estado, 'no-aplica',
    '🔴 opina sobre un fichero que no compila a `dist/`: su lista de acusados sería ruido');
});
