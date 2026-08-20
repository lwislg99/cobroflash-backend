// tests/scrum537-afirmacion-falsa.test.mjs — SCRUM-537
//
// Sin gate: lee ficheros. Ni BD, ni red, ni servidor.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA LINEA BASE, REPRODUCIDA ANTES DE ESCRIBIR NADA (20-ago-2026, contra `origin/main`)
//
// Se simulo `docs/legal/DECLARACION_RESPONSABLE.md` como EMITIDO y se metio el guion H2 en la
// landing. El guard de SCRUM-400 —12 tests, verdes— dio esto:
//
//     guion H2 + documento NO emitido (hoy) ....... 🔴 CAE
//     guion H2 + documento EMITIDO (mañana) ....... ✅ PASA
//     insignia + documento NO emitido (hoy) ....... 🔴 CAE
//     insignia + documento EMITIDO (mañana) ....... ✅ PASA
//
// O sea que el defecto es real: el dia que se emita ese documento (SCRUM-523, en cola), una
// afirmacion FALSA vuelve a la landing con el CI en verde. SCRUM-400 no esta mal — vigila otra
// cosa: afirmar SIN DOCUMENTO. Esto vigila afirmar algo FALSO. Hacen falta las dos.
//
// 🔴 SCRUM-400 NO SE TOCA. Sus 12 tests siguen exactamente igual: esto AÑADE, no mueve.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  afirmacionesFalsas, envioConstruido, comprobar, comprobarEnDisco, PAGINAS,
} from '../scripts/_guard-afirmacion-fiscal.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** El guion H2 (`YAQU_MASTER.md:214`), literal. Se cita para PROBAR que cae, no para publicarlo. */
const GUION_H2 = 'Te contesto como fabricante: la facturación VeriFactu está construida y en '
  + 'certificación — con declaración responsable del productor, que es lo que tu gestor te pedirá. '
  + 'Por ley no puedo activarla hasta cerrarla; por eso la beta es de presupuestos y cobros.';

/** La insignia que estuvo junto al heroe: CINCO palabras, sin citar ningun guion. */
const INSIGNIA = 'Facturación <b>VeriFactu en certificación</b>';

const pag = (html) => [{ ruta: 'public/index.html', html }];

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① EL DEFECTO · lo que SCRUM-400 deja pasar con el documento emitido, aqui CAE
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-537 · 🔴 el guion H2 CAE aunque el documento este emitido', () => {
  // Aqui no hay documento en la ecuacion, y ese es el cambio: la verdad de la frase no depende
  // de que exista un papel. `envioConstruido: false` es el estado medido hoy.
  const r = comprobar({ paginas: pag(`<p>${GUION_H2}</p>`), envioConstruido: false });
  assert.equal(r.ok, false,
    '🔴 EL GUION H2 PASA. Es el defecto entero de este ticket: SCRUM-400 lo deja pasar en cuanto '
    + 'se emita la declaracion responsable, y si esto tambien lo deja pasar, no hemos añadido nada.');
  assert.match(r.salida, /certificaci/i, '🔴 no NOMBRA la afirmacion: sin cita no se sabe que quitar');
  assert.match(r.salida, /familia A/, '🔴 no dice que la certificacion es falsa POR EL REGIMEN');
  assert.match(r.salida, /RD 1007\/2023|art\. 13/, '🔴 no da la fuente que lo desmiente');
});

test('SCRUM-537 · 🔴 la INSIGNIA cae, y son cinco palabras sin citar ningun guion', () => {
  // El caso que un guard de texto no caza: dice lo mismo sin parecerse a nada.
  const r = comprobar({ paginas: pag(`<div>${INSIGNIA}</div>`), envioConstruido: false });
  assert.equal(r.ok, false,
    '🔴 LA INSIGNIA PASA. Se vigila la AFIRMACION, no la CITA: si solo cazamos el guion H2 por su '
    + 'texto, cinco palabras junto al heroe dicen lo mismo y entran.');
  assert.match(r.salida, /VeriFactu en certificación/);
});

test('SCRUM-537 · la familia A no la salva NINGUN documento, y por eso no hay documento en la firma', () => {
  // `comprobar` ni siquiera acepta un documento: es imposible pasarle uno emitido para ablandarla.
  // La certificacion de VeriFactu no existe — no es que falte un papel, es que no hay tramite.
  const conEnvio = comprobar({ paginas: pag(`<div>${INSIGNIA}</div>`), envioConstruido: true });
  assert.equal(conEnvio.ok, false,
    '🔴 la familia A dejo de bloquear porque el envio existe. Son cosas distintas: que el envio se '
    + 'construya no crea un tramite de certificacion que el reglamento no contempla.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② CONTROL POSITIVO · «vigila bien» y «bloquea todo» dan el mismo rojo
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-537 · CONTROL POSITIVO: lo que HOY es verdad pasa en verde', () => {
  // Estas frases salen de la «verdad sostenible» de la skill `verifactu`, que es material ya
  // aprobado. Si el guard las bloqueara, obligaria a no poder decir nada cierto sobre VeriFactu
  // — y un guard que impide decir la verdad se desactiva, y entonces no protege de nada.
  const verdad = `
    <p>El producto genera el registro con el formato oficial de la AEAT, con huella encadenada y QR.</p>
    <p>La obligación de VeriFactu entra el 1 de julio de 2027 para autónomos.</p>
    <p>VeriFactu no exige certificación: el régimen es una declaración responsable del productor.</p>
    <p>Ninguna certificación de VeriFactu existe hoy; el art. 13 del RD 1007/2023 no la contempla.</p>`;
  const r = comprobar({ paginas: pag(verdad), envioConstruido: false });
  assert.equal(r.ok, true, `🔴 bloqueo una afirmacion VERDADERA:\n${r.salida}`);
});

test('SCRUM-537 · CONTROL POSITIVO: el copy legitimo de la landing no se toca', () => {
  const legitimo = `
    <p>Presupuestos y cobros por WhatsApp, sin permanencia.</p>
    <p>YaQu actúa como encargado del tratamiento conforme a nuestra Política de Privacidad.</p>
    <p>Se conservan durante el plazo legal, conforme al artículo 30 del Código de Comercio.</p>`;
  assert.equal(comprobar({ paginas: pag(legitimo), envioConstruido: false }).ok, true,
    '🔴 bloqueo copy que no afirma nada fiscal sobre nosotros');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ LA FAMILIA B CADUCA SOLA · lo que evita que este guard haya que desactivarlo
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-537 · «está construida» cae HOY y deja de caer el dia que el envio exista', () => {
  const frase = '<p>La facturación VeriFactu ya está construida.</p>';

  const hoy = comprobar({ paginas: pag(frase), envioConstruido: false });
  assert.equal(hoy.ok, false, '🔴 no caza «ya está construida» con el envio sin construir');
  assert.match(hoy.salida, /familia B/);
  assert.match(hoy.salida, /envio a la AEAT NO existe/i);

  // 🔴 EL OTRO SENTIDO, que es el que distingue vigilar el HECHO de vigilar la PALABRA: cuando
  // el envio se construya, esta frase sera VERDAD y el guard tiene que dejarla pasar SOLO, sin
  // que nadie venga a desactivar nada. Si no, el dia que SIF-1 cierre habra que apagar esto.
  const mañana = comprobar({ paginas: pag(frase), envioConstruido: true });
  assert.equal(mañana.ok, true,
    '🔴 sigue bloqueando con el envio YA CONSTRUIDO: entonces no vigila el hecho, vigila la '
    + 'palabra, y habra que desactivarlo — que es como mueren los guards.');
});

test('SCRUM-537 · el hecho se DERIVA del codigo, y hoy el envio NO existe', () => {
  const h = envioConstruido(RAIZ);

  // SUELO del propio detector: si no ve NI SIQUIERA la URL del QR, no esta leyendo `src/` y su
  // «no hay envio» es ceguera. Y esa ceguera muerde en las dos direcciones: mantendria bloqueada
  // la familia B el dia que el envio SI exista.
  assert.ok(h.vistosAeat >= 1,
    '🔴 CIEGO: el barrido no encuentra ni una mencion de un host de la AEAT en `src/`, y la URL '
    + 'del QR esta ahi desde S1-A. No esta leyendo el codigo: su veredicto no vale.');
  assert.ok(h.esquemaLeido, '🔴 CIEGO: no se pudo leer `prisma/schema.prisma`');

  assert.equal(h.construido, false,
    '🔴 EL ENVIO A LA AEAT APARECE COMO CONSTRUIDO. Si es verdad, enhorabuena y hay que revisar '
    + `este guard y el guion H2 entero. Señales: ${JSON.stringify(h.señales)}`);
});

test('SCRUM-537 · lo que se EMITE no cuenta como envio: el QR y los espacios de nombres', () => {
  // 🔴 LAS DOS TRAMPAS DE ESTA MEDICION, y las dos salieron midiendo, no razonando. `src/`
  //   menciona hosts de la AEAT en CINCO sitios y NINGUNO es una llamada:
  //     · `buildVeriFactuQrUrl` construye la direccion del QR para IMPRIMIRLA en la factura,
  //       que es lo que el cliente usa para comprobar;
  //     · `registro.builder.ts` declara `NS_LR` y `NS_SF`, que son IDENTIFICADORES del XML —
  //       un espacio de nombres no se descarga jamas.
  //   La primera version de este predicado conto los dos ultimos y dio «envio construido» HOY,
  //   con lo que la familia B habria dejado de bloquear justo cuando mas falta hace. El patron
  //   comun: son cadenas que EMITIMOS, no puntos con los que HABLAMOS.
  const h = envioConstruido(RAIZ);
  assert.ok(h.vistosAeat >= 3,
    `🔴 solo ve ${h.vistosAeat} menciones de la AEAT en src/: sin verlas, este control no prueba nada`);
  assert.deepEqual(h.señales, [],
    `🔴 algo que solo se EMITE se conto como envio: ${JSON.stringify(h.señales)}. Con esto, el `
    + 'guard dejaria de bloquear «esta construida» sin que nadie haya construido nada.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ SUELO · «pagina limpia» y «no supe leer» no pueden dar el mismo verde
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-537 · 🔴 SUELO: sin pagina legible NO es un verde', () => {
  const r = comprobar({ paginas: pag(null), envioConstruido: false });
  assert.equal(r.ok, false,
    '🔴 aprobo sin haber leido ninguna pagina. Un cero de afirmaciones sobre una pagina que no '
    + 'se pudo abrir se lee como «landing limpia», y significa lo contrario.');
  assert.match(r.salida, /SUELO/);
});

test('SCRUM-537 · 🔴 SUELO: el detector SABE ver, probado sobre corpus conocido', () => {
  // 🔴 EL SUELO NO PUEDE SER «la landing tiene cero afirmaciones = ciego», porque HOY la landing
  // esta legitimamente limpia (SCRUM-400 retiro las dos) y eso la pondria roja para siempre. Lo
  // que se exige es que el detector VEA cuando hay algo que ver: se le dan los dos casos reales
  // y tiene que encontrarlos, y ademas se comprueba que las paginas se leyeron de verdad.
  const vistas = afirmacionesFalsas(`<p>${GUION_H2}</p><div>${INSIGNIA}</div>`, { envioConstruido: false });
  assert.ok(vistas.length >= 2,
    `🔴 CIEGO: solo ve ${vistas.length} afirmaciones en un corpus que tiene las dos que se `
    + 'retiraron. Si no ve estas, su verde sobre la landing no significa nada.');

  const r = comprobarEnDisco(RAIZ);
  assert.ok(r.paginasLeidas === PAGINAS.length,
    `🔴 solo se leyeron ${r.paginasLeidas} de ${PAGINAS.length} paginas publicas`);
  assert.ok(r.caracteres > 5000,
    `🔴 las paginas suman ${r.caracteres} caracteres visibles: no se esta leyendo la landing`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ⑤ EL ESTADO REAL DEL REPO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-537 · el repo REAL pasa este guard hoy', () => {
  const r = comprobarEnDisco(RAIZ);
  assert.equal(r.ok, true, `🔴 la superficie publica afirma algo falso:\n${r.salida}`);
});

test('SCRUM-537 · y SCRUM-400 sigue existiendo: esto añade, no sustituye', () => {
  // Si alguien borra el guard de la conjuncion pensando que este lo reemplaza, se pierde la
  // proteccion de «afirmar conformidad sin documento», que es OTRA cosa y sigue haciendo falta.
  const otro = path.join(RAIZ, 'tests', 'scrum400-conformidad-landing.test.mjs');
  assert.ok(fs.existsSync(otro),
    '🔴 ha desaparecido `scrum400-conformidad-landing.test.mjs`. Este guard NO lo reemplaza: '
    + 'aquel vigila afirmar SIN DOCUMENTO y este afirmar algo FALSO. Se necesitan los dos.');
  const fuente = fs.readFileSync(otro, 'utf8');
  assert.match(fuente, /con el documento EMITIDO, la misma frase PASA/,
    '🔴 ha cambiado el test que fija la conjuncion de SCRUM-400. Si se ha movido a proposito, '
    + 'revisa si este guard sigue cubriendo el hueco que dejaba.');
});
