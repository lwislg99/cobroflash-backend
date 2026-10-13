// tests/scrum1525b-el-respaldo-por-correo.test.mjs — SCRUM-1525b
//
// El respaldo sale por correo (decisión del fundador del 13-oct-2026). Lo que aquí se fija no es
// que el correo salga cuando todo va bien, sino QUÉ SE ENTERA ALGUIEN cuando va mal:
//
//   · el volcado muere (también por memoria, que no pasa por su `catch`) → correo «HOY NO HAY»;
//   · el fichero ya no cabe en un correo → NO se intenta el adjunto y se avisa sin él;
//   · el correo con el adjunto falla → segundo correo, sin adjunto, que lo dice;
//   · el correo no está configurado o está caído entero → código de salida ≠ 0 y el rastro dice
//     que no le ha llegado a nadie.
//
// Ningún caso toca una base ni la red. Los hijos son guiones FABRICADOS en una carpeta temporal,
// con un entorno construido a mano (no heredan el de la tanda); el único caso que lanza el
// `backup-dump.mjs` de verdad lo hace SIN `DATABASE_URL`, que es su primera puerta: sale antes
// de importar nada que conecte.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
import {
  TOPE_ADJUNTO_BYTES, FRACCION_DE_AVISO, SALIDA,
  validarCorreo, carpetaDeRespaldos, fotoDeLaCarpeta, respaldoEscrito, lanzarVolcado,
  construirCorreo, ejecutarPasada, crearTransportador,
} from '../scripts/respaldo-programado.mjs';
import { crearTransportadorResend } from '../scripts/aviso-programado-acreditacion-invoicing-es.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const AHORA = new Date('2026-10-13T03:15:00.000Z');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1525b-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

/** El entorno de un hijo, a mano: lo justo para que `node` arranque, y nada de la tanda. */
function entornoDeHijo(extra = {}) {
  const env = {};
  for (const k of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE']) {
    if (process.env[k]) env[k] = process.env[k];
  }
  return { ...env, ...extra };
}

function guion(nombre, codigo) {
  const ruta = path.join(TMP, nombre);
  fs.writeFileSync(ruta, codigo);
  return ruta;
}

/** Un transportador que apunta lo que le piden y falla cuando `falla(correo)` dice que sí. */
function buzon(falla = () => false) {
  const enviados = [];
  return {
    enviados,
    async sendMail(correo) {
      if (falla(correo)) throw new Error('552 mensaje demasiado grande');
      enviados.push(correo);
      return {};
    },
  };
}

function pasada({ volcado, respaldo, contenido = Buffer.from('cifrado'), transportador, faltan = [] }) {
  const leidos = [];
  return ejecutarPasada({
    volcar: async () => volcado,
    foto: () => new Map(),
    buscar: () => respaldo,
    leer: (ruta) => { leidos.push(ruta); return contenido; },
    transporte: async () => ({ transportador, faltan }),
    remitente: 'YaQu <casa@example.test>',
    destinatario: 'fundador@example.test',
    ahora: () => AHORA,
    limites: { envioConAdjunto: 2000, envioDeTexto: 2000 },
  }).then((r) => ({ ...r, leidos }));
}

const BIEN = { codigo: 0, senal: null, cola: '✓ backup cifrado' };
const respaldoDe = (bytes) => ({ ruta: path.join(TMP, 'yaqu-20261013.logical.gz.enc'), nombre: 'yaqu-20261013.logical.gz.enc', bytes });

// ── el caso bueno: el positivo que TIENE que aparecer ────────────────────────────────────────

test('SCRUM-1525b · pasada buena: UN correo, con el fichero adjunto y su sha256, y sale 0', async () => {
  const contenido = crypto.randomBytes(4096);
  const tr = buzon();
  const r = await pasada({ volcado: BIEN, respaldo: respaldoDe(contenido.length), contenido, transportador: tr });

  assert.equal(r.exitCode, SALIDA.ENTREGADO);
  assert.equal(r.entregado, true);
  assert.equal(tr.enviados.length, 1);
  const [c] = tr.enviados;
  assert.equal(c.to, 'fundador@example.test');
  assert.equal(c.attachments.length, 1);
  assert.equal(c.attachments[0].filename, 'yaqu-20261013.logical.gz.enc');
  assert.ok(c.attachments[0].content.equals(contenido), 'el adjunto no es el fichero');
  assert.match(c.text, new RegExp(crypto.createHash('sha256').update(contenido).digest('hex')));
  assert.match(c.subject, /^✔ /);
});

// ── el volcado muere ─────────────────────────────────────────────────────────────────────────

test('SCRUM-1525b · 🔴 el volcado termina mal: correo «HOY NO HAY RESPALDO», sin adjunto, y sale 1', async () => {
  for (const volcado of [
    { codigo: 134, senal: null, cola: 'FATAL ERROR: Reached heap limit' },
    { codigo: null, senal: 'SIGABRT', cola: 'FATAL ERROR: Reached heap limit' },
    { codigo: 1, senal: null, cola: 'backup FALLÓ: backup lógico INCOMPLETO' },
  ]) {
    const tr = buzon();
    // Aunque en la carpeta hubiera un fichero, con el volcado caído no se manda ninguno.
    const r = await pasada({ volcado, respaldo: respaldoDe(10), transportador: tr });
    assert.equal(r.exitCode, SALIDA.SIN_RESPALDO);
    assert.equal(r.caso, 'SIN_RESPALDO');
    assert.equal(tr.enviados.length, 1);
    assert.equal(tr.enviados[0].attachments, undefined);
    assert.match(tr.enviados[0].subject, /HOY NO HAY RESPALDO/);
    assert.match(tr.enviados[0].subject, volcado.senal ? /señal SIGABRT/ : new RegExp(`código ${volcado.codigo}`));
    assert.match(tr.enviados[0].text, new RegExp(volcado.cola.slice(0, 20)));
    assert.equal(r.leidos.length, 0, 'no se lee ningún fichero si el volcado ha caído');
  }
});

test('SCRUM-1525b · 🔴 el volcado dice 0 y no deja fichero: tampoco hay respaldo, y no se manda uno viejo', async () => {
  const tr = buzon();
  const r = await pasada({ volcado: BIEN, respaldo: null, transportador: tr });
  assert.equal(r.exitCode, SALIDA.SIN_RESPALDO);
  assert.equal(r.caso, 'SIN_FICHERO');
  assert.equal(tr.enviados.length, 1);
  assert.equal(tr.enviados[0].attachments, undefined);
  assert.match(tr.enviados[0].subject, /HOY NO HAY RESPALDO/);
});

// ── el tope del adjunto: los dos bordes salen de la constante ────────────────────────────────

test('SCRUM-1525b · en el tope justo CABE y va adjunto; un byte más NO se intenta y se avisa sin adjunto', async () => {
  const cabe = buzon();
  const r1 = await pasada({ volcado: BIEN, respaldo: respaldoDe(TOPE_ADJUNTO_BYTES), transportador: cabe });
  assert.equal(r1.exitCode, SALIDA.ENTREGADO);
  assert.equal(cabe.enviados[0].attachments.length, 1);
  assert.equal(r1.leidos.length, 1);

  const noCabe = buzon();
  const r2 = await pasada({ volcado: BIEN, respaldo: respaldoDe(TOPE_ADJUNTO_BYTES + 1), transportador: noCabe });
  assert.equal(r2.exitCode, SALIDA.NO_ENTREGADO);
  assert.equal(r2.caso, 'NO_CABE');
  assert.equal(r2.leidos.length, 0, 'un fichero que no cabe no se carga en memoria');
  assert.equal(noCabe.enviados.length, 1);
  assert.equal(noCabe.enviados[0].attachments, undefined);
  assert.match(noCabe.enviados[0].subject, /HECHO PERO NO ENVIADO/);
  assert.match(noCabe.enviados[0].text, new RegExp(`tamaño: ${TOPE_ADJUNTO_BYTES + 1} B`));
});

test('SCRUM-1525b · desde la mitad del tope el asunto AVISA; por debajo, no', () => {
  const borde = Math.ceil(TOPE_ADJUNTO_BYTES * FRACCION_DE_AVISO);
  const cerca = construirCorreo({ volcado: BIEN, respaldo: respaldoDe(borde), sha256: 'x', ahora: AHORA });
  const lejos = construirCorreo({ volcado: BIEN, respaldo: respaldoDe(borde - 1), sha256: 'x', ahora: AHORA });
  assert.match(cerca.asunto, /^⚠️ .*pronto no cabrá en un correo/);
  assert.match(lejos.asunto, /^✔ /);
  assert.equal(cerca.adjuntar, true);
  assert.equal(lejos.adjuntar, true);
  // El volcado de hoy (388.319 B, SCRUM-1525 c.19226) queda lejos: es el caso que se va a ver.
  const hoy = construirCorreo({ volcado: BIEN, respaldo: respaldoDe(388319), sha256: 'x', ahora: AHORA });
  assert.match(hoy.asunto, /^✔ .* 2\.5 % del tope$/);
});

// ── el correo falla ──────────────────────────────────────────────────────────────────────────

test('SCRUM-1525b · 🔴 el correo CON adjunto falla: sale un segundo correo SIN adjunto que lo dice, y sale 2', async () => {
  const tr = buzon((c) => Boolean(c.attachments));
  const r = await pasada({ volcado: BIEN, respaldo: respaldoDe(7), transportador: tr });
  assert.equal(r.exitCode, SALIDA.NO_ENTREGADO);
  assert.equal(r.caso, 'NO_LLEGO');
  assert.equal(r.entregado, false);
  assert.equal(tr.enviados.length, 1);
  assert.equal(tr.enviados[0].attachments, undefined);
  assert.match(tr.enviados[0].subject, /HECHO PERO NO ENVIADO/);
  assert.match(tr.enviados[0].text, /552 mensaje demasiado grande/);
  assert.match(r.rastro, /aviso sin adjunto ENTREGADO/);
});

test('SCRUM-1525b · 🔴 el correo está caído ENTERO: ningún envío, sale 2 y el rastro dice que no le ha llegado a nadie', async () => {
  const tr = buzon(() => true);
  const r = await pasada({ volcado: BIEN, respaldo: respaldoDe(7), transportador: tr });
  assert.equal(tr.enviados.length, 0);
  assert.equal(r.exitCode, SALIDA.NO_ENTREGADO);
  assert.match(r.rastro, /NO ENTREGADO .*no le ha llegado a nadie/);
  // Y con el volcado caído y el correo caído, manda el 1: lo grave es que no hay respaldo.
  const r2 = await pasada({ volcado: { codigo: 134, senal: null, cola: '' }, respaldo: null, transportador: buzon(() => true) });
  assert.equal(r2.exitCode, SALIDA.SIN_RESPALDO);
  assert.match(r2.rastro, /no le ha llegado a nadie/);
});

test('SCRUM-1525b · 🔴 un envío que no contesta se corta por tiempo y cuenta como fallo, no como entregado', async () => {
  const colgado = { enviados: [], sendMail: () => new Promise(() => {}) };
  const r = await ejecutarPasada({
    volcar: async () => BIEN, foto: () => new Map(), buscar: () => respaldoDe(7), leer: () => Buffer.from('x'),
    transporte: async () => ({ transportador: colgado }), remitente: 'a@example.test', destinatario: 'b@example.test',
    ahora: () => AHORA, limites: { envioConAdjunto: 30, envioDeTexto: 30 },
  });
  assert.equal(r.exitCode, SALIDA.NO_ENTREGADO);
  assert.match(r.rastro, /se agotaron 0\.03s en la etapa «envío con adjunto»/);
  assert.match(r.rastro, /no le ha llegado a nadie/);
});

test('SCRUM-1525b · sin correo configurado el volcado CORRE igual, y la salida no es 0', async () => {
  let volco = false;
  const r = await ejecutarPasada({
    volcar: async () => { volco = true; return BIEN; },
    foto: () => new Map(), buscar: () => respaldoDe(7), leer: () => Buffer.from('x'),
    transporte: async () => ({ transportador: null, faltan: ['BACKUP_EMAIL_DESTINO'] }),
    ahora: () => AHORA,
  });
  assert.equal(volco, true);
  assert.equal(r.exitCode, SALIDA.NO_ENTREGADO);
  assert.match(r.rastro, /CORREO SIN CONFIGURAR \(faltan: BACKUP_EMAIL_DESTINO\)/);

  assert.deepEqual(validarCorreo({}).faltan, ['SMTP_URL o RESEND_API_KEY', 'BACKUP_EMAIL_DESTINO']);
  assert.equal(validarCorreo({ SMTP_URL: 'x', BACKUP_EMAIL_DESTINO: 'x' }).ok, true);
  assert.equal(validarCorreo({ RESEND_API_KEY: 'x', BACKUP_EMAIL_DESTINO: 'x' }).ok, true);
  assert.equal((await crearTransportador({})).transportador, null);
  // El positivo: con el canal puesto, el transportador SÍ se construye (sin conectar a nada).
  const listo = await crearTransportador({ RESEND_API_KEY: 'clave-de-prueba', BACKUP_EMAIL_DESTINO: 'x' });
  assert.equal(typeof listo.transportador.sendMail, 'function');
  assert.equal(listo.canal, 'Resend (HTTPS)');
});

// ── los hijos DE VERDAD ──────────────────────────────────────────────────────────────────────

test('SCRUM-1525b · 🔴 un hijo que muere por MEMORIA (sin pasar por su catch) se ve desde fuera y acaba en correo', async () => {
  const ruta = guion('muere-por-memoria.mjs', [
    "process.on('exit', () => {});",
    "try { const a = []; for (;;) a.push(new Array(100000).fill(Math.random())); }",
    "catch (e) { console.log('ATRAPADO'); process.exit(0); }",
  ].join('\n'));
  const v = await lanzarVolcado(ruta, { argsDeNode: ['--max-old-space-size=24'], env: entornoDeHijo() });

  // En Windows llega como código 134; en Linux, como señal SIGABRT y código null.
  assert.notEqual(v.codigo, 0);
  assert.ok(v.codigo === 134 || v.senal === 'SIGABRT', `terminó con código ${v.codigo} y señal ${v.senal}`);
  assert.ok(!v.cola.includes('ATRAPADO'), 'el hijo pasó por su catch: no es la muerte que se quería ver');
  // Lo último que escribe node al morir es la pila nativa: la línea que dice por qué va aparte.
  assert.match(v.cola, /^.*FATAL ERROR.*heap/im);

  const tr = buzon();
  const r = await pasada({ volcado: v, respaldo: null, transportador: tr });
  assert.equal(r.exitCode, SALIDA.SIN_RESPALDO);
  assert.match(tr.enviados[0].subject, /HOY NO HAY RESPALDO/);
  assert.match(tr.enviados[0].text, /heap/i);
});

test('SCRUM-1525b · un hijo que escribe su fichero: se encuentra ESE, no el de ayer que ya estaba', async () => {
  const dir = path.join(TMP, 'backups-hijo');
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'yaqu-20261012.logical.gz.enc'), 'el de ayer');
  // Con fecha de modificación POSTERIOR a todo: «el más reciente» elegiría éste.
  fs.utimesSync(path.join(dir, 'yaqu-20261012.logical.gz.enc'), new Date('2030-01-01'), new Date('2030-01-01'));
  fs.writeFileSync(path.join(dir, 'notas.txt'), 'no es un respaldo');
  const antes = fotoDeLaCarpeta(dir);
  assert.equal(antes.size, 1, 'la foto sólo cuenta los .enc');
  assert.equal(respaldoEscrito(dir, antes), null, 'sin volcado no hay fichero nuevo');

  const ruta = guion('escribe.mjs', [
    "import fs from 'node:fs'; import path from 'node:path';",
    "fs.writeFileSync(path.join(process.env.BACKUP_DIR, 'yaqu-20261013.logical.gz.enc'), 'el de hoy, cifrado');",
    "console.log('escrito');",
  ].join('\n'));
  const v = await lanzarVolcado(ruta, { env: entornoDeHijo({ BACKUP_DIR: dir }) });
  assert.equal(v.codigo, 0);
  assert.match(v.cola, /escrito/);

  const hallado = respaldoEscrito(dir, antes);
  assert.equal(hallado.nombre, 'yaqu-20261013.logical.gz.enc');
  assert.equal(hallado.bytes, Buffer.byteLength('el de hoy, cifrado'));
  // Una segunda pasada el mismo día PISA el fichero (c.19226): cambia, y se vuelve a encontrar.
  const despues = fotoDeLaCarpeta(dir);
  fs.writeFileSync(path.join(dir, 'yaqu-20261013.logical.gz.enc'), 'el de hoy, segunda pasada');
  assert.equal(respaldoEscrito(dir, despues).nombre, 'yaqu-20261013.logical.gz.enc');
});

test('SCRUM-1525b · 🔴 el guion ENTERO con el volcado de verdad cayendo en su primera puerta: sale 1 y lo dice', () => {
  // Sin DATABASE_URL `backup-dump.mjs` sale con 1 antes de importar nada que conecte.
  const r = spawnSync(process.execPath, [path.join(RAIZ, 'scripts', 'respaldo-programado.mjs')], {
    env: entornoDeHijo({ BACKUP_DIR: path.join(TMP, 'backups-vacio') }), encoding: 'utf8', timeout: 60_000,
  });
  assert.equal(r.status, SALIDA.SIN_RESPALDO, `stdout: ${r.stdout}\nstderr: ${r.stderr}`);
  assert.match(r.stderr, /Falta DATABASE_URL/);
  assert.match(r.stdout, /HOY NO HAY RESPALDO — el volcado terminó con código 1/);
  assert.match(r.stdout, /CORREO SIN CONFIGURAR \(faltan: SMTP_URL o RESEND_API_KEY, BACKUP_EMAIL_DESTINO\)/);
  assert.match(r.stdout, /no le ha llegado a nadie/);
});

test('SCRUM-1525b · la carpeta donde se busca es la MISMA en la que escribe backup-dump.mjs', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, 'scripts', 'backup-dump.mjs'), 'utf8');
  assert.ok(fuente.includes("process.env.BACKUP_DIR || path.join(process.cwd(), 'backups')"),
    'backup-dump.mjs ya no deriva su carpeta así: carpetaDeRespaldos() busca en otro sitio');
  assert.equal(carpetaDeRespaldos({}, '/x'), path.join('/x', 'backups'));
  assert.equal(carpetaDeRespaldos({ BACKUP_DIR: '/otra' }, '/x'), '/otra');
});

// ── los dos canales llevan el fichero byte a byte ────────────────────────────────────────────

test('SCRUM-1525b · por SMTP (nodemailer de verdad, sin red) el adjunto sale del mensaje idéntico al fichero', async () => {
  const contenido = crypto.randomBytes(50_000);
  const tr = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
  const vistos = [];
  const r = await pasada({
    volcado: BIEN, respaldo: respaldoDe(contenido.length), contenido,
    transportador: { sendMail: async (c) => { const info = await tr.sendMail(c); vistos.push(info.message.toString()); return info; } },
  });
  assert.equal(r.exitCode, SALIDA.ENTREGADO);
  assert.equal(vistos.length, 1);
  const mime = vistos[0];
  assert.match(mime, /filename=yaqu-20261013\.logical\.gz\.enc/);
  const trasCabecera = mime.slice(mime.indexOf('Content-Disposition: attachment'));
  // nodemailer escribe el mensaje con CRLF aunque se le pida otra cosa: se parte por los dos.
  const cuerpo = trasCabecera.split(/\r?\n\r?\n/)[1];
  const base64 = cuerpo.split(/\r?\n--/)[0].replace(/\s+/g, '');
  assert.ok(base64.length > contenido.length, 'no se ha encontrado el adjunto en el mensaje');
  assert.ok(Buffer.from(base64, 'base64').equals(contenido), 'el adjunto del mensaje no es el fichero');
});

test('SCRUM-1525b · por Resend el adjunto viaja en base64 y vuelve idéntico; sin adjunto, el cuerpo no cambia', async () => {
  const contenido = crypto.randomBytes(50_000);
  const vistas = [];
  const tr = crearTransportadorResend('clave-de-prueba', {
    peticion: async (url, opciones) => { vistas.push(JSON.parse(opciones.body)); return { ok: true, status: 200, text: async () => '{}' }; },
  });
  const r = await pasada({ volcado: BIEN, respaldo: respaldoDe(contenido.length), contenido, transportador: tr });
  assert.equal(r.exitCode, SALIDA.ENTREGADO);
  assert.equal(vistas[0].attachments.length, 1);
  assert.equal(vistas[0].attachments[0].filename, 'yaqu-20261013.logical.gz.enc');
  assert.ok(Buffer.from(vistas[0].attachments[0].content, 'base64').equals(contenido));

  await tr.sendMail({ from: 'a@b.c', to: 'd@e.f', subject: 'S', text: 'T' });
  assert.deepEqual(vistas[1], { from: 'a@b.c', to: ['d@e.f'], subject: 'S', text: 'T' });
});

test('SCRUM-1525b · 🔴 un rechazo de Resend por tamaño LANZA, y la pasada lo convierte en aviso sin adjunto', async () => {
  const cuerpos = [];
  const tr = crearTransportadorResend('clave-de-prueba', {
    peticion: async (url, opciones) => {
      const c = JSON.parse(opciones.body);
      cuerpos.push(c);
      return c.attachments
        ? { ok: false, status: 413, text: async () => '{"message":"demasiado grande"}' }
        : { ok: true, status: 200, text: async () => '{}' };
    },
  });
  const r = await pasada({ volcado: BIEN, respaldo: respaldoDe(7), transportador: tr });
  assert.equal(r.exitCode, SALIDA.NO_ENTREGADO);
  assert.equal(cuerpos.length, 2);
  assert.equal(cuerpos[1].attachments, undefined);
  assert.match(cuerpos[1].text, /Resend respondió 413/);
  assert.match(cuerpos[1].subject, /HECHO PERO NO ENVIADO/);
});
