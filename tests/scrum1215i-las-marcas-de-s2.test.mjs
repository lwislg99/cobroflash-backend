// SCRUM-1215i · LAS NUEVE HOJAS DE S2 QUE TENÍAN FIRMA Y NO LA CITABAN: AHORA LA LLEVAN EN SU LÍNEA.
//
// El censo de SCRUM-1157 acusaba seis hojas de tres ficheros de S2 y aprobaba otras tres «por
// grupo». Las nueve tienen firma escrita:
//
//   · `providersView.js · M.provider_in_use` y `M.taxId_invalido`  → orquestador por delegación,
//     SCRUM-1215 comentario 19084 (F1 y F2)
//   · `quoteDireccionObra.js · TEXTOS` (las cuatro)                 → la misma firma (F3)
//   · `jobDetailView.js · TEXTO_HUECO` (`sin-facturar`, `sin-facturar-nada`, `sin-cobrar`)
//                                                                   → fundador, docs/master/SCRUM-320.md
//
// Por qué las CUATRO de la dirección de la obra y no sólo la acusada: `personalizada` no salía
// acusada por no tener firma, sino por ser la cuarta bajo una cabecera que el censo leía como
// «tres» (SCRUM-1215 comentario 19088). La marca en la línea de cada una es lo que deja de
// depender del orden.
//
// Aquí no cambia ningún texto: lo que se fija es que la marca está, que es PROPIA (no de grupo),
// que el literal es el de su ficha, y —el control— que sin la marca la hoja vuelve a caer.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { aprobacionesDeMicrocopy } from './_microcopy-aprobada.mjs';
import { censar, censarFuente, leerDeclarados, compararConDeclarados } from '../scripts/_censo-convenio-microcopy.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

const PROVEEDORES = 'public/dashboard/js/providersView.js';
const DIRECCION = 'public/dashboard/js/quoteDireccionObra.js';
const TRABAJO = 'public/dashboard/js/jobDetailView.js';

/** Hoja → el fichero donde vive y un trozo ÚNICO de su línea, para encontrarla sin contar líneas. */
const HOJAS = [
  { id: `${PROVEEDORES} · M.provider_in_use`, rel: PROVEEDORES, ancla: 'provider_in_use: ' },
  { id: `${PROVEEDORES} · M.taxId_invalido`, rel: PROVEEDORES, ancla: 'taxId_invalido: ' },
  { id: `${DIRECCION} · TEXTOS.rotulo`, rel: DIRECCION, ancla: "rotulo: 'Dirección de la obra'" },
  { id: `${DIRECCION} · TEXTOS.noMostrar`, rel: DIRECCION, ancla: "noMostrar: 'No mostrar'" },
  { id: `${DIRECCION} · TEXTOS.facturacion`, rel: DIRECCION, ancla: "facturacion: 'Utilizar dirección de facturación'" },
  { id: `${DIRECCION} · TEXTOS.personalizada`, rel: DIRECCION, ancla: "personalizada: 'Personalizada'" },
  { id: `${TRABAJO} · TEXTO_HUECO.sin-facturar`, rel: TRABAJO, ancla: "'sin-facturar': (h) =>" },
  { id: `${TRABAJO} · TEXTO_HUECO.sin-facturar-nada`, rel: TRABAJO, ancla: "'sin-facturar-nada': (h) =>" },
  { id: `${TRABAJO} · TEXTO_HUECO.sin-cobrar`, rel: TRABAJO, ancla: "'sin-cobrar': (h) =>" },
];

/** La línea de una hoja en su fuente. Tiene que haber exactamente una. */
function lineaDe(fuente, ancla) {
  const l = fuente.split(/\r?\n/).filter((x) => x.includes(ancla));
  assert.equal(l.length, 1, `🔴 SUELO: «${ancla}» sale ${l.length} veces en su fichero y tenía que salir una`);
  return l[0];
}

/** El fuente con la marca de UNA línea quitada (todo lo que va detrás de `, //`). */
function sinLaMarca(fuente, ancla) {
  const linea = lineaDe(fuente, ancla);
  const corte = linea.indexOf(', //');
  assert.ok(corte > 0, `🔴 SUELO: la línea de «${ancla}» no lleva comentario detrás de la coma: no hay marca que quitar`);
  const mutada = linea.slice(0, corte + 1);
  assert.notEqual(mutada, linea);
  return fuente.replace(linea, mutada);
}

const hojaEn = (r, id) => r.hojas.find((h) => h.id === id);

test('SCRUM-1215i · SUELO: el censo mira, ve las nueve hojas y todavía sabe acusar', () => {
  const r = censar({ raiz: RAIZ });
  assert.equal(r.estado, 'OK', '🔴 CIEGO: el censo de SCRUM-1157 no ha podido mirar: ' + JSON.stringify(r.ciegos));
  for (const h of HOJAS) assert.ok(hojaEn(r, h.id), `🔴 SUELO: el censo no ve la hoja ${h.id}: lo de abajo no mediría nada`);
  assert.ok(r.acusadas.length > 0,
    '✅ el censo ya no acusa a nadie. Si es verdad, este control sobra: cámbialo por otro que demuestre que sabe acusar');
  assert.equal(hojaEn(r, `${PROVEEDORES} · M.noExisteEstaClave`), undefined, '🔴 SUELO: el censo da clase a una hoja que no existe');
});

test('SCRUM-1215i · 🔴 las nueve salen APROBADO por la marca de SU línea, no por una firma de grupo', () => {
  const r = censar({ raiz: RAIZ });
  assert.equal(r.estado, 'OK');
  for (const h of HOJAS) {
    const hoja = hojaEn(r, h.id);
    assert.equal(hoja.clase, 'APROBADO', `🔴 ${h.id} ya no cita su firma: el censo la acusa (${hoja.clase})`);
    assert.ok(!hoja.porGrupo,
      `🔴 ${h.id} sale aprobada POR GRUPO: ha perdido la marca de su línea y la salva la cabecera, que aprueba por posición (SCRUM-1215 comentario 19088)`);
    assert.match(lineaDe(leer(h.rel), h.ancla), /\/\/ APROBADO por .*SCRUM-1215 comentario 19084/,
      `🔴 la marca de ${h.id} no nombra el comentario que la firma (o que manda marcarla)`);
  }
});

test('SCRUM-1215i · 🔴 CONTROL: sin la marca, cada hoja vuelve a caer (o a depender del grupo)', () => {
  const ambiguos = leerDeclarados(RAIZ).ambiguos || {};
  for (const h of HOJAS) {
    const fuente = leer(h.rel);
    const antes = censarFuente(h.rel, fuente, ambiguos).hojas.find((x) => x.id === h.id);
    const despues = censarFuente(h.rel, sinLaMarca(fuente, h.ancla), ambiguos).hojas.find((x) => x.id === h.id);
    assert.ok(antes && despues, `🔴 SUELO: el censo de un solo fichero no ve ${h.id}`);
    assert.equal(antes.clase, 'APROBADO');
    assert.ok(despues.clase !== 'APROBADO' || despues.porGrupo,
      `🔴 ${h.id} sigue aprobada como propia SIN su marca: la marca no es lo que la aprueba, y este test no mide nada`);
  }
});

test('SCRUM-1215i · el trinquete del censo queda en cero: ni nuevas ni sobran', () => {
  const r = censar({ raiz: RAIZ });
  const c = compararConDeclarados(r, leerDeclarados(RAIZ));
  const cuenta = (x) => (Array.isArray(x) ? x.length : 0);
  const fuera = Object.entries(c).filter(([, v]) => Array.isArray(v) && v.length).map(([k, v]) => `${k}: ${v.length}`);
  assert.ok(Object.values(c).some((v) => Array.isArray(v)), '🔴 SUELO: `compararConDeclarados` ya no devuelve listas: este caso no mira nada');
  assert.equal(fuera.length, 0, '🔴 el censo y lo declarado no cuadran → ' + fuera.join(' · '));
  assert.equal(cuenta(c.nuevas), 0);
});

test('SCRUM-1215i · 🔴 lo firmado por delegación tiene ficha, y el literal del fuente es el de la ficha', () => {
  const fichas = aprobacionesDeMicrocopy();
  assert.ok(fichas.length > 100, '🔴 SUELO: el barrido de fichas ve muy pocas: no sabe mirar');
  const ficha = (ranura) => fichas.find((a) => a.ticket === 'SCRUM-1215' && a.ranura === ranura);

  const casos = [
    { ranura: 'proveedores-dos-fallos', rel: PROVEEDORES, literales: [
      'No se puede borrar el proveedor porque está asignado a uno o más productos.',
      'Ese NIF/CIF no es válido. Compruébalo.',
    ] },
    { ranura: 'direccion-de-la-obra', rel: DIRECCION, literales: [
      'Dirección de la obra', 'No mostrar', 'Utilizar dirección de facturación', 'Personalizada',
    ] },
  ];
  for (const c of casos) {
    const f = ficha(c.ranura);
    assert.ok(f, `🔴 la firma de SCRUM-1215 comentario 19084 no tiene ficha «${c.ranura}» en docs/microcopy/`);
    assert.ok(f.aprobada && f.firmante === 'orquestador' && f.delegacion,
      `🔴 la ficha «${c.ranura}» no lleva la firma delegada completa (README de docs/microcopy/, punto 3)`);
    const fuente = leer(c.rel);
    for (const lit of c.literales) {
      assert.ok(f.literales.includes(lit), `🔴 la ficha «${c.ranura}» no trae el literal «${lit}»`);
      assert.ok(fuente.includes(`'${lit}', // APROBADO por el orquestador por delegación del fundador`),
        `🔴 «${lit}» ya no está en ${c.rel} con su marca: o cambió el texto, o se le quitó la firma`);
    }
  }
});

test('SCRUM-1215i · los tres huecos del trabajo citan el registro donde el fundador los aprobó, y el registro los trae', () => {
  const registro = leer('docs/master/SCRUM-320.md');
  const fuente = leer(TRABAJO);
  const casos = [
    { ancla: "'sin-facturar': (h) =>", frase: 'entregados sin facturar' },
    { ancla: "'sin-facturar-nada': (h) =>", frase: 'aceptados y sin facturar' },
    { ancla: "'sin-cobrar': (h) =>", frase: 'facturados sin cobrar' },
  ];
  for (const c of casos) {
    const linea = lineaDe(fuente, c.ancla);
    assert.ok(linea.includes(`${c.frase}\`, // APROBADO por el fundador (docs/master/SCRUM-320.md`),
      `🔴 el hueco «${c.frase}» ya no pinta esa frase o ya no cita su firma`);
    assert.ok(registro.includes(c.frase), `🔴 docs/master/SCRUM-320.md ya no trae «${c.frase}»: la marca cita una firma que no se puede leer`);
  }
  assert.match(registro, /[Aa]probad[ao]s? por el fundador/, '🔴 SUELO: el registro de SCRUM-320 ya no dice quién aprobó');
});
