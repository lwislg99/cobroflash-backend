// tests/scrum475-firma-del-webhook.test.mjs — SCRUM-475 (fase 2A)
//
// ¿NOS LO MANDA EL PROVEEDOR, O CUALQUIERA?
//
// ── QUÉ VIGILA ESTE FICHERO Y QUÉ NO ──────────────────────────────────────────────────────
// La fase 1 vigila que haya UN emisor y que el acuse no se tire (`scrum475-un-solo-emisor`). La
// fase 2 vigila el VOCABULARIO y el censo de mudos (`scrum475-constancia-correo`). Los dos siguen
// verdes y aquí no se repiten.
//
// Éste vigila lo único que las otras dos no podían: que **el aviso venga de quien dice venir**.
//
// 🔴 POR QUÉ IMPORTA MÁS QUE UN CHECK: `entregado`, `rebotado` y `reclamado` son los tres estados
// que nuestro propio envío NO PUEDE producir — `constanciaCorreo.ts` lo fija con un test aparte.
// Solo los produce un aviso del proveedor. Si la firma no se comprueba, **cualquiera con la URL nos
// dice que un correo se entregó y el producto se lo cree**: la constancia entera pasa a valer cero,
// y peor que cero, porque parece que la tienes.
//
// ── NINGÚN SECRETO REAL, EN NINGÚN SITIO ──────────────────────────────────────────────────
// El secreto de cada test se GENERA al vuelo con `randomBytes`. No hay ninguno escrito aquí, ni de
// ejemplo, ni en un comentario — y el módulo no lee configuración: el secreto le entra por
// parámetro, que es lo que permite probarlo entero sin entorno.
//
// ── 🔴 LA FIRMA SE CONSTRUYE AQUÍ A MANO, Y A PROPÓSITO ───────────────────────────────────
// Si el test pidiera al módulo que firmara y luego que verificara, probaría que **está de acuerdo
// consigo mismo** — verde con el formato equivocado. Aquí la firma se arma con `node:crypto`
// directamente, siguiendo el esquema documentado, y hay un test que FIJA EL FORMATO: una firma
// calculada sobre el mismo contenido en otro orden (`ts.id.cuerpo`) NO puede valer. Sin ese
// control, el módulo podría estar firmando cualquier cosa mientras los dos lados coincidieran.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const {
  verificarFirmaResend, estadoDelAviso, EVENTOS_RESEND, TOLERANCIA_MS, CABECERAS,
} = await import('../dist/integrations/firmaResend.js');

// ── Utillaje: el esquema documentado, escrito aquí de forma independiente ────────────────

/** Un secreto de PRUEBA, distinto en cada llamada. Nunca uno real, nunca uno fijo. */
const secretoDePrueba = () => 'whsec_' + crypto.randomBytes(24).toString('base64');

const claveDe = (secreto) => Buffer.from(secreto.replace(/^whsec_/, ''), 'base64');

/** HMAC del esquema: base64( HMAC-SHA256( clave, `id.ts.cuerpo` ) ). */
function firmar(secreto, id, ts, cuerpo) {
  const partes = [`${id}.${ts}.`, cuerpo];
  const bloque = Buffer.concat(partes.map((p) => (Buffer.isBuffer(p) ? p : Buffer.from(p, 'utf8'))));
  return crypto.createHmac('sha256', claveDe(secreto)).update(bloque).digest('base64');
}

const SEGUNDOS = (ms) => String(Math.floor(ms / 1000));

/** Un aviso legítimo, firmado. `ahora` fija el reloj para que la ventana sea determinista. */
function avisoFirmado({ secreto, ahora, cuerpo, evento = 'email.delivered' }) {
  const id = 'msg_' + crypto.randomBytes(6).toString('hex');
  const ts = SEGUNDOS(ahora);
  const crudo = cuerpo ?? Buffer.from(JSON.stringify({ type: evento, data: { email_id: 'x' } }), 'utf8');
  return {
    cabeceras: {
      'svix-id': id,
      'svix-timestamp': ts,
      'svix-signature': `v1,${firmar(secreto, id, ts, crudo)}`,
    },
    cuerpoCrudo: crudo,
    secreto,
    ahora,
  };
}

const AHORA = Date.UTC(2026, 7, 12, 12, 0, 0); // instante fijo: la ventana no depende del reloj real

// ── CONTROL POSITIVO ─────────────────────────────────────────────────────────────────────

test('SCRUM-475 · CONTROL POSITIVO: una firma válida se acepta', () => {
  const secreto = secretoDePrueba();
  const v = verificarFirmaResend(avisoFirmado({ secreto, ahora: AHORA }));
  assert.equal(v.ok, true,
    `🔴 un aviso legítimo se está rechazando: ${v.ok === false ? `${v.clase}/${v.motivo} — ${v.detalle}` : ''}\n` +
    '  Un verificador que rechaza lo bueno se acaba desactivando, y entonces no verifica nada.');
  assert.equal(v.cuerpo.type, 'email.delivered', '🔴 el cuerpo verificado no llega a quien lo consume.');
  assert.equal(v.emitidoEn.getTime(), AHORA, '🔴 el instante del aviso no viaja en el veredicto.');
});

test('SCRUM-475 · CONTROL POSITIVO: un cuerpo con acentos y emoji verifica (se firman BYTES, no texto)', () => {
  // Si el módulo concatenara cadenas en vez de bytes, esto casaría o no según la codificación que
  // eligiera — y fallaría en producción con el primer asunto que lleve una eñe.
  const secreto = secretoDePrueba();
  const cuerpo = Buffer.from(JSON.stringify({ type: 'email.bounced', razón: 'buzón lleno ✉️' }), 'utf8');
  const v = verificarFirmaResend(avisoFirmado({ secreto, ahora: AHORA, cuerpo }));
  assert.equal(v.ok, true, '🔴 un cuerpo no-ASCII rompe la verificación: se están firmando cadenas, no bytes.');
});

test('SCRUM-475 · CONTROL POSITIVO: durante una rotación valen DOS firmas y basta con que case una', () => {
  const secreto = secretoDePrueba();
  const a = avisoFirmado({ secreto, ahora: AHORA });
  const viejaQueYaNoVale = crypto.randomBytes(32).toString('base64');
  a.cabeceras['svix-signature'] = `v1,${viejaQueYaNoVale} ${a.cabeceras['svix-signature']}`;
  assert.equal(verificarFirmaResend(a).ok, true,
    '🔴 con dos firmas en la cabecera (lo normal al rotar el secreto) se rechaza el aviso bueno.');
});

// ── 🔴 LOS CUATRO RECHAZOS, Y QUE NO CAIGAN POR EL MISMO SITIO ──────────────────────────

test('SCRUM-475 · 🔴 firma incorrecta · cabecera ausente · fuera de ventana · cuerpo alterado NO dan el mismo resultado', () => {
  const secreto = secretoDePrueba();
  const veredictos = {};

  // ① firma incorrecta: la cabecera no trae nada comparable.
  const a1 = avisoFirmado({ secreto, ahora: AHORA });
  a1.cabeceras['svix-signature'] = 'basura-sin-forma';
  veredictos.firma_incorrecta = verificarFirmaResend(a1);

  // ② cabecera ausente.
  const a2 = avisoFirmado({ secreto, ahora: AHORA });
  delete a2.cabeceras['svix-id'];
  veredictos.cabecera_ausente = verificarFirmaResend(a2);

  // ③ repetición: el aviso es legítimo y su firma sigue siendo válida — solo que es de ayer.
  const a3 = avisoFirmado({ secreto, ahora: AHORA - 24 * 60 * 60 * 1000 });
  a3.ahora = AHORA;
  veredictos.fuera_de_ventana = verificarFirmaResend(a3);

  // ④ cuerpo alterado DESPUÉS de firmar: la firma es la del cuerpo original.
  const a4 = avisoFirmado({ secreto, ahora: AHORA });
  a4.cuerpoCrudo = Buffer.from(JSON.stringify({ type: 'email.delivered', inyectado: true }), 'utf8');
  veredictos.cuerpo_alterado = verificarFirmaResend(a4);

  for (const [caso, v] of Object.entries(veredictos)) {
    assert.equal(v.ok, false, `🔴 «${caso}» se ACEPTA. Es una vía para colarnos un aviso falso.`);
  }

  const salidas = Object.fromEntries(
    Object.entries(veredictos).map(([k, v]) => [k, `${v.clase}/${v.motivo}`]));

  assert.deepEqual(salidas, {
    firma_incorrecta: 'RECHAZADO/firma_ilegible',
    cabecera_ausente: 'NO_SE_PUDO_COMPROBAR/falta_cabecera',
    fuera_de_ventana: 'RECHAZADO/fuera_de_ventana',
    cuerpo_alterado: 'RECHAZADO/firma_no_coincide',
  }, '🔴 los cuatro rechazos NO están saliendo cada uno por su camino.\n\n' +
     `  vistos: ${JSON.stringify(salidas, null, 2)}\n\n` +
     '  Si los cuatro dan lo mismo, no se ha verificado nada: solo se ha comprobado que ALGO falla,\n' +
     '  y el día que el secreto de Railway esté mal pegado se buscará el fallo en el proveedor.');

  assert.equal(new Set(Object.values(salidas)).size, 4,
    '🔴 dos de los cuatro escenarios comparten salida: dejan de ser distinguibles en un log.');
});

test('SCRUM-475 · 🔴 EL LÍMITE, dicho y no fingido: firma bien formada pero falsa == cuerpo alterado', () => {
  // Un HMAC no dice POR QUÉ no casó — es lo que es un MAC. Un tercero que mande una firma con la
  // forma correcta cae en `firma_no_coincide`, igual que un cuerpo manipulado. Inventar aquí una
  // distinción sería peor que no tenerla: haría creer que el log separa un ataque de un fallo
  // nuestro. Lo que SÍ queda es el diagnóstico de qué se firmó, y está en el detalle.
  const secreto = secretoDePrueba();
  const a = avisoFirmado({ secreto, ahora: AHORA });
  a.cabeceras['svix-signature'] = `v1,${crypto.randomBytes(32).toString('base64')}`;
  const v = verificarFirmaResend(a);

  assert.equal(`${v.clase}/${v.motivo}`, 'RECHAZADO/firma_no_coincide',
    '🔴 una firma bien formada pero falsa tiene que caer por «se comparó y no da».');
  assert.match(v.detalle, /NO permite distinguirlos/,
    '🔴 el detalle ya no declara que el esquema no distingue firma falsa de cuerpo alterado. Ese ' +
    'límite se dice: si se calla, alguien leerá el motivo como un diagnóstico que no es.');
  assert.match(v.detalle, /bytes/,
    '🔴 el detalle no dice qué se firmó (id, ts, tamaño). Es lo único que queda para depurar.');
});

test('SCRUM-475 · cada una de las TRES cabeceras que falte se nombra por su nombre', () => {
  const secreto = secretoDePrueba();
  for (const cabecera of CABECERAS) {
    const a = avisoFirmado({ secreto, ahora: AHORA });
    delete a.cabeceras[cabecera];
    const v = verificarFirmaResend(a);
    assert.equal(v.clase, 'NO_SE_PUDO_COMPROBAR',
      `🔴 sin «${cabecera}» se dice «firma inválida», y no lo es: no había con qué comprobar.`);
    assert.match(v.detalle, new RegExp(cabecera),
      `🔴 falta «${cabecera}» y el mensaje no la nombra: obliga a adivinar cuál de las tres es.`);
  }
});

// ── 🔴 EL SUELO: «no se pudo comprobar» NUNCA es «firma inválida» ───────────────────────

test('SCRUM-475 · 🔴 SUELO: sin secreto se rechaza, pero DICIENDO que no se pudo comprobar', () => {
  const a = avisoFirmado({ secreto: secretoDePrueba(), ahora: AHORA });
  for (const vacio of [undefined, null, '', '   ']) {
    const v = verificarFirmaResend({ ...a, secreto: vacio });
    assert.equal(v.ok, false,
      '🔴 SIN SECRETO SE ESTÁ ACEPTANDO EL AVISO. Cualquiera con la URL puede decirnos que un ' +
      'correo se entregó. Fail-closed o esto no sirve.');
    assert.equal(v.clase, 'NO_SE_PUDO_COMPROBAR',
      '🔴 «falta el secreto» se está reportando como firma inválida. Son cosas distintas: una es ' +
      'nuestra configuración y la otra es alguien mandando basura. Confundirlas hace imposible ' +
      'depurar el día que el secreto esté mal puesto en Railway.');
    assert.equal(v.motivo, 'sin_secreto');
  }
});

test('SCRUM-475 · 🔴 SUELO: un secreto mal pegado dice `secreto_ilegible`, no «no coincide»', () => {
  const a = avisoFirmado({ secreto: secretoDePrueba(), ahora: AHORA });
  for (const roto of ['whsec_no-es-base64!!', 'whsec_', 'whsec_====']) {
    const v = verificarFirmaResend({ ...a, secreto: roto });
    assert.equal(v.clase, 'NO_SE_PUDO_COMPROBAR');
    assert.equal(v.motivo, 'secreto_ilegible',
      `🔴 con el secreto «${roto}» se dice que la firma no casa. Es lo más probable que pase el ` +
      'primer día —un pegado con un espacio de más— y mandaría a buscar el fallo al proveedor.');
  }
});

test('SCRUM-475 · 🔴 SUELO: el cuerpo ya parseado NO es «firma inválida», es `cuerpo_no_crudo`', () => {
  // Éste es el fallo que el ticket teme: un `express.json()` delante. Si saliera como firma
  // inválida, se buscaría durante horas en el sitio equivocado.
  const secreto = secretoDePrueba();
  const a = avisoFirmado({ secreto, ahora: AHORA });
  for (const noCrudo of [{ type: 'email.delivered' }, a.cuerpoCrudo.toString('utf8'), null, undefined]) {
    const v = verificarFirmaResend({ ...a, cuerpoCrudo: noCrudo });
    assert.equal(v.clase, 'NO_SE_PUDO_COMPROBAR');
    assert.equal(v.motivo, 'cuerpo_no_crudo',
      '🔴 recibir el cuerpo ya parseado se reporta como firma inválida. Es un fallo NUESTRO de ' +
      'montaje, no un aviso falso, y tiene que decirlo.');
    assert.match(v.detalle, /express\.raw/,
      '🔴 el mensaje no dice CÓMO se arregla. Un guard que no enuncia la salida se resuelve mal.');
  }
});

// ── 🔴 EL CUERPO CRUDO, MEDIDO ──────────────────────────────────────────────────────────

test('SCRUM-475 · 🔴 re-serializar el MISMO JSON rompe la firma — la razón del cuerpo crudo, probada', () => {
  // No es teoría: se firma un cuerpo con espacios, se re-serializa igual que haría `express.json()`
  // (mismo objeto, misma semántica) y la firma deja de casar. Esto es lo que justifica que la
  // función exija `Buffer` y que el webhook lleve su propio `express.raw`.
  const secreto = secretoDePrueba();
  const conEspacios = Buffer.from('{\n  "type": "email.delivered",\n  "data": { "email_id": "x" }\n}', 'utf8');
  const a = avisoFirmado({ secreto, ahora: AHORA, cuerpo: conEspacios });

  assert.equal(verificarFirmaResend(a).ok, true, '🔴 el control positivo de este test no vale.');

  const reserializado = Buffer.from(JSON.stringify(JSON.parse(conEspacios.toString('utf8'))), 'utf8');
  assert.notEqual(reserializado.toString('utf8'), conEspacios.toString('utf8'),
    '🔴 el caso no reproduce nada: los dos cuerpos son idénticos.');

  const v = verificarFirmaResend({ ...a, cuerpoCrudo: reserializado });
  assert.equal(v.ok, false,
    '🔴 UN CUERPO RE-SERIALIZADO ESTÁ PASANDO LA FIRMA. Entonces la firma no cubre el cuerpo, y ' +
    'cualquiera puede cambiar el contenido del aviso conservando una firma válida.');
  assert.equal(v.motivo, 'firma_no_coincide');
});

test('SCRUM-475 · 🔴 EL FORMATO ESTÁ FIJADO: firmar `ts.id.cuerpo` en vez de `id.ts.cuerpo` NO vale', () => {
  // Sin esto, el módulo y el test podrían estar de acuerdo en un formato equivocado y los dos en
  // verde — hasta que llegara el primer aviso de verdad.
  const secreto = secretoDePrueba();
  const id = 'msg_orden';
  const ts = SEGUNDOS(AHORA);
  const cuerpo = Buffer.from('{"type":"email.delivered"}', 'utf8');
  const alReves = crypto.createHmac('sha256', claveDe(secreto))
    .update(Buffer.concat([Buffer.from(`${ts}.${id}.`, 'utf8'), cuerpo])).digest('base64');

  const v = verificarFirmaResend({
    cabeceras: { 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': `v1,${alReves}` },
    cuerpoCrudo: cuerpo, secreto, ahora: AHORA,
  });
  assert.equal(v.ok, false,
    '🔴 una firma calculada sobre `ts.id.cuerpo` se acepta: el módulo NO está usando el orden del ' +
    'esquema documentado, y con el proveedor real no casará ni una.');
});

// ── LA VENTANA ──────────────────────────────────────────────────────────────────────────

test('SCRUM-475 · la ventana corta por los dos lados y JUSTO en el borde se acepta', () => {
  const secreto = secretoDePrueba();
  const dentro = avisoFirmado({ secreto, ahora: AHORA - TOLERANCIA_MS + 1000 });
  assert.equal(verificarFirmaResend({ ...dentro, ahora: AHORA }).ok, true,
    '🔴 un aviso dentro de la ventana se rechaza: el proveedor reintenta y todos caerían.');

  const futuro = avisoFirmado({ secreto, ahora: AHORA + TOLERANCIA_MS + 60_000 });
  const v = verificarFirmaResend({ ...futuro, ahora: AHORA });
  assert.equal(v.motivo, 'fuera_de_ventana',
    '🔴 un timestamp del FUTURO pasa. La ventana tiene que cortar por los dos lados: si solo mira ' +
    'el pasado, basta con fechar el aviso mañana para saltarse la protección de repetición.');
});

test('SCRUM-475 · un timestamp que no es un número se dice como tal', () => {
  const secreto = secretoDePrueba();
  const a = avisoFirmado({ secreto, ahora: AHORA });
  a.cabeceras['svix-timestamp'] = 'ayer';
  const v = verificarFirmaResend(a);
  assert.equal(v.motivo, 'timestamp_ilegible',
    '🔴 un timestamp ilegible acaba en «fuera de ventana» o en «no coincide»: los dos mandan a ' +
    'mirar donde no es.');
});

// ── 🔴 EL ROJO POR EL MECANISMO ─────────────────────────────────────────────────────────

test('SCRUM-475 · 🔴 SI ESTO CAE: CUALQUIERA PUEDE MANDARNOS UN AVISO DE ENTREGA', () => {
  // Un tercero que conozca la URL construye el aviso perfecto: el evento que quiere, un id
  // plausible, la hora de ahora mismo. Lo único que no puede fabricar es la firma.
  const secretoNuestro = secretoDePrueba();
  const forjado = avisoFirmado({ secreto: secretoDePrueba(), ahora: AHORA }); // firmado con OTRO secreto
  const v = verificarFirmaResend({ ...forjado, secreto: secretoNuestro });

  assert.equal(v.ok, false,
    '🔴 CUALQUIERA PUEDE MANDARNOS UN AVISO DE ENTREGA.\n\n' +
    '  Un tercero acaba de firmar con un secreto que no es el nuestro y el aviso se ha ACEPTADO.\n' +
    '  `entregado`, `rebotado` y `reclamado` son los tres estados que nuestro propio envío NO puede\n' +
    '  producir: solo los produce un aviso del proveedor. Sin esta comprobación, quien conozca la\n' +
    '  URL decide si una factura «se entregó» — y el profesional lo verá como constancia.\n\n' +
    '  Esto NO es «falta un check»: es que la constancia entera pasa a valer cero, y peor que cero,\n' +
    '  porque parece que la tienes.');
  assert.equal(v.clase, 'RECHAZADO',
    '🔴 un aviso forjado con otro secreto se está contando como «no se pudo comprobar». Sí se pudo: ' +
    'se comprobó y salió que no.');
});

test('SCRUM-475 · nada del cuerpo se toca antes de verificar', () => {
  // Parsear antes de verificar le da al que manda basura un parser gratis y un error que le explica
  // el formato. Un cuerpo que NO es JSON y llega sin firma buena tiene que caer por la firma.
  const secreto = secretoDePrueba();
  const a = avisoFirmado({ secreto, ahora: AHORA });
  const v = verificarFirmaResend({ ...a, cuerpoCrudo: Buffer.from('esto no es json', 'utf8') });
  assert.equal(v.motivo, 'firma_no_coincide',
    '🔴 el cuerpo se está parseando antes de comprobar la firma: el rechazo debería venir de la ' +
    'firma, no del parser.');
});

// ── EL VOCABULARIO (`constanciaCorreo.ts`, cerrado) ─────────────────────────────────────

test('SCRUM-475 · los cuatro eventos del proveedor hablan el vocabulario de la casa', () => {
  assert.deepEqual(
    Object.fromEntries(Object.keys(EVENTOS_RESEND).map((e) => [e, estadoDelAviso(e)])),
    {
      'email.delivered': 'entregado',
      'email.bounced': 'rebotado',
      'email.complained': 'reclamado',
      'email.failed': 'fallo_envio',
    },
    '🔴 el mapeo de eventos ha cambiado. Los estados son un conjunto CERRADO (Parte P, regla 30): ' +
    'si el proveedor añade un evento, se propone el cambio de máster, no se inventa un estado.');
});

test('SCRUM-475 · 🔴 un evento DESCONOCIDO devuelve `null`, no un estado por defecto', () => {
  for (const raro of ['email.opened', 'email.clicked', '', null, undefined, 42, {}]) {
    assert.equal(estadoDelAviso(raro), null,
      `🔴 «${String(raro)}» produce un estado. Un evento que no conocemos tiene que decir «no sé ` +
      'qué es esto»: elegir un estado por defecto es inventarse una constancia que nadie ha dado.');
  }
});

test('SCRUM-475 · 🔴 los tres estados que un envío propio NO puede producir salen SOLO de aquí', () => {
  // Es la razón de ser de este fichero, y lo une con el test de `constanciaCorreo.ts` que fija que
  // un envío aceptado nunca se marca «entregado».
  const soloDelProveedor = ['entregado', 'rebotado', 'reclamado'];
  const producidos = new Set(Object.values(EVENTOS_RESEND));
  for (const estado of soloDelProveedor) {
    assert.ok(producidos.has(estado),
      `🔴 ya no hay ningún aviso del proveedor que produzca «${estado}». Entonces ese estado no lo ` +
      'puede alcanzar nadie y el embudo se queda mudo justo en lo que importa.');
  }
});
