// tests/scrum438-atestiguar.test.mjs — SCRUM-438 (fase 1)
//
// ATESTIGUAR UN SOBRE MIENTRAS TODAVÍA VERIFICA.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE FICHERO VIGILA, Y POR QUÉ CADA COSA
//
// El producto de esta herramienta **ES una afirmación de integridad**. Eso cambia lo que se le
// puede tolerar: en cualquier otro sitio, «no supe mirar» que se lee como «está bien» es un
// defecto; aquí es una prueba falsa. Por eso el SUELO no es un test más, es el corazón.
//
// Y no escribe nada: ni el sobre (regla 29), ni el albarán, ni AuditLog. Se comprueba DERIVANDO
// las llamadas a prisma, no leyendo una promesa — la forma de SCRUM-371.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';
const {
  construirAtestiguamiento, compararConHoy, explicarCambio, SobreIlegibleError, QUE_ES_ESTO,
} = await import(DIST + 'modules/fiscal/evidencias/atestiguamiento.js');
const { RECETAS_POR_VERSION } = await import(DIST + 'modules/jobs/domain/albaranVerificacion.js');

// ── LA FIXTURE: un albarán v:1 cuyo sobre CUADRA de verdad ───────────────────────────────────
//
// El hash se calcula con la RECETA CONGELADA de v:1, no a mano: si se escribiera un hash
// literal, el control positivo pasaría a probar que dos constantes son iguales.
const JOB = { direccion: 'Av. Rey Juan Carlos 145, Leganés', titulo: 'Reforma baño', customerId: 5 };
const CUSTOMER = { name: 'Francisco Jiménez', legalName: null };
const MERCHANT = { name: 'Fontanería Torres', legalName: 'Torres SL', taxId: 'B12345678' };
const BASE = {
  id: 7,
  numero: 'ALB-2026-001',
  fecha: new Date('2026-07-20T10:00:00.000Z'),
  modoValoracion: 'SIN_VALORAR',
  lineas: [{ concepto: 'Bajante PVC 110', cantidad: 3, unidad: 'm' }],
  notas: 'Acceso por el patio',
  lugarEntrega: null,
  fechaEntrega: null,
  firmadoPorNombre: null,
  firmadoPorCalidad: null,
  // SCRUM-409: NO el merchant demo (id 1). Un fixture con el demo dentro acaba probando el
  // camino del watermark sin que nadie lo pida — hay guard, y me cazó al primer intento.
  merchantId: 7,
  jobId: 42,
};

function hashV1(job = JOB) {
  return RECETAS_POR_VERSION[1]({
    numero: BASE.numero, fecha: BASE.fecha, modoValoracion: BASE.modoValoracion,
    lineas: BASE.lineas, notas: BASE.notas,
    jobDireccion: job.direccion, lugarEntrega: null,
    referenciaTrabajo: job.titulo,
    cliente: CUSTOMER.legalName || CUSTOMER.name,
    emisor: MERCHANT.legalName || MERCHANT.name,
    emisorNif: MERCHANT.taxId,
  });
}

const sobreQueCuadra = () => ({ v: 1, canal: 'in_situ', hashAlg: 'sha256', contentHash: hashV1() });
const albaranCon = (evidenciaFirma) => ({ ...BASE, evidenciaFirma });
const atestiguar = (ev, job = JOB) =>
  construirAtestiguamiento({ albaran: albaranCon(ev), job, customer: CUSTOMER, merchant: MERCHANT, ahora: new Date('2026-08-11T09:00:00.000Z') });

// ── CONTROL POSITIVO ─────────────────────────────────────────────────────────────────────────

test('SCRUM-438 · CONTROL POSITIVO: atestigua un sobre que CUADRA, y el registro reproduce la verificación', () => {
  const a = atestiguar(sobreQueCuadra());
  assert.equal(a.resultado.cuadra, true,
    `🔴 el sobre de la fixture NO cuadra (${a.resultado.mensaje}). Si el control positivo no pasa, ` +
    'todos los rojos de abajo podrían estar saliendo por un fixture roto, no por el mecanismo.');
  assert.equal(a.sobre.version, 1);
  assert.equal(a.sobre.contentHash, hashV1(), '🔴 no se registra el hash que se verificó');
  assert.equal(a.albaran.numero, 'ALB-2026-001');
  assert.equal(a.atestiguadoAt, '2026-08-11T09:00:00.000Z', '🔴 el registro no lleva SU fecha');

  // 🔴 Y los CINCO campos vivos quedan registrados con su valor de ese momento: son lo que hace
  // comparable un desajuste futuro. Sin ellos, el atestiguamiento no sirve para nada.
  assert.deepEqual(a.camposVivos, {
    jobDireccion: 'Av. Rey Juan Carlos 145, Leganés',
    referenciaTrabajo: 'Reforma baño',
    cliente: 'Francisco Jiménez',
    emisor: 'Torres SL',
    emisorNif: 'B12345678',
  }, '🔴 no se registran los cinco campos vivos con sus valores: el registro no sería comparable después');

  // El registro reproduce la verificación: recalculando con lo registrado se llega al mismo hash.
  assert.equal(hashV1(), a.sobre.contentHash, '🔴 lo registrado no reproduce la verificación');
});

test('SCRUM-438 · 🔴 el documento DICE QUÉ ES: una verificación fechada, NO una firma', () => {
  const a = atestiguar(sobreQueCuadra());
  assert.equal(a.queEsEsto, QUE_ES_ESTO, '🔴 el documento sale sin decir qué es');
  const t = a.queEsEsto.toLowerCase();
  assert.match(t, /no es un sellado|no es una firma/,
    '🔴 el documento no niega ser una firma. Si lo insinúa es PEOR que no tenerlo: convierte una ' +
    'nota interna en una prueba que nadie puede sostener.');
  assert.match(t, /no añade ninguna garantía criptográfica/,
    '🔴 no dice que no añade garantía criptográfica, que es exactamente lo que un lector podría suponer');
  assert.ok(!/sellad[oa] el|queda sellado|firmado por la plataforma/.test(t),
    '🔴 el texto insinúa que esto sella o firma algo');
});

// ── 🔴 EL SUELO, que aquí es el corazón ──────────────────────────────────────────────────────

test('SCRUM-438 · 🔴 SUELO: si no puede leer el sobre o distinguir la versión, FALLA declarándose ciego', () => {
  const casos = [
    [null, 'no tiene sobre'],
    [undefined, 'no tiene sobre'],
    ['una cadena', 'no es un objeto'],
    [{ canal: 'in_situ', contentHash: 'abc' }, 'sin versión'],
    [{ v: 'uno', contentHash: 'abc' }, 'versión no numérica'],
    [{ v: 99, contentHash: 'abc' }, 'versión que no sabe recalcular'],
    [{ v: 1 }, 'sin contentHash'],
  ];
  for (const [ev, porque] of casos) {
    assert.throws(
      () => atestiguar(ev),
      SobreIlegibleError,
      `🔴 CON «${porque}» EL ATESTIGUAMIENTO SALE ADELANTE. El producto de esta herramienta ES una ` +
      'afirmación de integridad: «verificado» y «no supe mirar» no pueden dar el mismo resultado, ' +
      'o estaríamos emitiendo una prueba falsa.',
    );
  }
  // Y el control de que el suelo no lo está tirando TODO: el sobre bueno sí pasa.
  assert.equal(atestiguar(sobreQueCuadra()).resultado.cuadra, true,
    '🔴 con el sobre bueno también falla: el suelo está rechazando todo y los casos de arriba no prueban nada.');
});

test('SCRUM-438 · un hash que NO cuadra SÍ produce documento — eso sí se ha podido mirar', () => {
  // «No cuadra» y «no pude mirar» son cosas distintas y no pueden salir por la misma puerta: el
  // primero es un hallazgo que hay que poder registrar con su fecha.
  const a = atestiguar({ v: 1, hashAlg: 'sha256', contentHash: crypto.createHash('sha256').update('otra cosa').digest('hex') });
  assert.equal(a.resultado.cuadra, false, '🔴 un hash que no cuadra sale como que cuadra');
  assert.equal(a.resultado.motivo, 'hash_no_coincide');
  assert.ok(a.camposVivos.cliente, '🔴 un hallazgo sale sin los campos vivos, que es lo que permitiría explicarlo');
});

// ── 🔴 ROJO POR EL MECANISMO: cambiar un campo vivo DESPUÉS de atestiguar ─────────────────────

test('SCRUM-438 · 🔴 si cambia uno de los cinco campos, se NOMBRA cuál y que el atestiguamiento es ANTERIOR', () => {
  const a = atestiguar(sobreQueCuadra());

  // El escenario real: alguien renombra el Trabajo (SCRUM-317 tiene escritor desde el 8-ago).
  const hoy = { ...a.camposVivos, referenciaTrabajo: 'Reforma baño y cocina' };
  const cmp = compararConHoy(a, hoy);
  assert.equal(cmp.iguales, false, '🔴 se cambió `referenciaTrabajo` y el mecanismo dice que todo sigue igual');
  assert.deepEqual(cmp.cambiados.map((c) => c.campo), ['referenciaTrabajo'],
    '🔴 no se NOMBRA el campo que cambió, o se nombran de más');
  assert.equal(cmp.cambiados[0].entonces, 'Reforma baño');
  assert.equal(cmp.cambiados[0].ahora, 'Reforma baño y cocina');

  const texto = explicarCambio(a, cmp.cambiados);
  assert.match(texto, /referenciaTrabajo/, '🔴 el informe no nombra el campo');
  assert.match(texto, /ANTERIOR/, '🔴 el informe no dice que el atestiguamiento es anterior al cambio — que es lo único que lo hace útil');
  assert.match(texto, /2026-08-11T09:00:00\.000Z/, '🔴 el informe no lleva la fecha del atestiguamiento');

  // Y la prueba de que esto no es cosmético: con ese campo cambiado, el sobre YA NO VERIFICA.
  const a2 = atestiguar(sobreQueCuadra(), { ...JOB, titulo: 'Reforma baño y cocina' });
  assert.equal(a2.resultado.cuadra, false,
    '🔴 renombrar el Trabajo NO rompe la verificación: entonces el problema que SCRUM-431 midió no existe ' +
    'y este atestiguamiento sobra. Si esto sale verde, revisa el fixture antes que el mecanismo.');

  // Los cinco, uno a uno: ninguno puede quedarse fuera del radar.
  for (const campo of ['jobDireccion', 'referenciaTrabajo', 'cliente', 'emisor', 'emisorNif']) {
    const r = compararConHoy(a, { ...a.camposVivos, [campo]: 'VALOR NUEVO' });
    assert.equal(r.iguales, false, `🔴 un cambio en «${campo}» NO se detecta: ese campo está fuera del radar`);
  }
});

// ── REGLA 29 · NO SE ESCRIBE NADA ────────────────────────────────────────────────────────────

const LECTURAS = new Set(['findMany', 'findUnique', 'findFirst', 'count', 'aggregate', 'groupBy', '$disconnect', '$queryRaw']);

/** Métodos de prisma llamados en un texto. Deriva, no confía en una lista escrita a mano. */
function metodosDePrisma(codigo) {
  return [...codigo.matchAll(/prisma\.\w+\.(\w+)\(|prisma\.(\$\w+)\(/g)].map((m) => m[1] || m[2]);
}

test('SCRUM-438 · 🔴 REGLA 29: la herramienta SOLO LEE — ni el sobre, ni el albarán, ni AuditLog', () => {
  // ⚠️ SOLO LO EJECUTABLE. La primera versión leía el fichero entero y caía sobre **el comentario
  // que explica la prohibición** («tampoco escribe en AuditLog…»). Es SCRUM-349 otra vez, y
  // arreglarlo borrando el comentario sería cobrarle un impuesto a la claridad.
  const cli = soloEjecutable(fs.readFileSync(path.join(RAIZ, 'scripts/atestiguar-sobres.mjs'), 'utf8'), { almohadillaEsComentario: false });
  const metodos = metodosDePrisma(cli);
  assert.ok(metodos.length > 0,
    '🔴 el analizador no ve NINGUNA llamada a prisma. Con un analizador ciego, «no escribe» y «no ' +
    'supe mirar» son la misma respuesta.');
  const escrituras = metodos.filter((m) => !LECTURAS.has(m));
  assert.deepEqual(escrituras, [],
    `🔴 LA HERRAMIENTA ESCRIBE EN LA BASE: ${escrituras.join(', ')}\n\n` +
    '  Un testigo que escribe deja de ser un testigo. Y una evidencia emitida no se altera jamás ' +
    '(regla 29), ni siquiera para «dejarla bien».');

  // EN ROJO: el analizador tiene que ver una escritura si la hay.
  assert.deepEqual(
    metodosDePrisma('await prisma.albaran.update({ where: { id }, data: { evidenciaFirma: x } });').filter((m) => !LECTURAS.has(m)),
    ['update'],
    '🔴 el analizador NO VE una escritura evidente: el guard de arriba no vigila nada');

  // Y el dominio tampoco importa prisma: no tiene con qué escribir.
  const dominio = soloEjecutable(fs.readFileSync(path.join(RAIZ, 'src/modules/fiscal/evidencias/atestiguamiento.ts'), 'utf8'), { almohadillaEsComentario: false });
  assert.ok(!/from '.*core\/db\/prisma'/.test(dominio),
    '🔴 el dominio del atestiguamiento importa `prisma`: ya no es «no escribe porque no tiene con qué».');
  assert.ok(!/recordAudit|AuditAction/.test(dominio),
    '🔴 el atestiguamiento escribe en AuditLog. `AuditAction` es una unión CERRADA y ampliarla es ' +
    'decisión del fundador (regla 5, guard de SCRUM-371), no un detalle de esta herramienta.');
});

// ── LA POLÍTICA DENTRO DEL ZIP ───────────────────────────────────────────────────────────────

test('SCRUM-438 · el texto del alcance es el APROBADO, palabra por palabra (regla 30)', async () => {
  const { POLITICA_SOBRES_ANTERIORES } = await import(DIST + 'modules/fiscal/evidencias/paquete.js');
  assert.equal(
    POLITICA_SOBRES_ANTERIORES,
    'ALCANCE DE ESTA VERIFICACIÓN\n\n' +
    'Este paquete comprueba que el contenido del albarán es el que se firmó.\n\n' +
    'En los sobres de versión 1 y 2, cinco datos no viajan dentro de la firma y se\n' +
    'leen en el momento de verificar: la dirección de la obra, la referencia del\n' +
    'trabajo, el nombre del cliente, y el nombre y el NIF de quien emite.\n\n' +
    'Si alguno de esos cinco ha cambiado desde que se firmó —por ejemplo, al\n' +
    'corregir el nombre de un cliente— esta verificación no puede demostrar que el\n' +
    'resto del documento esté intacto, aunque lo esté. En ese caso el resultado dice\n' +
    'cuál ha cambiado.\n\n' +
    'Esos albaranes se consideran de INTEGRIDAD PARCIAL VERIFICABLE: lo que viaja\n' +
    'dentro de la firma se comprueba; lo que no viaja, no.\n\n' +
    'A partir de la versión 3, los cinco datos viajan dentro de la firma y esta\n' +
    'limitación no se aplica.\n',
    '🔴 el texto del alcance no es el aprobado por el asesor el 11-ago-2026. Se fijó ENTERO: ' +
    'reformularlo es cambio de máster, no una mejora de redacción.',
  );
  assert.ok(!POLITICA_SOBRES_ANTERIORES.includes('[PENDIENTE'),
    '🔴 vuelve el marcador sobre un texto que ya está aprobado');
});

test('SCRUM-438 · 🔴 SEGUNDA CAPA: el alcance no puede insinuar que esto es una firma', async () => {
  // Misma capa que el 409 de SCRUM-358, y por el mismo motivo: la comprobación exacta de arriba
  // se desactiva editando el propio test —que es justo lo que haría alguien «arreglándolo»—, y
  // este invariante sobrevive a eso. Se probó mutando las dos a la vez.
  const { POLITICA_SOBRES_ANTERIORES: t } = await import(DIST + 'modules/fiscal/evidencias/paquete.js');
  const texto = t.toLowerCase();
  for (const prohibido of ['firmado por yaqu', 'sellado por la plataforma', 'certifica', 'garantiza la autenticidad', 'validez legal', 'con plena validez']) {
    assert.ok(!texto.includes(prohibido),
      `🔴 el alcance dice «${prohibido}»: eso INSINÚA que este paquete firma o certifica algo, y no ` +
      'lo hace. Un documento de alcance que promete de más es peor que no tenerlo.');
  }
  // Y lo que SÍ tiene que seguir diciendo: el límite, con su nombre.
  assert.match(texto, /integridad parcial verificable/,
    '🔴 desaparece la calificación que acota el alcance. Sin ella, el paquete se lee como una ' +
    'verificación completa, que es exactamente lo que no es para v:1 y v:2.');
  assert.match(texto, /lo que no viaja, no/,
    '🔴 desaparece la frase que dice qué NO se comprueba: el alcance dejaría de acotar nada');
});

test('SCRUM-438 · 🔴 la política va SIEMPRE dentro del ZIP, cuadren o no los albaranes', async () => {
  // Regla del asesor (11-ago-2026): «un documento que solo aparece con malas noticias se
  // convierte en la mala noticia». Se comprueba con los dos extremos.
  const { construirPaqueteEvidencias, FICHEROS } = await import(DIST + 'modules/fiscal/evidencias/paquete.js');
  // Las formas del fixture salen del banco de SCRUM-297, no se inventan: un fixture a medias
  // reventaba con un TypeError y el rojo habría hablado de mi test, no del paquete.
  const base = {
    libro: { asientos: [], miradas: 0, ajenas: 0, sinNumero: 0, sinNumeroImporte: 0, importesIlegibles: [] },
    modelo303: {
      año: 2026, trimestre: 3, desde: '', hasta: '', moneda: 'EUR',
      casillas: [], casillaTotalCuota: { casilla: 27, valor: 0 }, totalBase: 0,
      sinClasificar: [], sinDesglose: [], cruceConCobros: {}, miradas: 0, asientos: 0,
      motivosParaNoFiarse: [], avisoObligatorio: '',
    },
    merchantId: 7,
    periodo: { desde: '2026-07-01', hasta: '2026-09-30', año: 2026, trimestre: 3 },
  };
  const informe = (hallazgos) => ({ examinados: hallazgos.length, cuadran: 0, censoPorVersion: {}, hallazgos, versionesNoSoportadas: [], conclusion: hallazgos.length ? 'hay_hallazgos' : 'no_se_pudo_mirar' });

  for (const [caso, albaranes, inf] of [
    ['sin hallazgos', [], informe([])],
    ['con un hallazgo', [], informe([{ cuadra: false, numero: 'ALB-1', v: 1, motivo: 'hash_no_coincide', mensaje: 'x' }])],
  ]) {
    const p = construirPaqueteEvidencias({ ...base, albaranes, informeVerificacion: inf });
    const nombres = p.ficheros.map((f) => f.nombre);
    assert.ok(nombres.includes(FICHEROS.politicaSobres),
      `🔴 «${caso}»: el paquete sale SIN el alcance de la verificación. Si solo apareciera cuando ` +
      'algo falla, su presencia sería la señal y habría motivo para quitarla.');
  }
});

// ── EL COMANDO DE PRODUCCIÓN, EN EL PROPIO SCRIPT ────────────────────────────────────────────

test('SCRUM-438 · 🔴 la invocación de producción vive en el `--help` y NO expone la credencial', () => {
  const cli = fs.readFileSync(path.join(RAIZ, 'scripts/atestiguar-sobres.mjs'), 'utf8');
  assert.match(cli, /--help/, '🔴 el script ya no tiene `--help`: la invocación buena vive en otro sitio y se separa');
  // La forma aprobada por el asesor: `read -s` no hace eco ni entra en el historial.
  assert.match(cli, /read -s -p .* DATABASE_URL && export DATABASE_URL/,
    '🔴 el `--help` ya no documenta la invocación aprobada. Sin ella, quien ejecute esto contra ' +
    'producción acabará poniendo la URL en la línea de comandos, que es donde no puede estar.');
  assert.match(cli, /unset DATABASE_URL/,
    '🔴 falta el `unset`: la credencial se quedaría exportada en la sesión después de terminar');
  // Y el ejecutable NO puede llevar la URL en argv, ni siquiera de ejemplo.
  const ejecutable = soloEjecutable(cli, { almohadillaEsComentario: false })
    .replace(/export const AYUDA = `[\s\S]*?`;/, ''); // el texto de ayuda es prosa, no argv
  assert.ok(!/--url|--from-url/.test(ejecutable),
    '🔴 el script pasa la URL como argumento: quedaría en `ps` y en el historial (SCRUM-195)');
});

test('SCRUM-438 · los cinco campos vivos son LOS del sobre, no una lista aparte que envejece', () => {
  // Si un día el sobre leyera un sexto campo vivo, este documento se quedaría corto EN SILENCIO.
  // Se cara contra el adaptador que resuelve las fuentes de verdad.
  const barrido = fs.readFileSync(path.join(RAIZ, 'src/modules/jobs/domain/albaranBarrido.ts'), 'utf8');
  const vivos = ['jobDireccion: job?.direccion', 'referenciaTrabajo: job?.titulo', 'cliente: customer?.legalName', 'emisor: merchant?.legalName', 'emisorNif: merchant?.taxId'];
  for (const v of vivos) {
    assert.ok(barrido.includes(v),
      `🔴 «${v}» ya no se resuelve así en el adaptador. Los campos vivos que este atestiguamiento ` +
      'registra dejarían de ser los que el sobre lee — y el registro se quedaría corto en silencio.');
  }
  const a = atestiguar(sobreQueCuadra());
  assert.deepEqual(Object.keys(a.camposVivos).sort(),
    ['cliente', 'emisor', 'emisorNif', 'jobDireccion', 'referenciaTrabajo'],
    '🔴 el documento registra un juego de campos distinto del medido en SCRUM-431');
});
