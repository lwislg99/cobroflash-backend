// SCRUM-334 (F7) · UN FORMULARIO PUBLICO NO GUARDA UN CORREO SIN CONSENTIMIENTO.
//
// Sin gate: lee fuentes. Ni BD, ni red, ni servidor.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO QUE ESTE FICHERO EXISTE PARA IMPEDIR, Y NO ES HIPOTETICO
//
// F7 pide poder recontactar al que hoy no compra — la obligacion de VeriFactu para autonomos
// es el 1-jul-2027, once meses, y hoy esa gente se pierde entera. La forma obvia de hacerlo
// es una caja de «dejame tu correo y te aviso». Y esa caja, escrita sin pensar, es **una
// infraccion con el test en verde**: guarda igual marque el visitante la casilla o no.
//
// 🔴 LO QUE HACE FALTA ANTES DE CAPTURAR UN CORREO PARA RECONTACTO, medido el 20-ago-2026:
//   · CONSENTIMIENTO explicito y previo (RGPD art. 6.1.a). La ejecucion del contrato (6.1.b)
//     NO cubre el marketing: quien deja el correo «para que le avisen» no ha contratado nada.
//   · La informacion del art. 13 en el momento de recogerlo.
//   · Y que la POLITICA DE PRIVACIDAD lo cubra. Medido hoy en `public/privacidad.html`: las
//     palabras «consentimiento», «marketing», «newsletter» y «baja» **no aparecen ninguna**.
//     Cubre los datos de la cuenta (6.1.b) y los del cliente final, nada mas.
//   → o sea que la caja de recontacto NO se puede encender sin tocar F2, que es de otro carril.
//
// POR ESO ESTE GUARD NO ES UNA LISTA DE RUTAS: es un ANALIZADOR. Una lista describe el hoy y
// se queda callada el dia que alguien añada la ruta numero cuatro — que es justo el dia que
// importa. El analizador mira la FORMA del manejador: si lee un correo y lo persiste sin que
// haya un consentimiento por medio, cae, exista esa ruta hoy o se escriba mañana.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

/** Lee un correo del cuerpo de la peticion. */
const LEE_CORREO = /req\.body\s*\??\.\s*email/;
/** Lo persiste: cualquier escritura de Prisma. `update` cuenta — guardar es guardar. */
/**
 * Una escritura de PRISMA arrastrando su carga: es donde tiene que aparecer el correo.
 *
 * 🔴 EL RECEPTOR (`prisma.` o `tx.`) NO ES DECORACION. Sin el, `crypto.createHash(...)
 * .update(secret)` de `POST /auth/test-login` contaba como escritura, y 400 caracteres mas
 * abajo aparece `E2E_TEST_LOGIN_EMAILS` — o sea que el guard acusaba de guardar un correo a
 * un hash de un secreto, por vecindad. Un guard que acusa en falso se acaba desactivando
 * (SCRUM-182), asi que se acota a lo que de verdad escribe en la base.
 */
const PERSISTE_CON_CARGA = /\b(?:prisma|tx)\s*\.\s*\w+\s*\.\s*(?:create|createMany|createManyAndReturn|upsert|update|updateMany)\s*\([\s\S]{0,400}/g;
/**
 * Hay un consentimiento por medio. La lista es DELIBERADAMENTE amplia —incluye el modelo
 * `LegalAcceptance`, que es donde este repo ya registra aceptaciones— porque un guard que
 * exige una palabra exacta se puentea escribiendo otra, y uno que acusa a codigo correcto
 * acaba desactivado (SCRUM-182). Lo que NO se acepta es que no haya ninguna.
 */
const HAY_CONSENTIMIENTO = /consent|consentimiento|acepta|LegalAcceptance|optIn|opt_in/i;

/**
 * ¿Es este trozo de fuente una captura de correo SIN consentimiento?
 *
 * Se analiza por BLOQUE de manejador (`router.post(...)` hasta el siguiente), no por fichero:
 * si se mirara el fichero entero, un `LegalAcceptance` en otra ruta del mismo router absolveria
 * a la que no lo tiene. Ese era el fallo obvio y por eso se parte.
 */
export function capturasSinConsentimiento(fuente, etiqueta) {
  const out = [];
  // Cada manejador empieza en un `router.<verbo>(` o `app.<verbo>(`.
  const marcas = [...fuente.matchAll(/\b(?:router|app)\s*\.\s*(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]*)['"`]/g)];
  for (let i = 0; i < marcas.length; i++) {
    const desde = marcas[i].index;
    const hasta = i + 1 < marcas.length ? marcas[i + 1].index : fuente.length;
    const cuerpo = fuente.slice(desde, hasta);
    if (!LEE_CORREO.test(cuerpo)) continue;
    if (HAY_CONSENTIMIENTO.test(cuerpo)) continue;
    // 🔴 NO BASTA CON QUE PERSISTA ALGO: TIENE QUE PERSISTIR EL CORREO.
    //
    // La primera version de esta regla decia «lee un correo Y escribe» y acusaba a
    // `POST /auth/test-login`, que lee el correo solo para BUSCAR un merchant que ya existe y
    // luego guarda una sesion cuyos campos son `merchantId/token/type/expiresAt` — ni rastro
    // del correo. Era un acierto de FORMA y un error de FONDO, y la salida correcta no es
    // apuntarlo en una lista de excepciones: es afinar la regla, porque una lista de
    // excepciones crece y termina amparando lo que vino a cazar.
    //
    // Asi que se mira la CARGA de cada escritura: se toma una ventana desde la llamada y se
    // exige que el correo aparezca DENTRO. Buscar por correo no es guardarlo.
    //
    // ⚠️ LO QUE ESTA REGLA NO VE, escrito aqui en vez de descubrirse en un rojo raro: un
    // `data` construido fuera de la llamada (`const datos = {...}; create({ data: datos })`)
    // pasa desapercibido. Se acepta a conciencia — cerrarlo pedia un AST y esto vigila un
    // patron que hoy no existe en el arbol — y queda DECLARADO, no fingido.
    // Se recorta cada escritura con su CARGA (hasta 400 caracteres) y se pregunta si el correo
    // esta dentro. Sin aritmetica de indices a proposito: es lo que fallaba y no se veia.
    const cargas = cuerpo.match(PERSISTE_CON_CARGA) || [];
    const guardaElCorreo = cargas.some((frag) => /email/i.test(frag));
    if (!guardaElCorreo) continue;
    out.push({ ruta: `${marcas[i][1].toUpperCase()} ${marcas[i][2]}`, donde: etiqueta });
  }
  return out;
}

/** Todos los ficheros de rutas de `src/`. */
function ficherosDeRutas() {
  const out = [];
  const anda = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) anda(p);
      else if (/\.routes\.ts$/.test(e.name)) out.push(path.relative(RAIZ, p).replace(/\\/g, '/'));
    }
  };
  anda(path.join(RAIZ, 'src'));
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · «ninguna captura sin consentimiento» y «no supe mirar» dan el mismo verde
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-334 · SUELO: el barrido VE ficheros de rutas y manejadores de verdad', () => {
  const ficheros = ficherosDeRutas();
  assert.ok(ficheros.length >= 15,
    `🔴 CIEGO: solo veo ${ficheros.length} ficheros \`*.routes.ts\` en src/. Si el barrido se `
    + 'rompio, el cero de abajo significa «no mire», no «no hay».');

  let manejadores = 0;
  let leenCorreo = 0;
  for (const f of ficheros) {
    const s = leer(f);
    manejadores += [...s.matchAll(/\b(?:router|app)\s*\.\s*(?:get|post|put|patch|delete)\s*\(/g)].length;
    if (LEE_CORREO.test(s)) leenCorreo += 1;
  }
  assert.ok(manejadores >= 100,
    `🔴 CIEGO: solo ${manejadores} manejadores encontrados. El patron dejo de casar.`);
  assert.ok(leenCorreo >= 1,
    '🔴 CIEGO: ningun fichero de rutas lee `req.body.email`, y `auth.routes.ts` lo hace tres '
    + 'veces. El detector de lectura de correo esta roto.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL ANALIZADOR SABE ACUSAR Y SABE ABSOLVER — antes de creerse su veredicto sobre `src/`
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-334 · CONTROL: el analizador caza la captura sin consentimiento (corpus sintetico)', () => {
  // 🔴 EL CASO QUE IMPORTA: la caja de «te aviso cuando toque VeriFactu», escrita sin pensar.
  //   ⚠️ El modelo del corpus se llama `suscriptor` y NO `merchant` a proposito, y hubo que
  //   quitar tambien la mencion literal de este comentario: SCRUM-113 vigila por TEXTO que
  //   ningun test nuevo cree merchants a mano, y no distingue una creacion de verdad de una
  //   escrita dentro de una cadena de ejemplo — ni de una nombrada al explicarlo. Es la
  //   trampa de autorreferencia que este repo lleva cazada cuatro veces (SCRUM-176/168/3/193).
  //   El analizador de aqui casa cualquier `prisma.<modelo>.create`, asi que el caso se
  //   prueba igual y el guard de al lado no se caza a si mismo.
  const mala = `
    router.post('/public/avisame', async (req, res) => {
      const email = String(req.body?.email || '').trim();
      await prisma.suscriptor.create({ data: { email, name: 'lead' } });
      return res.json({ ok: true });
    });
  `;
  const cazadas = capturasSinConsentimiento(mala, 'sintetico');
  assert.equal(cazadas.length, 1,
    '🔴 EL ANALIZADOR NO VE UNA CAPTURA DE CORREO SIN CONSENTIMIENTO. Es el unico caso que '
    + 'este fichero existe para cazar: si no lo ve, su verde sobre `src/` no vale nada.');
  assert.equal(cazadas[0].ruta, 'POST /public/avisame');

  // Y ABSUELVE a la misma ruta cuando SI hay consentimiento por medio. Sin esto, un analizador
  // que acusara siempre tambien pasaria el caso de arriba, y acusaria a codigo correcto hasta
  // que alguien lo desactivara.
  const buena = mala.replace(
    'const email =',
    'if (!req.body?.consentimiento) return res.status(400).json({ error: "consent_required" });\n      const email =',
  );
  assert.deepEqual(capturasSinConsentimiento(buena, 'sintetico'), [],
    '🔴 acusa a un manejador que SI comprueba el consentimiento: acusaria en falso');

  // 🔴 Y EL SEGUNDO FALSO POSITIVO QUE HUBO QUE CAZAR, tambien sacado del arbol real:
  //   `crypto.createHash(...).update(secret)` NO es una escritura en la base, y a pocas
  //   lineas vive `E2E_TEST_LOGIN_EMAILS`. Sin exigir receptor de Prisma, el guard acusaba
  //   a un hash de guardar un correo — por vecindad de texto, que es la peor razon posible.
  const hashDeUnSecreto = `
    router.post('/auth/test-login', async (req, res) => {
      const email = String(req.body?.email || '').toLowerCase().trim();
      const a = crypto.createHash('sha256').update(req.body?.secret || '').digest();
      const allow = (process.env.E2E_TEST_LOGIN_EMAILS || '').split(',');
      if (!allow.includes(email)) return next();
      return res.json({ ok: true });
    });
  `;
  assert.deepEqual(capturasSinConsentimiento(hashDeUnSecreto, 'sintetico'), [],
    '🔴 acusa a `crypto...update()` de guardar un correo porque hay un EMAILS cerca. Es acusar por vecindad de texto, y un guard que acusa en falso se acaba desactivando.');

  // 🔴 EL CASO QUE DESTAPO EL FALLO DE LA PRIMERA VERSION, y por eso se queda de control:
  //   leer el correo para BUSCAR y guardar OTRA COSA no es capturar un correo. Es la forma
  //   exacta de `POST /auth/test-login` en el arbol real.
  const buscaYGuardaOtraCosa = `
    router.post('/auth/test-login', async (req, res) => {
      const email = String(req.body?.email || '').toLowerCase().trim();
      const merchant = await prisma.merchant.findUnique({ where: { email } });
      await prisma.authSession.create({ data: { merchantId: merchant.id, token, type: 'session' } });
      return res.json({ ok: true });
    });
  `;
  assert.deepEqual(capturasSinConsentimiento(buscaYGuardaOtraCosa, 'sintetico'), [],
    '🔴 acusa a un manejador que usa el correo para BUSCAR y guarda una sesion sin el correo '
    + 'dentro. Buscar por correo no es guardarlo, y confundirlo llena el guard de excepciones.');

  // Y no acusa a quien lee el correo sin guardarlo (un login, un rate-limit).
  const soloLee = `
    router.post('/auth/login', async (req, res) => {
      const email = String(req.body?.email || '').trim();
      await requestMagicLink(email);
      return res.json({ ok: true });
    });
  `;
  assert.deepEqual(capturasSinConsentimiento(soloLee, 'sintetico'), [],
    '🔴 acusa a un manejador que lee el correo pero no persiste nada');

  // Y PARTE POR MANEJADOR: un consentimiento en la ruta de al lado NO absuelve a esta.
  const vecina = `
    router.post('/otra', async (req, res) => { if (req.body.consentimiento) { await prisma.x.create({}); } });
  ` + mala;
  assert.equal(capturasSinConsentimiento(vecina, 'sintetico').length, 1,
    '🔴 el analizador mira el fichero entero: un `consentimiento` en OTRA ruta absuelve a la '
    + 'que no lo tiene. Es el fallo obvio de este diseño y por eso se parte por manejador.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL VEREDICTO SOBRE EL ARBOL REAL
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-334 · 🔴 ninguna ruta guarda un correo sin consentimiento', () => {
  const encontradas = [];
  for (const f of ficherosDeRutas()) encontradas.push(...capturasSinConsentimiento(leer(f), f));

  assert.deepEqual(encontradas.map((e) => `${e.ruta}  (${e.donde})`), [],
    '🔴 HAY UNA RUTA QUE GUARDA UN CORREO SIN CONSENTIMIENTO POR MEDIO.\n\n'
    + '  Esto no es un fallo de estilo: es la infraccion que se comete con el test en verde.\n'
    + '  Un correo capturado «para avisar» no lo cubre la ejecucion del contrato (RGPD 6.1.b),\n'
    + '  porque quien lo deja no ha contratado nada — hace falta CONSENTIMIENTO (6.1.a).\n\n'
    + '  ANTES DE ENCENDER UNA CAPTURA DE CORREO HACEN FALTA TRES COSAS, y dos no son codigo:\n'
    + '   1. la casilla de consentimiento, previa y NO premarcada, y que el guardado dependa\n'
    + '      de ella de verdad (no que se guarde igual y se anote la casilla al lado);\n'
    + '   2. la informacion del art. 13 en el momento de pedirlo;\n'
    + '   3. que `public/privacidad.html` CUBRA esa finalidad. Medido el 20-ago-2026: no la\n'
    + '      cubre — «consentimiento», «marketing», «newsletter» y «baja» no aparecen en ella.\n'
    + '      Eso es F2, otro carril, y lo aprueba el fundador.\n\n'
    + '  Si has llegado aqui añadiendo la caja de recontacto de F7: el mecanismo es correcto,\n'
    + '  lo que falta es la base juridica. No se apaga este guard, se cierra el hueco.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// RATCHET · quien lee un correo en la superficie publica, y con que base
// ═════════════════════════════════════════════════════════════════════════════════════════
//
// Las tres de hoy, medidas, con su base declarada. No es decoracion: el dia que aparezca una
// cuarta, alguien tiene que venir aqui a escribir por que puede leer un correo — y esa frase
// es la que hace pensar. Sin el ratchet, la cuarta entra en silencio si ademas no persiste.

const LECTORES_DECLARADOS = {
  '/auth/login': 'ejecucion del contrato (6.1.b): manda el enlace de acceso a una cuenta que ya existe; no persiste correo nuevo',
  '/auth/register': 'ejecucion del contrato (6.1.b): el visitante PIDE la cuenta; el correo ES el servicio',
  '/auth/test-login': 'interno, triple cerradura (flag + secreto + allowlist); no es superficie de captacion',
};

test('SCRUM-334 · RATCHET: las rutas publicas que leen un correo son las declaradas', () => {
  const fuente = leer('src/modules/auth/app/routes/auth.routes.ts');
  const vistas = [];
  const marcas = [...fuente.matchAll(/\brouter\s*\.\s*(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]*)['"`]/g)];
  for (let i = 0; i < marcas.length; i++) {
    const cuerpo = fuente.slice(marcas[i].index, i + 1 < marcas.length ? marcas[i + 1].index : fuente.length);
    if (LEE_CORREO.test(cuerpo)) vistas.push('/auth' + marcas[i][2]);
  }
  assert.ok(vistas.length >= 1, '🔴 CIEGO: no veo ninguna ruta de auth que lea el correo');
  assert.deepEqual(vistas.sort(), Object.keys(LECTORES_DECLARADOS).sort(),
    '🔴 HA CAMBIADO EL CONJUNTO DE RUTAS PUBLICAS QUE LEEN UN CORREO.\n\n'
    + '  Si has añadido una, escribe aqui su base juridica antes de seguir. Si has quitado una,\n'
    + '  quita tambien su linea: una declaracion que sobrevive a su ruta deja de describir nada.');
});
