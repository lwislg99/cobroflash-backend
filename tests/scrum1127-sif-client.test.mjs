// tests/scrum1127-sif-client.test.mjs — SCRUM-1127 · SIF-1 · S1-D fase 1.
//
// El cliente de envío a la AEAT contra un SERVIDOR FALSO local (`node:http`, nunca `fetch`: en
// Windows revienta con la aserción de libuv). Nada de aquí habla con la AEAT ni usa un
// certificado.
//
// ⚠️ SUELO: esto prueba la FORMA del envío y el MANEJO de cada respuesta. NO prueba que la AEAT
// acepte nada. Lo único que demuestra aceptación es un CSV devuelto por ella.
//
// 🔴 LO QUE SE VIGILA: «no pude enviar», «enviado y sin saber qué pasó», «rechazado» y
// «respondido» salen por CUATRO caminos distintos, y cada fallo NOMBRA su etapa.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { soloCodigo } from './_solo-codigo.mjs';

const require = createRequire(import.meta.url);
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = require(path.join(RAIZ, 'dist/modules/fiscal/verifactu/sif.client.js'));
const cola = require(path.join(RAIZ, 'dist/modules/fiscal/verifactu/sif.cola.js'));

// ───────────────────────────────────────────────────────── el servidor falso

const servidores = [];
after(() => { for (const s of servidores) s.close(); });

/** Levanta un servidor en 127.0.0.1:<libre>. `manejar(req, cuerpo, res, socket)`. */
async function servidor(manejar) {
  const recibido = [];
  const s = http.createServer((req, res) => {
    const trozos = [];
    req.on('data', (c) => trozos.push(c));
    req.on('end', () => {
      const cuerpo = Buffer.concat(trozos).toString('utf8');
      recibido.push({ headers: req.headers, cuerpo, method: req.method, url: req.url });
      manejar(req, cuerpo, res, req.socket);
    });
  });
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  servidores.push(s);
  return { url: `http://127.0.0.1:${s.address().port}/wlpl/falso/VerifactuSOAP`, recibido };
}

/** Un servidor TCP que acepta y no dice nada (para colgar el TLS). */
async function mudo() {
  const s = net.createServer(() => { /* ni una palabra */ });
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  servidores.push(s);
  return s.address().port;
}

async function puertoCerrado() {
  const s = net.createServer();
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const p = s.address().port;
  await new Promise((r) => s.close(r));
  return p;
}

// ───────────────────────────────────────────────────────── respuestas AEAT

const NIF = '05292751Z';
const REG = { idEmisorFactura: NIF, numSerieFactura: 'PRUEBA-1', fechaExpedicionFactura: '25-09-2026', tipoOperacion: 'Alta' };

function linea({ serie = 'PRUEBA-1', estado = 'Correcto', codigo = null, desc = null, dup = null, op = 'Alta' } = {}) {
  return `<tikR:RespuestaLinea>
      <tikR:IDFactura><tik:IDEmisorFactura>${NIF}</tik:IDEmisorFactura><tik:NumSerieFactura>${serie}</tik:NumSerieFactura><tik:FechaExpedicionFactura>25-09-2026</tik:FechaExpedicionFactura></tikR:IDFactura>
      <tikR:Operacion><tik:TipoOperacion>${op}</tik:TipoOperacion></tikR:Operacion>
      <tikR:EstadoRegistro>${estado}</tikR:EstadoRegistro>
      ${codigo ? `<tikR:CodigoErrorRegistro>${codigo}</tikR:CodigoErrorRegistro>` : ''}
      ${desc ? `<tikR:DescripcionErrorRegistro>${desc}</tikR:DescripcionErrorRegistro>` : ''}
      ${dup ? `<tikR:RegistroDuplicado><tik:IdPeticionRegistroDuplicado>P-1</tik:IdPeticionRegistroDuplicado><tik:EstadoRegistroDuplicado>${dup}</tik:EstadoRegistroDuplicado><tik:CodigoErrorRegistro>9999</tik:CodigoErrorRegistro></tikR:RegistroDuplicado>` : ''}
    </tikR:RespuestaLinea>`;
}

function respuesta({ estadoEnvio = 'Correcto', tiempo = '60', csv = 'A-FALSO000000001', lineas = [linea()] } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">
  <env:Header/>
  <env:Body Id="Body">
    <tikR:RespuestaRegFactuSistemaFacturacion xmlns:tikR="urn:falso:R" xmlns:tik="urn:falso:SF">
      ${csv ? `<tikR:CSV>${csv}</tikR:CSV>` : ''}
      <tikR:Cabecera><tik:ObligadoEmision><tik:NombreRazon>X</tik:NombreRazon><tik:NIF>${NIF}</tik:NIF></tik:ObligadoEmision></tikR:Cabecera>
      ${tiempo === null ? '' : `<tikR:TiempoEsperaEnvio>${tiempo}</tikR:TiempoEsperaEnvio>`}
      <tikR:EstadoEnvio>${estadoEnvio}</tikR:EstadoEnvio>
      ${lineas.join('\n')}
    </tikR:RespuestaRegFactuSistemaFacturacion>
  </env:Body>
</env:Envelope>`;
}

const FAULT = `<?xml version="1.0"?><env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><env:Fault><faultcode>env:Client</faultcode><faultstring>Codigo[4102].El XML no cumple el esquema.</faultstring></env:Fault></env:Body></env:Envelope>`;

const CUERPO = '<sum:RegFactuSistemaFacturacion xmlns:sum="urn:x">…</sum:RegFactuSistemaFacturacion>';

function responder(status, body) {
  return (_req, _c, res) => { res.writeHead(status, { 'Content-Type': 'text/xml' }); res.end(body); };
}

/** Envía con traza capturada. Devuelve el resultado, la traza y cuándo llegó cada evento. */
async function enviar(url, extra = {}) {
  const eventos = [];
  const t0 = Date.now();
  const r = await cli.enviarSobre({
    endpoint: url, cuerpoSoap: CUERPO, envioId: 'test',
    traza: (e) => eventos.push({ ...e, llegoMs: Date.now() - t0 }),
    ...extra,
  });
  return { r, eventos };
}

const decidir = (r) => cola.decidirTrasEnvio([{ registro: REG, intentosPrevios: 0 }], r).registros[0];

// ═════════════════════════════════════════════════ ① RESPONDIDO: aceptado y con errores

test('SCRUM-1127 · aceptado: Correcto + línea Correcto → respondido, CSV leído, registro accepted', async () => {
  const s = await servidor(responder(200, respuesta()));
  const { r, eventos } = await enviar(s.url);
  assert.equal(r.tipo, 'respondido', JSON.stringify(r));
  assert.equal(r.respuesta.estadoEnvio, 'Correcto');
  assert.equal(r.respuesta.csv, 'A-FALSO000000001');
  assert.equal(r.respuesta.tiempoEsperaEnvioS, 60);
  assert.equal(r.respuesta.lineas.length, 1);
  const d = decidir(r);
  assert.equal(d.estado, 'accepted');
  assert.equal(d.requierePersona, false);

  // Lo que se envió: SOAP 1.1, POST, con el cuerpo dentro del sobre.
  const env = s.recibido[0];
  assert.equal(env.method, 'POST');
  assert.equal(env.url, '/wlpl/falso/VerifactuSOAP');
  assert.match(env.headers['content-type'], /^text\/xml; charset=utf-8$/);
  assert.equal(env.headers.soapaction, '""');
  assert.ok(env.cuerpo.includes('<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">'));
  assert.ok(env.cuerpo.includes(CUERPO));

  // La traza nombra cada etapa por la que pasó, y termina con el resultado.
  const etapas = eventos.filter((e) => e.evento === 'etapa').map((e) => e.etapa);
  assert.deepEqual(etapas, ['conectar', 'enviar', 'esperar_respuesta', 'leer_respuesta']);
  assert.equal(eventos.at(-1).evento, 'fin');
  assert.equal(eventos.at(-1).resultado, 'respondido');
  assert.equal(eventos[0].endpoint, s.url, 'la traza dice contra qué endpoint');
});

test('SCRUM-1127 · aceptado con errores: la línea AceptadoConErrores es accepted, con código y subsanar', async () => {
  const s = await servidor(responder(200, respuesta({
    estadoEnvio: 'ParcialmenteCorrecto',
    lineas: [linea({ estado: 'AceptadoConErrores', codigo: '2004', desc: 'El valor del campo FechaHoraHusoGenRegistro…' })],
  })));
  const { r } = await enviar(s.url);
  assert.equal(r.tipo, 'respondido');
  const d = decidir(r);
  assert.equal(d.estado, 'accepted');
  assert.equal(d.subsanar, true);
  assert.equal(d.requierePersona, true);
  assert.match(d.lastError, /^2004:/);
});

test('SCRUM-1127 · respuesta con varias líneas: se decide registro a registro, por coincidencia', async () => {
  const s = await servidor(responder(200, respuesta({
    estadoEnvio: 'ParcialmenteCorrecto',
    lineas: [linea({ serie: 'A-1' }), linea({ serie: 'A-2', estado: 'Incorrecto', codigo: '1239', desc: 'NIF no identificado' }), linea({ serie: 'FANTASMA' })],
  })));
  const { r } = await enviar(s.url);
  const reg = (serie) => ({ ...REG, numSerieFactura: serie });
  const d = cola.decidirTrasEnvio(
    [{ registro: reg('A-1'), intentosPrevios: 0 }, { registro: reg('A-2'), intentosPrevios: 0 }, { registro: reg('A-3'), intentosPrevios: 0 }],
    r,
  );
  assert.deepEqual(d.registros.map((x) => x.estado), ['accepted', 'rejected', 'pending'],
    '🔴 A-3 no aparece en la respuesta: NO puede estar aceptado aunque el envío tuviera éxito');
  assert.match(d.registros[1].lastError, /^1239:/);
  assert.equal(d.registros[1].requierePersona, true);
  assert.equal(d.registros[2].reintentarEnS, 60);
  assert.equal(d.lineasHuerfanas.length, 1);
  assert.equal(d.lineasHuerfanas[0].numSerieFactura, 'FANTASMA');
});

test('SCRUM-1127 · duplicado: manda el estado del registro que la AEAT YA tiene', async () => {
  for (const [dup, esperado, subsanar] of [['Correcta', 'accepted', false], ['AceptadaConErrores', 'accepted', true], ['Anulada', 'manual_review', false]]) {
    const s = await servidor(responder(200, respuesta({
      estadoEnvio: 'Incorrecto', lineas: [linea({ estado: 'Incorrecto', codigo: '3000', desc: 'Registro duplicado', dup })],
    })));
    const { r } = await enviar(s.url);
    assert.equal(r.tipo, 'rechazado');
    const l = r.respuesta.lineas[0];
    assert.equal(l.codigoError, '3000', 'el código del duplicado (9999) no pisa el de la línea');
    const d = decidir(r);
    assert.equal(d.estado, esperado, dup);
    assert.equal(d.subsanar, subsanar, dup);
  }
});

// ═════════════════════════════════════════════════ ② RECHAZADO

test('SCRUM-1127 · rechazado: EstadoEnvio Incorrecto → rechazado, y el registro NO se reintenta solo', async () => {
  const s = await servidor(responder(200, respuesta({
    estadoEnvio: 'Incorrecto', csv: null, lineas: [linea({ estado: 'Incorrecto', codigo: '1239', desc: 'El NIF no esta identificado' })],
  })));
  const { r, eventos } = await enviar(s.url);
  assert.equal(r.tipo, 'rechazado');
  assert.equal(r.porque, 'estado_envio_incorrecto');
  const d = decidir(r);
  assert.equal(d.estado, 'rejected');
  assert.equal(d.reintentarEnS, null, 'reenviar lo mismo daría el mismo rechazo');
  assert.equal(d.requierePersona, true);
  assert.equal(eventos.at(-1).resultado, 'rechazado');
});

test('SCRUM-1127 · error interno del servidor con SOAP Fault → rechazado por fault, con su texto', async () => {
  const s = await servidor(responder(500, FAULT));
  const { r } = await enviar(s.url);
  assert.equal(r.tipo, 'rechazado');
  assert.equal(r.porque, 'soap_fault');
  assert.equal(r.httpStatus, 500);
  assert.equal(r.faultcode, 'env:Client');
  assert.match(r.faultstring, /4102/);
  const d = decidir(r);
  assert.equal(d.estado, 'rejected');
  assert.match(d.lastError, /^soap_fault:env:Client:Codigo\[4102\]/);
});

// ═════════════════════════════════════════════════ ③ SIN RESPUESTA: enviado y no sabemos

test('SCRUM-1127 · error interno del servidor SIN sobre (HTML de un 500) → sin_respuesta en interpretar', async () => {
  const s = await servidor(responder(500, '<html><body>Internal Server Error</body></html>'));
  const { r } = await enviar(s.url);
  assert.equal(r.tipo, 'sin_respuesta');
  assert.equal(r.etapa, 'interpretar');
  assert.match(r.motivo, /^http_500:sin_sobre_soap$/);
  const d = decidir(r);
  assert.equal(d.estado, 'pending', 'no sabemos si llegó: se reenvía tal cual (FAQ AEAT)');
  assert.equal(d.intentos, 1);
});

test('SCRUM-1127 · respuesta que NO es XML → sin_respuesta en interpretar, nunca aceptado', async () => {
  const s = await servidor(responder(200, 'Service Unavailable'));
  const { r } = await enviar(s.url);
  assert.equal(r.tipo, 'sin_respuesta');
  assert.equal(r.etapa, 'interpretar');
  assert.equal(r.motivo, 'http_200:no_es_xml');
});

test('SCRUM-1127 · respuestas que no se saben leer → sin_respuesta, cada una con su motivo', async () => {
  const casos = [
    [respuesta({ estadoEnvio: 'Estupendo' }), /estado_envio_desconocido:Estupendo/],
    [respuesta({ tiempo: null }), /tiempo_espera_invalido:ausente/],
    [respuesta({ lineas: [linea({ estado: 'Quizas' })] }), /linea_ilegible:Quizas/],
    [respuesta({ lineas: [linea({ estado: 'Incorrecto' })] }), /correcto_con_linea_incorrecta/],
    ['<?xml version="1.0"?><env:Envelope xmlns:env="x"><env:Body><otra/></env:Body></env:Envelope>', /sin_respuesta_regfactu/],
  ];
  for (const [cuerpo, motivo] of casos) {
    const s = await servidor(responder(200, cuerpo));
    const { r } = await enviar(s.url);
    assert.equal(r.tipo, 'sin_respuesta', String(motivo));
    assert.match(r.motivo, motivo);
  }
});

test('SCRUM-1127 · 🔴 NO RESPONDE: el timeout nombra la etapa, y la traza lo dijo ANTES de colgarse', async () => {
  const s = await servidor(() => { /* recibe el sobre y no contesta nunca */ });
  const LIMITE = 400;
  const { r, eventos } = await enviar(s.url, { timeouts: { esperarRespuestaMs: LIMITE } });
  assert.equal(r.tipo, 'sin_respuesta');
  assert.equal(r.etapa, 'esperar_respuesta', '«timeout» a secas no distingue conectar de esperar respuesta');
  assert.equal(r.motivo, `timeout_${LIMITE}ms`);
  assert.equal(s.recibido.length, 1, 'el sobre llegó entero: por eso es sin_respuesta y no no_enviado');

  const esperando = eventos.find((e) => e.evento === 'etapa' && e.etapa === 'esperar_respuesta');
  assert.ok(esperando, 'la traza no dijo que estaba esperando la respuesta');
  assert.ok(esperando.llegoMs < LIMITE,
    `🔴 la traza llegó a los ${esperando.llegoMs} ms: tiene que escribirse AL ENTRAR en la etapa, no al final`);
  assert.equal(decidir(r).estado, 'pending');
});

test('SCRUM-1127 · conexión cortada con el sobre ya entregado → sin_respuesta en esperar_respuesta', async () => {
  const s = await servidor((_req, _c, _res, socket) => socket.destroy());
  const { r } = await enviar(s.url);
  assert.equal(r.tipo, 'sin_respuesta');
  assert.equal(r.etapa, 'esperar_respuesta');
});

test('SCRUM-1127 · respuesta cortada a medias → sin_respuesta en leer_respuesta', async () => {
  const s = await servidor((_req, _c, res, socket) => {
    res.writeHead(200, { 'Content-Type': 'text/xml', 'Content-Length': '5000' });
    res.write('<?xml version="1.0"?><env:Envelope');
    setTimeout(() => socket.destroy(), 30);
  });
  const { r } = await enviar(s.url);
  assert.equal(r.tipo, 'sin_respuesta');
  assert.equal(r.etapa, 'leer_respuesta');
});

test('SCRUM-1127 · respuesta que empieza y no acaba → timeout de leer_respuesta, no de esperar', async () => {
  const s = await servidor((_req, _c, res) => {
    res.writeHead(200, { 'Content-Type': 'text/xml', 'Content-Length': '5000' });
    res.write('<?xml');
  });
  const { r } = await enviar(s.url, { timeouts: { leerRespuestaMs: 300 } });
  assert.equal(r.tipo, 'sin_respuesta');
  assert.equal(r.etapa, 'leer_respuesta');
  assert.equal(r.motivo, 'timeout_300ms');
});

test('SCRUM-1127 · respuesta desmesurada → se corta en leer_respuesta', async () => {
  const s = await servidor(responder(200, respuesta() + ' '.repeat(5000)));
  const { r } = await enviar(s.url, { maxBytesRespuesta: 1000 });
  assert.equal(r.tipo, 'sin_respuesta');
  assert.equal(r.etapa, 'leer_respuesta');
  assert.match(r.motivo, /^respuesta_demasiado_grande>1000$/);
});

// ═════════════════════════════════════════════════ ④ NO ENVIADO: la AEAT no lo tiene

test('SCRUM-1127 · sin endpoint configurado → no_enviado en preparar, sin abrir nada', async () => {
  const leido = cli.leerEndpointDeConfiguracion({});
  assert.deepEqual(leido, { ok: false, motivo: 'endpoint_no_configurado' });
  const { r, eventos } = await enviar('');
  assert.equal(r.tipo, 'no_enviado');
  assert.equal(r.etapa, 'preparar');
  assert.equal(r.motivo, 'endpoint_no_configurado');
  assert.ok(!eventos.some((e) => e.etapa === 'conectar'));
});

test('SCRUM-1127 · endpoints que no se usan: credenciales, query, http hacia fuera, basura', () => {
  const casos = {
    'https://u:clave@servicio.example/ws': 'endpoint_con_credenciales',
    'https://servicio.example/ws?token=1': 'endpoint_con_query',
    'http://servicio.example/ws': 'endpoint_protocolo_no_permitido',
    'ftp://servicio.example/ws': 'endpoint_protocolo_no_permitido',
    'no es una url': 'endpoint_no_es_url',
  };
  for (const [valor, motivo] of Object.entries(casos)) {
    assert.deepEqual(cli.validarEndpoint(valor), { ok: false, motivo }, valor);
  }
  assert.equal(cli.validarEndpoint('https://servicio.example/ws').ok, true);
  assert.equal(cli.validarEndpoint('http://127.0.0.1:9/ws').ok, true, 'http solo a loopback: el servidor falso');
  assert.equal(cli.leerEndpointDeConfiguracion({ [cli.VARIABLE_ENDPOINT]: 'https://servicio.example/ws' }).ok, true);
});

test('SCRUM-1127 · sobre vacío (cero registros) → no_enviado en preparar', async () => {
  const s = await servidor(responder(200, respuesta()));
  const { r } = await enviar(s.url, { cuerpoSoap: '' });
  assert.equal(r.tipo, 'no_enviado');
  assert.equal(r.motivo, 'sobre_vacio');
  assert.equal(s.recibido.length, 0);
});

test('SCRUM-1127 · conexión rechazada → no_enviado en conectar', async () => {
  const p = await puertoCerrado();
  const { r } = await enviar(`http://127.0.0.1:${p}/ws`);
  assert.equal(r.tipo, 'no_enviado');
  assert.equal(r.etapa, 'conectar');
  assert.equal(r.motivo, 'ECONNREFUSED');
  const d = decidir(r);
  assert.equal(d.estado, 'pending');
  assert.match(d.lastError, /^no_enviado:conectar:ECONNREFUSED$/);
});

test('SCRUM-1127 · TLS que no llega a completarse → no_enviado en tls (timeout con su nombre)', async () => {
  const p = await mudo();
  const { r } = await enviar(`https://127.0.0.1:${p}/ws`, { timeouts: { tlsMs: 300 } });
  assert.equal(r.tipo, 'no_enviado');
  assert.equal(r.etapa, 'tls', '🔴 conectó por TCP y se colgó en el apretón de manos: la etapa es tls');
  assert.equal(r.motivo, 'timeout_300ms');
});

test('SCRUM-1127 · TLS contra un servidor que no habla TLS → no_enviado en tls', async () => {
  const s = await servidor(responder(200, respuesta()));
  const { r } = await enviar(s.url.replace('http:', 'https:'), { timeouts: { tlsMs: 2000 } });
  assert.equal(r.tipo, 'no_enviado');
  assert.equal(r.etapa, 'tls');
  assert.equal(s.recibido.length, 0);
});

// ═════════════════════════════════════════════════ ⑤ LO QUE NUNCA SALE EN LA TRAZA

test('SCRUM-1127 · la traza NUNCA lleva el certificado, la clave ni su contraseña', async () => {
  const p = await mudo();
  const SECRETO = 'CONTRASENA-DEL-CERTIFICADO-XYZ';
  // Una clave FALSA que no parece PEM: basta con que no se pueda cargar. Una cabecera PEM de
  // verdad, aunque sea inventada, la caza el escáner de credenciales del historial (SCRUM-835).
  const CLAVE = `CLAVE-FALSA-DE-PRUEBA-${SECRETO}`;
  const { r, eventos } = await enviar(`https://127.0.0.1:${p}/ws`, {
    timeouts: { tlsMs: 200 },
    tls: { passphrase: SECRETO, key: CLAVE },
  });
  // Una clave que no se puede cargar revienta SÍNCRONA dentro de `https.request`: sale por su
  // resultado, no como excepción, y no arrastra la clave en el motivo.
  assert.equal(r.tipo, 'no_enviado');
  assert.equal(r.etapa, 'tls');
  assert.match(r.motivo, /^opciones_tls_invalidas:/);
  const texto = JSON.stringify({ eventos, r });
  assert.ok(eventos.length >= 2, 'CIEGO: sin eventos no se puede decir que no filtre nada');
  assert.ok(!texto.includes(SECRETO), '🔴 la traza lleva el secreto del certificado');
  assert.ok(!texto.includes(CLAVE), '🔴 la traza lleva la clave privada');
});

test('SCRUM-1127 · una traza que revienta no tumba el envío', async () => {
  const s = await servidor(responder(200, respuesta()));
  const r = await cli.enviarSobre({ endpoint: s.url, cuerpoSoap: CUERPO, traza: () => { throw new Error('disco lleno'); } });
  assert.equal(r.tipo, 'respondido');
});

// ═════════════════════════════════════════════════ ⑥ NO ESTÁ CABLEADO A NADA (regla 40)

test('SCRUM-1127 · 🔴 nadie en src/ llama al cliente, y el cliente no lleva ninguna dirección escrita', () => {
  const llamantes = [];
  let vistos = 0;
  const recorrer = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { recorrer(p); continue; }
      if (!e.name.endsWith('.ts')) continue;
      vistos += 1;
      const rel = path.relative(RAIZ, p).replace(/\\/g, '/');
      const fuente = fs.readFileSync(p, 'utf8');
      if (/from\s+['"][^'"]*sif\.client['"]|require\(\s*['"][^'"]*sif\.client['"]/.test(fuente)) llamantes.push(rel);
    }
  };
  recorrer(path.join(RAIZ, 'src'));
  assert.ok(vistos > 100, `CIEGO: solo vi ${vistos} ficheros .ts en src/`);
  // La cola importa sus TIPOS; eso no es llamarlo. Cualquier otro llamante es cablearlo, y
  // cablearlo es el camino de emisión: fase 2, con GO del fundador.
  assert.deepEqual(llamantes, ['src/modules/fiscal/verifactu/sif.cola.ts'],
    '🔴 alguien usa el cliente de envío: cablearlo es camino de emisión (regla 40)');
  const cola = fs.readFileSync(path.join(RAIZ, 'src/modules/fiscal/verifactu/sif.cola.ts'), 'utf8');
  assert.match(cola, /import type \{[^}]*\} from '\.\/sif\.client'/, 'la cola solo importa tipos del cliente');

  const cliente = fs.readFileSync(path.join(RAIZ, 'src/modules/fiscal/verifactu/sif.client.ts'), 'utf8');
  assert.ok(!/https?:\/\/(?!schemas\.xmlsoap\.org)[a-z0-9.-]+\.[a-z]{2,}/i.test(soloCodigo(cliente, 'sif.client.ts')),
    '🔴 el cliente lleva una URL escrita: el endpoint sale de la configuración');
});
