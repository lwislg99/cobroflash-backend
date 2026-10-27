// docs/master/evidencias/SCRUM-1302/reintento-de-firma/reintento.mjs — SCRUM-1302d
//
// LA CONDICIÓN DE LA FIRMA DEL TEXTO B (SCRUM-1302, comentario 19428): el texto nuevo le dice al
// cliente «vuelve a intentarlo» cuando NO sabemos si su firma llegó. Antes de escribirlo hay que
// saber qué hace el servidor con ese segundo intento SI LA PRIMERA FIRMA SÍ LLEGÓ.
//
// Corre `POST /albaran/:token/firmar` de verdad (`dist`) sobre el banco de
// `tests/_banco-firma-del-parte.mjs`: ahí está qué se dobla, qué no y el límite del instrumento.
// ⛔ Sin red, sin base y sin Meta.
//
// Uso (después de `npm run build`):
//   node docs/master/evidencias/SCRUM-1302/reintento-de-firma/reintento.mjs [--escribir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bancoDelParte, TRAZO_1, TRAZO_2 } from '../../../../../tests/_banco-firma-del-parte.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

const salida = [];
const decir = (l = '') => { salida.push(l); console.log(l); };

const foto = (b) => `estado=${b.fila.estado} · escrituras=${b.cuenta.escrituras} · PDF pedidos=${b.cuenta.pdf} · copias pedidas=${b.cuenta.copias}`
  + ` · trazo guardado=${b.fila.signatureUrl === TRAZO_1 ? 'el PRIMERO' : b.fila.signatureUrl === TRAZO_2 ? 'el SEGUNDO' : String(b.fila.signatureUrl)}`
  + ` · firmante=${b.fila.firmadoPorNombre}`;

let fallos = 0;
const exigir = (cond, texto) => { if (!cond) { fallos += 1; decir(`   🔴 NO SE CUMPLE: ${texto}`); } };

decir('SCRUM-1302d · reintentar la firma del parte cuando la primera SÍ llegó');
decir('ruta medida: POST /albaran/:token/firmar · dist/modules/jobs/app/routes/albaranPublic.routes.js');
decir();

// ── 0 · CONTROL POSITIVO: la primera firma entra y el instrumento la ve ──────────────────────────
{
  const b = bancoDelParte();
  const r = await b.firmar();
  decir('0 · control · un parte EMITIDO, una firma');
  decir(`   respuesta ${r.status} ${JSON.stringify(r.data)}`);
  decir(`   ${foto(b)}`);
  exigir(r.status === 200 && b.fila.estado === 'firmado' && b.cuenta.escrituras === 1 && b.cuenta.copias === 1,
    'la primera firma tiene que entrar, escribir UNA vez y pedir UNA copia; si no, el banco no mide nada');
  decir();
}

// ── 1 · EL CASO DE LA FIRMA: la primera llegó, la página no lo supo, el cliente reintenta ─────────
{
  const b = bancoDelParte();
  const r1 = await b.firmar();
  const selloDe1 = JSON.stringify(b.fila.evidenciaFirma);
  const cuando1 = String(b.fila.firmadoAt);
  const r2 = await b.firmar();
  const igual = JSON.stringify(b.fila.evidenciaFirma) === selloDe1 && String(b.fila.firmadoAt) === cuando1;
  decir('1 · la primera firma llegó y se reintenta con LO MISMO');
  decir(`   primera   → ${r1.status} ${JSON.stringify(r1.data)}`);
  decir(`   reintento → ${r2.status} ${JSON.stringify(r2.data)}`);
  decir(`   ${foto(b)}`);
  decir(`   sello y fecha de firma tras el reintento: ${igual ? 'LOS MISMOS' : 'HAN CAMBIADO'}`);
  exigir(r2.status === 200 && r2.data?.already === true, 'el reintento contesta 200 con `already: true`');
  exigir(b.cuenta.escrituras === 1 && b.cuenta.pdf === 1 && b.cuenta.copias === 1, 'el reintento no escribe, no rehace el PDF y no pide otra copia');
  exigir(igual, 'el sello y la fecha no se mueven');
  decir();
}

// ── 1b · se reintenta con OTRO trazo y OTRO nombre (borró y volvió a dibujar) ─────────────────────
{
  const b = bancoDelParte();
  await b.firmar();
  const r2 = await b.firmar({ signatureData: TRAZO_2, firmadoPorNombre: 'Otra Persona', firmadoPorCalidad: 'familiar_o_conviviente' });
  decir('1b · la primera firma llegó y se reintenta con OTRO trazo y OTRO nombre');
  decir(`   reintento → ${r2.status} ${JSON.stringify(r2.data)}`);
  decir(`   ${foto(b)}`);
  exigir(b.cuenta.escrituras === 1 && b.fila.signatureUrl === TRAZO_1 && b.fila.firmadoPorNombre === 'Ana Prueba',
    'queda la primera firma, con su trazo y su nombre');
  decir();
}

// ── 1c · el reintento llega con otra versión del parte: ¿sigue contestando «ya está»? ─────────────
{
  const b = bancoDelParte();
  await b.firmar();
  const r2 = await b.firmar({ version: 2 });
  decir('1c · la primera firma llegó y el reintento trae OTRA versión del parte');
  decir(`   reintento → ${r2.status} ${JSON.stringify(r2.data)}`);
  decir(`   ${foto(b)}`);
  exigir(r2.status === 200 && b.cuenta.escrituras === 1, 'un parte ya firmado contesta «ya está» antes de mirar la versión');
  decir();
}

// ── 2 · DOS A LA VEZ: las dos leen `emitido` antes de que ninguna escriba ─────────────────────────
// NO es el caso de la firma del texto (ahí el segundo intento lo pulsa una persona después de leer
// el aviso). Se mide porque es el único camino por el que un segundo intento escribe. No cuenta
// como fallo de este guion: es un hallazgo de servidor, entregado aparte en el ticket.
let dosALaVez;
{
  const b = bancoDelParte({ lecturaLenta: 20 });
  const [x, y] = await Promise.all([b.firmar(), b.firmar({ signatureData: TRAZO_2, firmadoPorNombre: 'Otra Persona' })]);
  dosALaVez = { ...b.cuenta, trazo: b.fila.signatureUrl === TRAZO_2 ? 'el SEGUNDO' : 'el PRIMERO' };
  decir('2 · dos peticiones A LA VEZ sobre un parte emitido (las dos leen antes de que ninguna escriba)');
  decir(`   respuestas → ${x.status} ${JSON.stringify(x.data)} · ${y.status} ${JSON.stringify(y.data)}`);
  decir(`   ${foto(b)}`);
  decir(`   LECTURA: ${b.cuenta.escrituras === 1 ? 'una sola escribe.' : `escriben las ${b.cuenta.escrituras}: la escritura del parte no lleva la condición de estado.`}`);
  decir();
}

decir(`RESUMEN · reintento después de una firma que llegó: ${fallos === 0 ? 'NO firma dos veces (200 `already`, cero escrituras, cero copias, mismo sello)' : `${fallos} comprobación(es) NO se cumplen`}`);
decir(`RESUMEN · dos a la vez: escrituras=${dosALaVez.escrituras}, copias pedidas=${dosALaVez.copias}, queda ${dosALaVez.trazo} trazo`);

if (process.argv.includes('--escribir')) {
  fs.writeFileSync(path.join(AQUI, 'reintento.txt'), `${salida.join('\n')}\n`, 'utf8');
}
process.exit(fallos === 0 ? 0 : 1);
