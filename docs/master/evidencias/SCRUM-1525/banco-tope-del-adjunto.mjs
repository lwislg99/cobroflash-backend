// docs/master/evidencias/SCRUM-1525/banco-tope-del-adjunto.mjs — SCRUM-1525b
//
// QUÉ PASA AL PASARSE DEL TAMAÑO, medido sin red de verdad y sin ninguna clave.
//
//   node docs/master/evidencias/SCRUM-1525/banco-tope-del-adjunto.mjs smtp
//   node docs/master/evidencias/SCRUM-1525/banco-tope-del-adjunto.mjs memoria <MiB>
//
// `smtp`    levanta en 127.0.0.1 un servidor SMTP FABRICADO que anuncia `SIZE <tope>` y contesta
//           552 a un mensaje mayor, y le manda con el nodemailer de la casa un adjunto que cabe
//           (control positivo) y uno que no. Mide si el rechazo LLEGA como error o se pierde.
// `memoria` mide el pico de memoria de ESTE proceso al preparar un adjunto de <MiB> por el camino
//           de Resend (base64 + JSON), con la petición inyectada: no sale nada a la red.
//
// Lo que NO mide: qué contesta Resend de verdad al pasarse de sus 40 MB, ni el tope del buzón
// del fundador. Para eso haría falta una clave y un envío real.
import net from 'node:net';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { ejecutarPasada, TOPE_ADJUNTO_BYTES } from '../../../../scripts/respaldo-programado.mjs';
import { crearTransportadorResend } from '../../../../scripts/aviso-programado-acreditacion-invoicing-es.mjs';

const [modo, arg] = process.argv.slice(2);
const sal = (o) => console.log(JSON.stringify(o));
const MiB = 1024 * 1024;

function servidorSmtp(topeBytes) {
  const visto = { mensajes: 0, rechazados: 0 };
  const srv = net.createServer((s) => {
    let enDatos = false;
    let recibidos = 0;
    let resto = '';
    s.write('220 banco ESMTP\r\n');
    s.on('data', (trozo) => {
      if (enDatos) {
        recibidos += trozo.length;
        if ((resto + trozo.toString('latin1')).endsWith('\r\n.\r\n')) {
          enDatos = false;
          visto.mensajes += 1;
          if (recibidos > topeBytes) { visto.rechazados += 1; s.write('552 5.3.4 mensaje demasiado grande\r\n'); }
          else s.write('250 2.0.0 aceptado\r\n');
          recibidos = 0;
        }
        resto = trozo.toString('latin1').slice(-5);
        return;
      }
      for (const linea of trozo.toString().split('\r\n').filter(Boolean)) {
        const c = linea.toUpperCase();
        if (c.startsWith('EHLO')) s.write(`250-banco\r\n250 SIZE ${topeBytes}\r\n`);
        else if (c.startsWith('MAIL') || c.startsWith('RCPT')) s.write('250 ok\r\n');
        else if (c.startsWith('DATA')) { enDatos = true; resto = ''; s.write('354 adelante\r\n'); }
        else if (c.startsWith('QUIT')) { s.write('221 adios\r\n'); s.end(); }
        else s.write('250 ok\r\n');
      }
    });
    s.on('error', () => {});
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok({ srv, visto, puerto: srv.address().port })));
}

async function pasadaCon(transportador, bytes) {
  const contenido = crypto.randomBytes(bytes);
  const avisos = [];
  const r = await ejecutarPasada({
    volcar: async () => ({ codigo: 0, senal: null, cola: '' }),
    foto: () => new Map(),
    buscar: () => ({ ruta: 'x', nombre: 'yaqu-banco.logical.gz.enc', bytes }),
    leer: () => contenido,
    transporte: async () => ({ transportador }),
    remitente: 'casa@example.test', destinatario: 'fundador@example.test',
    traza: (e, d) => avisos.push(`${e}${d ? ' · ' + d : ''}`),
  });
  return { exitCode: r.exitCode, caso: r.caso, rastro: r.rastro };
}

if (modo === 'smtp') {
  // El tope del servidor fabricado va MUY por debajo del nuestro, para que el envío con adjunto
  // se intente (cabe en TOPE_ADJUNTO_BYTES) y sea el servidor quien lo rechace.
  const topeServidor = 1 * MiB;
  const { srv, visto, puerto } = await servidorSmtp(topeServidor);
  const tr = nodemailer.createTransport({ host: '127.0.0.1', port: puerto, secure: false, ignoreTLS: true });
  sal({ modo, topeServidor, TOPE_ADJUNTO_BYTES, nodemailer: nodemailer.createTransport({ jsonTransport: true }).transporter.version });
  sal({ caso: 'cabe (control positivo)', bytes: 100_000, ...(await pasadaCon(tr, 100_000)), servidor: { ...visto } });
  sal({ caso: 'no cabe en el servidor', bytes: 2 * MiB, ...(await pasadaCon(tr, 2 * MiB)), servidor: { ...visto } });
  tr.close();
  srv.close();
} else if (modo === 'memoria') {
  const bytes = Math.round(Number(arg) * MiB);
  let cuerpoChars = 0;
  const tr = crearTransportadorResend('clave-de-banco', {
    peticion: async (url, o) => { cuerpoChars = Math.max(cuerpoChars, o.body.length); return { ok: true, status: 200, text: async () => '{}' }; },
  });
  const r = await pasadaCon(tr, bytes);
  sal({ modo, MiB: Number(arg), bytes, cuerpoChars, caso: r.caso, exitCode: r.exitCode, picoRssMB: Math.round(process.resourceUsage().maxRSS / 1024) });
} else {
  console.error('uso: banco-tope-del-adjunto.mjs smtp | memoria <MiB>');
  process.exit(2);
}
