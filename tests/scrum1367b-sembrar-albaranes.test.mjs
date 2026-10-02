// tests/scrum1367b-sembrar-albaranes.test.mjs — SCRUM-1367b
//
// Los dos casos de ALBARÁN que le faltan a la cuenta QA (diez fotos; firmado), probados SIN RED: un
// panel falso con estado que apunta cada llamada. NADA de esto se ha ejecutado contra producción:
// aquí se mide la CAPACIDAD y sus cerrojos, cada uno con su control.
//   · el de CUENTA: si el servidor no dice merchant 46 + owner, ninguna orden escribe;
//   · el de LISTA: lo único que se añade es subir una foto y firmar;
//   · ninguna orden factura, cobra ni envía;
//   · repetir una orden no crea, no emite, no sube y no firma otra vez;
//   · lo que no se pudo ver al RELEER se dice (sale 1, no 0).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { temporal, borrarTemporal } from './_temporal.mjs'; // SCRUM-864 · se borra pase lo que pase
import {
  ejecutar, escrituraDeAlbaranPermitida, ESCRITURAS_DE_ALBARAN, FOTOS_POR_ALBARAN, FOTOS_QA, FIRMA_QA,
  FIRMANTE_QA, LINEAS_QA, claveAlbaranFotos, claveAlbaranFirmado, pngLiso,
} from '../scripts/qa/sembrar-albaranes.mjs';
import { MERCHANT_QA, TITULO_TRABAJO_QA, PROHIBIDAS, claveAlbaranQA, escrituraPermitida } from '../scripts/qa/sembrar-qa.mjs';
import { Rechazo } from '../scripts/qa/sesion-panel.mjs';
// Las reglas DE VERDAD del servidor (lección de SCRUM-1268c): un panel de mentira que dice que sí a
// todo prueba el guion contra sí mismo.
import { validarLineas, canTransitionAlbaran } from '../dist/modules/jobs/domain/albaran.service.js';
import { exigirNombreFirmante, resolverCalidadFirmante } from '../dist/modules/jobs/domain/albaranFirmante.js';
import { fotoYaSubida } from '../dist/modules/jobs/domain/fotoDuplicada.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// El rojo, declarado: lo ejecuta `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Sin la lista: cualquier escritura no prohibida saldría por la puerta de los albaranes.
    fichero: 'scripts/qa/sembrar-albaranes.mjs',
    de: '  if (!ESCRITURAS_DE_ALBARAN.some(([mm, re]) => mm === m && re.test(u.pathname))) {',
    a: '  if (false) {',
    cae: 'SCRUM-1367b · 🔴 LISTA: lo único que se añade es subir una foto y firmar; lo demás se rechaza antes de la red',
  },
  {
    // Sin la relectura: unas subidas que el servidor se comió saldrían como «diez fotos».
    fichero: 'scripts/qa/sembrar-albaranes.mjs',
    de: '  if (despues !== FOTOS_POR_ALBARAN) {',
    a: '  if (false) {',
    cae: 'SCRUM-1367b · ⑤ 🔴 las fotos se RELEEN: si el servidor se las comió, sale 1 y dice cuántas hay',
  },
  {
    // Sin parar en el tope: se mandan fotos que el servidor rechaza, y el caso completo sale 1.
    fichero: 'scripts/qa/sembrar-albaranes.mjs',
    de: '    if (hay >= FOTOS_POR_ALBARAN) break;',
    a: '    if (false) break;',
    cae: 'SCRUM-1367b · ⑤ con plazas ya ocupadas sube sólo las que caben y no manda ninguna que el servidor rechace',
  },
  {
    // Firmar con el perfil fiscal vacío: un albarán que dejará de verificar.
    fichero: 'scripts/qa/sembrar-albaranes.mjs',
    de: '  if (vacios.length) {',
    a: '  if (false) {',
    cae: 'SCRUM-1367b · ⑥ 🔴 con el perfil fiscal vacío NO firma: sale 1 sin escribir nada',
  },
  {
    // Firmar otra vez lo ya firmado: la orden dejaría de ser repetible.
    fichero: 'scripts/qa/sembrar-albaranes.mjs',
    de: "  if (caso.albaran.estado !== 'firmado') {",
    a: '  if (true) {',
    cae: 'SCRUM-1367b · ⑥ repetir «firmado» no crea, no emite y no firma otra vez',
  },
];

const COOKIE = 'pf_session=tok1367babcdef';
const ID_TRABAJO_QA = 76;
const PERFIL_PUESTO = { legalName: 'PRUEBAS QA YAQU - NO ES UNA EMPRESA REAL', taxId: 'B00000000' };

function resp(status, cuerpo) {
  return { status, headers: new Headers(), text: async () => (cuerpo === undefined ? '' : JSON.stringify(cuerpo)) };
}

/**
 * Un panel falso con estado, que ARRANCA con el sembrado base hecho (el Trabajo QA). Las formas y
 * las reglas son las de `src/` leídas el 2-oct-2026: el alta de albarán es idempotente por clave y
 * valida las líneas; emitir y firmar siguen `canTransitionAlbaran`; subir una foto repetida devuelve
 * la primera (`fotoYaSubida`) y la undécima es un 409; un firmado no admite fotos.
 */
function panel({
  me = { merchantId: MERCHANT_QA, isOwner: true, merchantName: 'PruebaQA' },
  merchant = PERFIL_PUESTO, sinBase = false, fotosAjenas = 0, pierdeFotos = false, falla500EnLaSubida = 0,
} = {}) {
  const s = {
    trabajos: sinBase ? [] : [{ id: ID_TRABAJO_QA, tituloPropio: TITULO_TRABAJO_QA }],
    albaranes: [],
    fotos: new Map(), // id de albarán → [{ id, data }]
    merchant: { name: 'PruebaQA', legalName: null, taxId: null, ...merchant },
  };
  let id = 500;
  let subidasVistas = 0;
  const llamadas = [];
  const fotosDe = (albaranId) => { if (!s.fotos.has(albaranId)) s.fotos.set(albaranId, []); return s.fotos.get(albaranId); };
  const cara = (a) => ({ id: a.id, jobId: a.jobId, numero: a.numero, estado: a.estado, lineas: a.lineas, notas: a.notas, firmadoPorNombre: a.firmadoPorNombre ?? null });
  const fetchFn = async (url, init = {}) => {
    const u = new URL(url);
    const m = init.method || 'GET';
    const clave = `${m} ${u.pathname}`;
    const cuerpo = init.body ? JSON.parse(init.body) : null;
    llamadas.push({ m, ruta: u.pathname + u.search, cuerpo, cookie: init.headers && init.headers.cookie });
    if (clave === 'GET /admin/me') return resp(200, me);
    if (clave === 'GET /admin/jobs') return resp(200, s.trabajos);
    if (clave === 'GET /admin/merchant') return resp(200, s.merchant);
    let r = u.pathname.match(/^\/admin\/jobs\/(\d+)\/albaranes$/);
    if (r && m === 'POST') {
      const ya = s.albaranes.find((a) => a.clave === cuerpo.claveIdempotencia);
      if (ya) return resp(200, { ...cara(ya), idempotencia: 'repetida' });
      const v = validarLineas(cuerpo.lineas, 'SIN_VALORAR');
      if (!v.ok) return resp(400, { error: 'lineas_invalidas', message: v.error });
      const a = { id: ++id, jobId: Number(r[1]), numero: null, estado: 'borrador', lineas: v.lineas, notas: cuerpo.notas ?? null, clave: cuerpo.claveIdempotencia };
      s.albaranes.push(a);
      // Fotos que ya tenía alguien puestas (otra mano): ocupan plaza y no son las nuestras.
      for (let i = 0; i < fotosAjenas; i++) fotosDe(a.id).push({ id: ++id, data: Buffer.from(`foto-ajena-${i}`) });
      return resp(201, { ...cara(a), idempotencia: 'aplicada' });
    }
    r = u.pathname.match(/^\/admin\/albaranes\/(\d+)(?:\/(emitir|firmar|fotos))?$/);
    if (r) {
      const a = s.albaranes.find((x) => x.id === Number(r[1]));
      if (!a) return resp(404, { error: 'not_found' });
      const que = r[2];
      if (!que && m === 'GET') return resp(200, cara(a));
      if (que === 'emitir' && m === 'POST') {
        if (!canTransitionAlbaran(a.estado, 'emitido')) return resp(409, { error: 'invalid_transition' });
        a.estado = 'emitido'; a.numero = `ALB-QA-${a.id}`;
        return resp(200, cara(a));
      }
      if (que === 'firmar' && m === 'POST') {
        if (a.estado === 'firmado') return resp(409, { error: 'albaran_locked' });
        if (!canTransitionAlbaran(a.estado, 'firmado')) return resp(409, { error: 'invalid_transition' });
        if (!/^data:image\/(png|jpeg);base64,/.test(String(cuerpo.signatureData || ''))) return resp(400, { error: 'firma_invalida' });
        const calidad = resolverCalidadFirmante({ ranura: cuerpo.firmadoPorCalidad, textoLibre: cuerpo.firmadoPorCalidadOtro });
        if (!calidad.ok) return resp(400, { error: calidad.error });
        const nombre = exigirNombreFirmante(cuerpo.firmadoPorNombre);
        if (!nombre.ok) return resp(400, { error: nombre.error });
        a.estado = 'firmado'; a.firmadoPorNombre = nombre.nombre;
        return resp(200, cara(a));
      }
      if (que === 'fotos' && m === 'GET') return resp(200, fotosDe(a.id).map((f) => ({ id: f.id, mime: 'image/png' })));
      if (que === 'fotos' && m === 'POST') {
        subidasVistas++;
        if (falla500EnLaSubida && subidasVistas === falla500EnLaSubida) return resp(500, { error: 'internal_error' });
        if (a.estado === 'firmado') return resp(409, { error: 'albaran_locked' });
        if (cuerpo.mime !== 'image/png') return resp(415, { error: 'mime_no_permitido' });
        const buffer = Buffer.from(String(cuerpo.data || ''), 'base64');
        if (!buffer.length) return resp(400, { error: 'foto_vacia' });
        const repetida = fotoYaSubida(buffer, fotosDe(a.id));
        if (repetida !== null) return resp(200, { ok: true, already: true, attachmentId: repetida });
        if (fotosDe(a.id).length >= 10) return resp(409, { error: 'max_fotos' });
        const f = { id: ++id, data: buffer };
        if (!pierdeFotos) fotosDe(a.id).push(f);
        return resp(201, { ok: true, attachmentId: f.id });
      }
    }
    return resp(404, { error: `ruta no simulada: ${clave}` });
  };
  return { fetchFn, llamadas, s, fotosDe };
}

/** Banco: la sesión en un temporal, y la orden contra el panel falso. */
function banco(opciones = {}, { sinSesion = false } = {}) {
  const dir = temporal('scrum1367b-');
  const rutaSesion = path.join(dir, 'sesion.txt');
  if (!sinSesion) fs.writeFileSync(rutaSesion, COOKIE + '\n');
  const p = panel(opciones);
  const out = [];
  const err = [];
  const correr = (argv) => {
    out.length = 0; err.length = 0;
    return ejecutar(argv, { fetchFn: p.fetchFn, rutaSesion, out: (x) => out.push(x), err: (x) => err.push(x) });
  };
  const escrituras = () => p.llamadas.filter((l) => l.m !== 'GET');
  const de = (sufijo) => escrituras().filter((l) => l.ruta.endsWith(sufijo));
  return { ...p, out, err, correr, escrituras, de, todo: () => [...out, ...err].join('\n'), limpiar: () => borrarTemporal(dir) };
}

test('SCRUM-1367b · 🔴 CUENTA: si el servidor no dice merchant 46 y owner, ninguna orden escribe', async () => {
  const casos = [
    { merchantId: 987654, isOwner: true, merchantName: 'Otra cuenta inventada' },
    { merchantId: MERCHANT_QA, isOwner: false, merchantName: 'PruebaQA' },
  ];
  for (const me of casos) {
    for (const orden of ['diez-fotos', 'firmado']) {
      const b = banco({ me });
      try {
        assert.equal(await b.correr([orden]), 3, `${orden} con ${JSON.stringify(me)}: ${b.todo()}`);
        assert.equal(b.escrituras().length, 0, `${orden}: escribió en una cuenta que no es la QA`);
        assert.match(b.err.join('\n'), /NO ES LA CUENTA QA/);
      } finally { b.limpiar(); }
    }
  }
});

test('SCRUM-1367b · 🔴 LISTA: lo único que se añade es subir una foto y firmar; lo demás se rechaza antes de la red', () => {
  assert.equal(ESCRITURAS_DE_ALBARAN.length, 2);
  assert.equal(escrituraDeAlbaranPermitida('POST', '/admin/albaranes/7/fotos').pathname, '/admin/albaranes/7/fotos');
  assert.equal(escrituraDeAlbaranPermitida('POST', '/admin/albaranes/7/firmar').pathname, '/admin/albaranes/7/firmar');
  const fuera = [
    ['POST', '/admin/albaranes/7/enviar-whatsapp'],
    ['POST', '/admin/albaranes/7/enviar-para-firmar'],
    ['POST', '/admin/albaranes/7/convertir-en-factura'],
    ['POST', '/admin/albaranes/7/facturar-parcial'],
    ['POST', '/admin/albaranes/7/duplicar'],
    ['POST', '/admin/albaranes/consolidar'],
    ['PATCH', '/admin/albaranes/7'],
    ['DELETE', '/admin/albaranes/7/fotos'],
    ['PUT', '/admin/albaranes/7/firmar'],
    ['POST', '/admin/albaranes/7/firmar?x=1'],
    ['POST', '/admin/albaranes/7/firmar/../emitir'],
    ['POST', '/admin/partes/7/firmar'],
    ['POST', '/admin/invoices'],
    ['POST', '/auth/logout'],
  ];
  for (const [m, ruta] of fuera) assert.throws(() => escrituraDeAlbaranPermitida(m, ruta), Rechazo, `${m} ${ruta}`);
  // Control: son AÑADIDAS de verdad — la lista de `sembrar-qa.mjs` no deja ni subir fotos ni firmar.
  assert.throws(() => escrituraPermitida('POST', '/admin/albaranes/7/fotos'), Rechazo);
  assert.throws(() => escrituraPermitida('POST', '/admin/albaranes/7/firmar'), Rechazo);
});

test('SCRUM-1367b · ⑤ «diez-fotos» desde el sembrado base: un albarán con líneas, emitido UNA vez, y diez fotos al releer', async () => {
  const b = banco();
  try {
    assert.equal(await b.correr(['diez-fotos']), 0, b.todo());
    const altas = b.de(`/admin/jobs/${ID_TRABAJO_QA}/albaranes`);
    assert.equal(altas.length, 1);
    assert.equal(altas[0].cuerpo.claveIdempotencia, claveAlbaranFotos(ID_TRABAJO_QA));
    assert.deepEqual(altas[0].cuerpo.lineas, LINEAS_QA);
    assert.equal(b.de('/emitir').length, 1);
    assert.equal(b.de('/fotos').length, FOTOS_POR_ALBARAN);
    const [a] = b.s.albaranes;
    assert.equal(a.estado, 'emitido', 'el albarán de las fotos NO se firma');
    assert.equal(b.fotosDe(a.id).length, 10);
    assert.deepEqual(a.lineas.map((l) => l.cantidad), LINEAS_QA.map((l) => l.cantidad), 'las líneas pasaron por el validador de verdad');
    assert.match(b.out.join('\n'), /había 0 · subidas ahora 10 · ya estaban \(no ocupan plaza\) 0 · al RELEER hay 10/);
    for (const l of b.escrituras()) {
      assert.equal(PROHIBIDAS.some((re) => re.test(l.ruta)), false, `salió una escritura prohibida: ${l.m} ${l.ruta}`);
      assert.equal(l.cookie, COOKIE);
    }
    assert.equal(b.de('/firmar').length, 0);
  } finally { b.limpiar(); }
});

test('SCRUM-1367b · ⑤ repetir «diez-fotos» no crea, no emite y no sube ninguna foto', async () => {
  const b = banco();
  try {
    assert.equal(await b.correr(['diez-fotos']), 0, b.todo());
    b.llamadas.length = 0;
    assert.equal(await b.correr(['diez-fotos']), 0, b.todo());
    assert.equal(b.s.albaranes.length, 1, 'la segunda pasada creó otro albarán');
    assert.equal(b.de('/emitir').length, 0, 'emitió otra vez: gasta un número ALB');
    assert.equal(b.de('/fotos').length, 0);
    assert.match(b.out.join('\n'), /ya estaba · ya estaba emitido \(no se repite\)/);
    assert.match(b.out.join('\n'), /había 10 · subidas ahora 0/);
  } finally { b.limpiar(); }
});

test('SCRUM-1367b · ⑤ con plazas ya ocupadas sube sólo las que caben y no manda ninguna que el servidor rechace', async () => {
  const b = banco({ fotosAjenas: 4 });
  try {
    assert.equal(await b.correr(['diez-fotos']), 0, b.todo());
    assert.equal(b.de('/fotos').length, 6);
    assert.match(b.out.join('\n'), /había 4 · subidas ahora 6 · .* al RELEER hay 10/);
  } finally { b.limpiar(); }
});

test('SCRUM-1367b · ⑤ una subida a medias se dice (sale 1) y la orden siguiente la completa sin duplicar', async () => {
  const b = banco({ falla500EnLaSubida: 4 });
  try {
    assert.equal(await b.correr(['diez-fotos']), 1);
    assert.match(b.err.join('\n'), /NO PUDE: POST \/admin\/albaranes\/\d+\/fotos → 500/);
    const [a] = b.s.albaranes;
    assert.equal(b.fotosDe(a.id).length, 3, 'control: quedaron tres subidas');
    b.llamadas.length = 0;
    assert.equal(await b.correr(['diez-fotos']), 0, b.todo());
    assert.equal(b.fotosDe(a.id).length, 10);
    // Las tres que ya estaban las reconoce el servidor por sus bytes (`fotoYaSubida`, el de verdad).
    assert.match(b.out.join('\n'), /había 3 · subidas ahora 7 · ya estaban \(no ocupan plaza\) 3 · al RELEER hay 10/);
    assert.equal(new Set(b.fotosDe(a.id).map((f) => f.data.toString('base64'))).size, 10, 'hay fotos repetidas');
  } finally { b.limpiar(); }
});

test('SCRUM-1367b · ⑤ 🔴 las fotos se RELEEN: si el servidor se las comió, sale 1 y dice cuántas hay', async () => {
  const b = banco({ pierdeFotos: true });
  try {
    assert.equal(await b.correr(['diez-fotos']), 1);
    assert.match(b.err.join('\n'), /tiene 0 fotos al releer y hacen falta exactamente 10\. El caso NO está completo/);
    assert.deepEqual(b.out, [], 'un caso incompleto no escribe por stdout como si estuviera hecho');
  } finally { b.limpiar(); }
});

test('SCRUM-1367b · ⑤ si el albarán de las fotos está FIRMADO, sale 1 y no intenta subir nada', async () => {
  const b = banco();
  try {
    assert.equal(await b.correr(['diez-fotos']), 0, b.todo());
    b.s.albaranes[0].estado = 'firmado'; // alguien lo firmó a mano
    b.llamadas.length = 0;
    assert.equal(await b.correr(['diez-fotos']), 1);
    assert.match(b.err.join('\n'), /está FIRMADO: congelado, ya no admite fotos/);
    assert.equal(b.de('/fotos').length, 0);
    assert.equal(b.de('/emitir').length, 0);
  } finally { b.limpiar(); }
});

test('SCRUM-1367b · ⑥ 🔴 con el perfil fiscal vacío NO firma: sale 1 sin escribir nada', async () => {
  for (const merchant of [{ legalName: null, taxId: null }, { legalName: 'PRUEBAS QA', taxId: '  ' }, { legalName: '', taxId: 'B00000000' }]) {
    const b = banco({ merchant });
    try {
      assert.equal(await b.correr(['firmado']), 1, JSON.stringify(merchant));
      assert.match(b.err.join('\n'), /entra en el hash de la firma/);
      assert.match(b.err.join('\n'), /sembrar-casos\.mjs perfil-fiscal/);
      assert.equal(b.escrituras().length, 0, 'creó o emitió un albarán que no iba a poder firmar');
    } finally { b.limpiar(); }
  }
});

test('SCRUM-1367b · ⑥ «firmado»: SU albarán, emitido y firmado con la firma y el firmante de prueba, visto al releer', async () => {
  const b = banco();
  try {
    assert.equal(await b.correr(['firmado']), 0, b.todo());
    assert.equal(b.de(`/admin/jobs/${ID_TRABAJO_QA}/albaranes`)[0].cuerpo.claveIdempotencia, claveAlbaranFirmado(ID_TRABAJO_QA));
    assert.equal(b.de('/emitir').length, 1);
    const firmas = b.de('/firmar');
    assert.equal(firmas.length, 1);
    assert.deepEqual(firmas[0].cuerpo, { signatureData: FIRMA_QA, firmadoPorNombre: FIRMANTE_QA });
    const [a] = b.s.albaranes;
    assert.equal(a.estado, 'firmado');
    assert.equal(a.firmadoPorNombre, FIRMANTE_QA, 'el nombre pasó por `exigirNombreFirmante` y quedó igual');
    assert.match(b.out.join('\n'), /FIRMADO ahora · firmante al releer: «FIRMA DE PRUEBA QA - NO ES UN CLIENTE REAL»/);
    assert.match(b.out.join('\n'), /queda CONGELADO/);
    for (const l of b.escrituras()) assert.equal(PROHIBIDAS.some((re) => re.test(l.ruta)), false, `escritura prohibida: ${l.m} ${l.ruta}`);
    assert.equal(b.de('/fotos').length, 0);
  } finally { b.limpiar(); }
});

test('SCRUM-1367b · ⑥ repetir «firmado» no crea, no emite y no firma otra vez', async () => {
  const b = banco();
  try {
    assert.equal(await b.correr(['firmado']), 0, b.todo());
    b.llamadas.length = 0;
    assert.equal(await b.correr(['firmado']), 0, b.todo());
    assert.equal(b.s.albaranes.length, 1);
    assert.equal(b.de('/emitir').length, 0);
    assert.equal(b.de('/firmar').length, 0);
    assert.match(b.out.join('\n'), /ya estaba firmado \(no se repite\)/);
  } finally { b.limpiar(); }
});

test('SCRUM-1367b · ⑥ si lo firmó otra mano, lo dice en vez de darlo por suyo', async () => {
  const b = banco();
  try {
    assert.equal(await b.correr(['firmado']), 0, b.todo());
    b.s.albaranes[0].firmadoPorNombre = 'Otra Persona';
    assert.equal(await b.correr(['firmado']), 0, b.todo());
    assert.match(b.out.join('\n'), /el firmante NO es el de prueba/);
  } finally { b.limpiar(); }
});

test('SCRUM-1367b · los dos casos y el sembrado base usan TRES albaranes distintos', async () => {
  const claves = new Set([claveAlbaranFotos(ID_TRABAJO_QA), claveAlbaranFirmado(ID_TRABAJO_QA), claveAlbaranQA(ID_TRABAJO_QA)]);
  assert.equal(claves.size, 3);
  const b = banco();
  try {
    assert.equal(await b.correr(['diez-fotos']), 0, b.todo());
    assert.equal(await b.correr(['firmado']), 0, b.todo());
    assert.equal(b.s.albaranes.length, 2);
    assert.deepEqual(b.s.albaranes.map((a) => a.estado), ['emitido', 'firmado']);
    assert.equal(b.fotosDe(b.s.albaranes[1].id).length, 0, 'el firmado no lleva las fotos del otro');
  } finally { b.limpiar(); }
});

test('SCRUM-1367b · sin el sembrado base sale 1 y dice qué correr antes; sin sesión, CIEGO; uso malo, 3', async () => {
  const sinBase = banco({ sinBase: true });
  try {
    assert.equal(await sinBase.correr(['diez-fotos']), 1);
    assert.match(sinBase.err.join('\n'), /sembrar-qa\.mjs sembrar/);
    assert.equal(sinBase.escrituras().length, 0);
  } finally { sinBase.limpiar(); }

  const ciego = banco({}, { sinSesion: true });
  try {
    assert.equal(await ciego.correr(['firmado']), 2);
    assert.match(ciego.err.join('\n'), /^CIEGO/);
    assert.equal(ciego.llamadas.length, 0);
  } finally { ciego.limpiar(); }

  const uso = banco();
  try {
    assert.equal(await uso.correr(['facturar']), 3);
    assert.equal(await uso.correr(['firmado', '--otra-vez']), 3);
    assert.equal(await uso.correr([]), 3);
    assert.equal(uso.llamadas.length, 0);
  } finally { uso.limpiar(); }
});

test('SCRUM-1367b · las diez fotos y la firma son PNG de verdad, distintas entre sí y dentro de los topes del servidor', () => {
  assert.equal(FOTOS_QA.length, 10);
  assert.equal(new Set(FOTOS_QA.map((f) => crypto.createHash('sha256').update(f).digest('hex'))).size, 10, 'hay dos fotos iguales: el servidor las deduplicaría');
  const firma = Buffer.from(FIRMA_QA.replace(/^data:image\/png;base64,/, ''), 'base64');
  assert.match(FIRMA_QA, /^data:image\/(png|jpeg);base64,/);
  for (const [nombre, png, lado] of [['foto 1', FOTOS_QA[0], 16], ['foto 10', FOTOS_QA[9], 16], ['firma', firma, 32]]) {
    assert.deepEqual([...png.subarray(0, 8)], [...Buffer.from('89504e470d0a1a0a', 'hex')], `${nombre}: no empieza como un PNG`);
    // Se recorre trozo a trozo comprobando el CRC con el de `zlib`, no con el del propio script.
    const trozos = {};
    for (let i = 8; i < png.length;) {
      const largo = png.readUInt32BE(i);
      const tipo = png.subarray(i + 4, i + 8).toString('ascii');
      assert.equal(png.readUInt32BE(i + 8 + largo), zlib.crc32(png.subarray(i + 4, i + 8 + largo)), `${nombre}: CRC de ${tipo}`);
      trozos[tipo] = png.subarray(i + 8, i + 8 + largo);
      i += 12 + largo;
    }
    assert.deepEqual(Object.keys(trozos), ['IHDR', 'IDAT', 'IEND'], nombre);
    assert.equal(trozos.IHDR.readUInt32BE(0), lado);
    assert.equal(trozos.IHDR.readUInt32BE(4), lado);
    assert.equal(zlib.inflateSync(trozos.IDAT).length, lado * (1 + lado * 3), `${nombre}: los píxeles no cuadran con su tamaño`);
  }
  assert.notDeepEqual(pngLiso(1, 2, 3), pngLiso(3, 2, 1));
});

test('SCRUM-1367b · los topes del instrumento son los del servidor: diez fotos, PNG admitido, firma y foto por debajo del máximo', () => {
  // Se LEE la ruta del servidor, no se toca. Si allí cambia el tope y aquí no, «diez-fotos» dejaría
  // de llenar el albarán (o pediría más de las que caben) sin que nada cayera.
  const fuente = fs.readFileSync(path.join(RAIZ, 'src', 'modules', 'jobs', 'app', 'routes', 'albaranes.routes.ts'), 'utf8');
  const numero = (re, que) => {
    const m = fuente.match(re);
    assert.ok(m, `no encuentro ${que} en albaranes.routes.ts: el test no puede comparar nada`);
    return m[1].replace(/_/g, '').split('*').map((n) => Number(n.trim())).reduce((a, n) => a * n, 1);
  };
  assert.equal(FOTOS_POR_ALBARAN, numero(/const FOTOS_MAX_POR_ALBARAN = ([0-9_]+);/, 'FOTOS_MAX_POR_ALBARAN'));
  const maxFoto = numero(/const FOTO_MAX_BYTES = ([0-9_* ]+);/, 'FOTO_MAX_BYTES');
  const maxFirma = numero(/const FIRMA_MAX_CHARS = ([0-9_]+);/, 'FIRMA_MAX_CHARS');
  assert.ok(maxFoto > 1000 && maxFirma > 1000, 'los topes leídos no tienen pinta de topes');
  for (const f of FOTOS_QA) assert.ok(f.length < maxFoto);
  assert.ok(FIRMA_QA.length < maxFirma);
  assert.match(fuente, /const FOTO_MIME_ALLOWLIST = \[[^\]]*'image\/png'/);
});
