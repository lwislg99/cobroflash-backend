#!/usr/bin/env node
// scripts/censo-anclas-bloque-f.mjs — SCRUM-551
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 ESTE GUARD EXISTE Y TODAVIA NO VIGILA — Y NO ENGANCHARLO ES UNA DECISION, NO UN OLVIDO
// ═════════════════════════════════════════════════════════════════════════════════════════
//
// NO esta enganchado a `pretest` A PROPOSITO. Con los textos como estan HOY este censo da
// ROJO por las afirmaciones sin ancla que encuentra abajo, y ese rojo es CORRECTO: son
// promesas que el producto no cumple. Pero engancharlo hoy bloquearia el CI de TODO EL MUNDO
// por unos textos que ni siquiera estan publicados (las dos secciones van `hidden`).
//
// Se engancha cuando S3 haya reescrito los textos (punto 4 de SCRUM-551, que NO es de este
// PR). Mientras tanto se ejecuta a mano: `npm run censo:anclas-f`.
//
// ⚠️ Un guard que existe y no corre no protege de nada: lo unico que impide que esto se
// olvide es que el rojo esta MEDIDO y escrito en la entrega, y que `package.json` lo declara
// —con su test que lo comprueba—, asi que borrarlo se ve en el diff.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// POR QUE, Y DE DONDE SALE LA REGLA
// ═════════════════════════════════════════════════════════════════════════════════════════
//
// SCRUM-332 (F5) llevaba una regla dura —«UNA FILA SIN ANCLA NO SE ESCRIBE»— y funciono: la
// sesion que escribio la comparativa DESCARTO la fila del cobro con tarjeta porque las reglas
// 18 y 23 lo condicionan a Stripe Connect activo por merchant.
//
// A F4 y a F6 esa regla no se les puso, y la landing acabo prometiendo cosas que no existen.
// El art. 5 LCD (actos de engaño) no distingue entre una tabla y una tarjeta de gremio.
//
// SE REUTILIZA EL MECANISMO DE F5, no se monta un segundo: el ancla es `fichero::simbolo` y
// tiene que EXISTIR en el arbol. No es un estado de Jira —esta sesion no tiene acceso a Jira,
// y un estado que no se puede medir desde el repo no es un ancla, es una promesa sobre otra
// promesa—. Un simbolo que esta en el codigo se comprueba; «Finalizada» en un tablero, no.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// COMO SE DERIVA EL CENSO (y por que no hay lista escrita a mano de textos)
// ═════════════════════════════════════════════════════════════════════════════════════════
//
// La poblacion sale del HTML: TODO elemento de texto dentro de una seccion marcada
// `data-microcopy="PENDIENTE_FUNDADOR"`. Hoy son dos, `#heroe-f4` (F4) y `#gremios` (F6), y
// se descubren por el atributo — si mañana hay una tercera, entra sola.
//
// La correspondencia se exige EN LAS DOS DIRECCIONES, igual que en F5:
//   · unidad en el HTML sin entrada aqui  → 🔴 (nadie ha dicho que sostiene esa frase)
//   · entrada aqui sin unidad en el HTML  → 🔴 (un ancla no puede quedar cubriendo un texto
//     que ya no existe)
//
// Y el TEXTO se guarda con el ancla: si S3 reescribe una frase, el ancla que la sostenia deja
// de valer automaticamente y hay que volver a declararla. Es lo contrario de lo que paso en
// F4 y F6, donde el texto se escribio y nadie volvio a mirar.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const LANDING = 'public/index.html';

/**
 * 🔴 SCRUM-557 · EL ALCANCE SALE DE LA IDENTIDAD DE LAS SECCIONES, NO DE SU MARCADOR.
 *
 * La primera version descubria las secciones por `data-microcopy="PENDIENTE_FUNDADOR"`, y ese
 * atributo hacia DOS trabajos a la vez: marcar que un texto no esta aprobado, y definir el
 * alcance de este censo. La consecuencia se ve al enunciarla: **el dia que se aprueba un texto
 * y se retira el marcador, ese texto SALE DEL CENSO**. Aprobar apagaba la vigilancia sobre lo
 * aprobado — justo cuando pasa a ser publicable.
 *
 * No es hipotetico: el fundador aprobo los 37 textos el 20-ago-2026, y registrar esa aprobacion
 * consiste en retirar los 17 marcadores de `#heroe-f4` y `#gremios`. Con el mecanismo viejo,
 * ese commit habria dejado 17 anclas huerfanas y las tres frases sin ancla sin vigilar.
 *
 * Ahora una seccion deja de censarse cuando **DEJA DE EXISTIR**, no cuando alguien la aprueba:
 * el alcance es esta lista de IDs, y cada id censado tiene que estar en el HTML.
 *
 * ⚠️ LOS DOS MARCADORES NO SE FUSIONAN, y se midio antes de decidirlo (SCRUM-557 punto 1):
 *   · `data-microcopy="PENDIENTE_FUNDADOR"` — sin aprobar Y la seccion va `hidden`, con test
 *     en las dos direcciones (`scrum549`). Retirarlo ES registrar la aprobacion.
 *   · `data-propuesta="microcopy-sin-aprobar"` — el de `#comparativa`, misma idea y otra
 *     grafia.
 * Los dos son marcadores de APROBACION, y por eso ninguno vale como alcance. Unificar su
 * vocabulario es otro trabajo: aqui solo se deja de depender de ellos.
 */
export const SECCIONES_BLOQUE_F = {
  'heroe-f4': { censada: true },
  'gremios': { censada: true },
  // Sus 20 unidades NUNCA han pasado por este censo (SCRUM-555). Meterlas hoy exigiria 20
  // entradas nuevas en el registro y dejaria main en rojo, que es lo que este ticket viene a
  // quitar. Queda DECLARADO fuera, con su ticket: un hueco escrito no es un hueco escondido.
  'comparativa': { censada: false, motivo: 'sus 20 unidades nunca han pasado por el censo → SCRUM-555' },
  // 🔴 SCRUM-557 punto 2 · SALE, y sale POR EL CRITERIO, no por retirarle el atributo a mano.
  // El criterio: este censo vigila el texto del bloque F que esta EN PROPUESTA; `#contacto-publico`
  // es el canal de contacto de F7 y su copy no es una propuesta del bloque F. Su marcador se
  // queda donde esta — retirarlo seria registrar una aprobacion, y eso no es de este ticket.
  // ⚠️ DISCREPANCIA DECLARADA: el comentario de SCRUM-549 en el HTML dice que sus textos SIGUEN
  // sin aprobar (F7-1 a F7-4), mientras que el encargo lo da por aprobado el 20-ago. No se
  // resuelve aqui: en los dos casos SALE de este censo, pero quien lo lea debe saber que las
  // dos fuentes no dicen lo mismo.
  'contacto-publico': { censada: false, motivo: 'F7: canal de contacto, no texto del bloque F en propuesta' },
};

/** Los dos marcadores de aprobacion que hay hoy en la landing. Ninguno define el alcance. */
export const MARCADORES_DE_APROBACION = [
  /data-microcopy="PENDIENTE_FUNDADOR"/,
  /data-propuesta="microcopy-sin-aprobar"/,
];

/** Lo que un texto de propuesta puede declarar. */
export const SIN_CAPACIDAD = 'SIN_CAPACIDAD'; // no afirma que el producto haga nada
export const SIN_ANCLA = 'SIN_ANCLA';         // afirma una capacidad que HOY no existe

/**
 * El registro. Cada unidad de texto de una seccion de propuesta declara qué la sostiene.
 *
 * `anclas`: lista de `fichero::simbolo`, o `SIN_CAPACIDAD`, o `SIN_ANCLA` con su `promete`.
 * `texto`:  la frase tal cual estaba al declararla. Si cambia, el ancla caduca y hay que
 *           volver a mirarla — que es justo lo que no se hizo en F4 y F6.
 */
export const ANCLAS_F = {
  // ── F4 · el heroe ──────────────────────────────────────────────────────────────────────
  'heroe-f4/h1#1': {
    texto: 'Del presupuesto al cobro, sin salir de WhatsApp.',
    anclas: ['src/integrations/whatsapp.ts::sendWhatsAppTemplate'],
  },
  'heroe-f4/p#1': {
    texto: 'Crea el presupuesto en 30 segundos, tu cliente lo firma desde el móvil y te paga — con tarjeta, Bizum o transferencia. No hace falta que te fíes: haz tú el recorrido completo antes de dar tu correo.',
    anclas: SIN_ANCLA,
    // 🔴 F4-3. «con tarjeta» es EXACTAMENTE lo que F5 descarto: reglas 18 y 23 — tarjeta real
    // solo con Stripe Connect activo en ESE merchant, y `PAYMENTS_CONNECT_ENABLED` esta en
    // `false` («OFF hasta CONNECT-1», `src/core/flags.ts`). Bizum va igual: `BIZUM_MANUAL_ENABLED`
    // y `BIZUM_AUTO_ENABLED`, las dos en `false`. De los tres medios que promete la frase, el
    // unico disponible hoy para un merchant real es la transferencia.
    promete: 'CONNECT-1 (PAYMENTS_CONNECT_ENABLED) y C1-4 (BIZUM_MANUAL_ENABLED) — reglas 18 y 23',
  },
  'heroe-f4/p#2': {
    texto: '14 días gratis Sin tarjeta',
    anclas: ['src/modules/auth/domain/auth.service.ts::planExpiresAt'],
  },

  // ── F6 · los gremios ───────────────────────────────────────────────────────────────────
  'gremios/h2#1': { texto: 'El recorrido es el mismo. El trabajo, no.', anclas: SIN_CAPACIDAD },
  'gremios/p#1': { texto: 'Busca el tuyo — así es un día normal con YaQu en la mano.', anclas: SIN_CAPACIDAD },

  'gremios[fontaneria]/h3#1': { texto: 'Fontanería', anclas: SIN_CAPACIDAD },
  'gremios[fontaneria]/p#1': {
    texto: 'Presupuestas un desatasco desde la furgoneta, el cliente firma en su móvil y cobras al terminar — sin volver a casa a hacer papeles.',
    anclas: ['src/modules/quotes/app/routes/quotes.routes.ts::signatureData'],
  },

  'gremios[electricidad]/h3#1': { texto: 'Electricidad', anclas: SIN_CAPACIDAD },
  'gremios[electricidad]/p#1': {
    texto: 'Cambias un cuadro y aparecen dos puntos de luz más. Añades las líneas en la misma escalera, el cliente acepta en el momento y no se quedan sin cobrar.',
    anclas: SIN_ANCLA,
    // 🔴 F6-8. El presupuesto ADICIONAL depende del ROL (`Quote.esAdicional`), y ese campo esta
    // declarado en el schema como PENDIENTE del fundador: `jobId` dice a que trabajo pertenece
    // pero NO si es el original o un adicional, asi que el rol no se puede deducir. El propio
    // `prisma/schema.prisma` lo escribe al lado del campo, citando SCRUM-195.
    promete: 'SCRUM-195 — la mitad pendiente (Quote.esAdicional, schema del fundador)',
  },

  'gremios[reformas]/h3#1': { texto: 'Reformas', anclas: SIN_CAPACIDAD },
  'gremios[reformas]/p#1': {
    texto: 'Una obra de tres semanas y cuatro pagos. Cobras por tramos según avanza y cada parte firmado queda con su fecha.',
    // Las dos mitades de la frase, cada una con su mecanismo: el reparto por tramos y la
    // transicion emitido→firmado del albaran, que es lo que le pone fecha a «cada parte».
    anclas: [
      'src/modules/invoicing/domain/invoiceLines.service.ts::stageLines',
      'src/modules/jobs/domain/albaran.service.ts::canTransitionAlbaran',
    ],
  },

  'gremios[climatizacion]/h3#1': { texto: 'Climatización', anclas: SIN_CAPACIDAD },
  'gremios[climatizacion]/p#1': {
    texto: 'Revisas la caldera antes del invierno. El presupuesto sale de la sala de máquinas y la revisión del año que viene queda anotada sola.',
    // ⚠️ ANCLADA, y con un matiz que se declara en vez de esconderse: el mecanismo EXISTE y lo
    // dispara el cron de verdad (no es una funcion suelta que nadie llama). Lo que gobierna si
    // corre para un merchant concreto es `MAINTENANCE_ENABLED`, que es OPT-IN del merchant, no
    // un «sin construir». Es distinto del caso de la tarjeta, donde la bandera esta OFF porque
    // el mecanismo no esta hecho. Queda anotado para que el fundador lo mire.
    anclas: [
      'src/modules/maintenance/domain/maintenance.service.ts::runMaintenanceProposals',
      'src/core/cron/cron.ts::runMaintenanceProposals',
    ],
  },

  'gremios[cerrajeria]/h3#1': { texto: 'Cerrajería', anclas: SIN_CAPACIDAD },
  'gremios[cerrajeria]/p#1': {
    texto: 'Una apertura a las dos de la mañana. Presupuestas en el portal, el cliente firma en su móvil y cobras antes de recoger la herramienta.',
    anclas: ['src/modules/quotes/app/routes/quotes.routes.ts::signatureData'],
  },

  'gremios[pintura]/h3#1': { texto: 'Pintura', anclas: SIN_CAPACIDAD },
  'gremios[pintura]/p#1': {
    texto: 'Mides el piso y mandas el presupuesto antes de bajar la escalera. La señal entra antes de que compres la pintura.',
    anclas: SIN_ANCLA,
    // 🔴 F6-16. Lo verifico el asesor en Jira el 20-ago: promete SCRUM-142, «Accion del
    // fundador», bloqueado por el dictamen P1.
    // ⚠️ MATIZ MEDIDO EN EL CODIGO, que el informe recoge y que el fundador tiene que arbitrar:
    // COBRAR una señal si existe (el plan de tramos reparte y el primer tramo es la señal);
    // lo que SCRUM-142 tiene bloqueado es EMITIR la factura de anticipo. Si la frase se lee
    // como «el dinero entra», el mecanismo esta; si se lee como «con su factura», no.
    promete: 'SCRUM-142 — emisión del anticipo, bloqueada por el dictamen P1',
  },
};

/**
 * Marcas de que un texto AFIRMA UNA CAPACIDAD del producto.
 *
 * NO deciden el veredicto —eso lo decide el registro—, sirven de contraste: una unidad
 * declarada `SIN_CAPACIDAD` que lleve una de estas dentro es 🔴. Sin eso, `SIN_CAPACIDAD`
 * seria una puerta de escape para colar cualquier promesa sin ancla, y una puerta que existe
 * se acaba usando.
 */
export const MARCAS_CAPACIDAD = [
  /\bcobras?\b/i, /\bpaga\b/i, /\btarjeta\b/i, /\bbizum\b/i, /\btransferencia\b/i,
  /\bseñal\b/i, /\btramos?\b/i, /\bfirma(?:do)?\b/i, /\bacepta\b/i,
  /\bqueda anotad/i, /\bcaduca\b/i, /\bañades\b/i, /\bpresupuestas?\b/i,
];

const limpiar = (s) => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Las secciones del bloque F que este censo vigila, buscadas POR SU ID.
 *
 * ⚠️ La etiqueta se busca tolerando atributos y en varias lineas: `#contacto-publico` abre su
 * `<section>` repartido en seis lineas, y `#heroe-f4` lleva la `class` ANTES del `id`. Asumir
 * que la etiqueta viene desnuda o en una sola linea es el defecto de SCRUM-553.
 */
export function bloquesDePropuesta(html) {
  const out = [];
  for (const [id, cfg] of Object.entries(SECCIONES_BLOQUE_F)) {
    if (!cfg.censada) continue;
    const re = new RegExp(`<section[^>]{0,400}?\\bid="${id}"[\\s\\S]{0,400}?>`);
    const m = re.exec(html);
    if (!m) { out.push({ id, cuerpo: null, ausente: true }); continue; }
    const fin = html.indexOf('</section>', m.index);
    out.push({ id, cuerpo: html.slice(m.index, fin === -1 ? html.length : fin) });
  }
  return out;
}

/**
 * Secciones que llevan un marcador de aprobacion y NO estan declaradas en el alcance.
 *
 * Es la red de seguridad: el dia que alguien marque una seccion nueva —como paso con
 * `#contacto-publico` en SCRUM-549— el censo NO la traga en silencio ni la ignora en silencio:
 * obliga a decidir si entra o sale, y a escribirlo.
 */
export function seccionesMarcadasSinDeclarar(html) {
  const out = [];
  for (const m of html.matchAll(/<section([^>]{0,400}?|[\s\S]{0,400}?)>/g)) {
    const abre = m[0];
    if (!MARCADORES_DE_APROBACION.some((re) => re.test(abre))) continue;
    const id = /\bid="([^"]+)"/.exec(abre)?.[1] || '(sin-id)';
    if (!(id in SECCIONES_BLOQUE_F)) out.push(id);
  }
  return [...new Set(out)];
}

/** Toda unidad de texto visible dentro de las secciones de propuesta. */
export function unidades(html) {
  const out = [];
  for (const b of bloquesDePropuesta(html)) {
    if (!b.cuerpo) continue; // ausente: lo denuncia `censar`
    const cuenta = {};
    for (const m of b.cuerpo.matchAll(/<(h1|h2|h3|p|li)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
      const texto = limpiar(m[2]);
      if (!texto) continue;
      // ¿de qué tarjeta viene? — el último `data-gremio` que quedó por detrás
      const gremio = [...b.cuerpo.slice(0, m.index).matchAll(/data-gremio="([^"]+)"/g)].pop()?.[1] || '';
      const clave = `${b.id}${gremio ? `[${gremio}]` : ''}/${m[1]}`;
      cuenta[clave] = (cuenta[clave] || 0) + 1;
      out.push({ id: `${clave}#${cuenta[clave]}`, texto, bloque: b.id, gremio });
    }
  }
  return out;
}

/** ¿Existe `fichero::simbolo`? El fichero tiene que estar Y contener el símbolo. */
export function anclaViva(ancla, raiz) {
  const [rel, simbolo] = String(ancla).split('::');
  if (!rel || !simbolo) return { viva: false, motivo: `ancla mal formada: «${ancla}» (falta ::)` };
  const abs = path.join(raiz, rel);
  if (!fs.existsSync(abs)) return { viva: false, motivo: `no existe el fichero ${rel}` };
  if (!fs.readFileSync(abs, 'utf8').includes(simbolo)) {
    return { viva: false, motivo: `${rel} ya no contiene «${simbolo}»` };
  }
  return { viva: true };
}

/**
 * `registro` se puede inyectar. No es un adorno: la rama que castiga declarar `SIN_CAPACIDAD`
 * una frase que SI afirma una capacidad solo se alcanza con un registro mal declarado, y sin
 * poder inyectarlo esa rama no la ejercitaria nadie — se podria borrar entera con la suite en
 * verde, que es justo el hueco que SCRUM-388 documenta.
 */
export function censar({ html, raiz, registro = ANCLAS_F }) {
  const us = unidades(html);
  const problemas = [];
  const sinAncla = [];

  // 🔴 SCRUM-557 · UNA SECCION DEJA DE CENSARSE CUANDO DEJA DE EXISTIR, no cuando se aprueba.
  //    Si esta declarada `censada` y no aparece en el HTML, es rojo: o se retiro de verdad —y
  //    entonces hay que retirarla tambien de `SECCIONES_BLOQUE_F` y sus anclas— o alguien le
  //    cambio el id y el censo se ha quedado mirando al vacio sin decirlo.
  const bloques = bloquesDePropuesta(html);

  // 🔴 CEGUERA: si NINGUNA de las secciones censadas existe, no es que el bloque F esté limpio —
  //    es que no se ha podido mirar. Los dos dan «0 unidades» y significan lo contrario, así que
  //    se distinguen aquí y no se dejan al llamante.
  if (bloques.length > 0 && bloques.every((b) => b.ausente)) {
    return {
      ok: false, ciego: true, unidades: 0, sinAncla: [],
      salida: '🔴 CIEGO: ninguna de las secciones declaradas del bloque F ('
        + bloques.map((b) => '#' + b.id).join(', ') + ') está en el HTML. O el fichero no es la '
        + 'landing, o les han cambiado el id a todas. Un cero de unidades aquí se leería como '
        + '«ninguna promesa sin ancla», que es la conclusión más cara.',
    };
  }

  for (const b of bloques) {
    if (b.ausente) {
      problemas.push(`SECCION DECLARADA QUE NO EXISTE: #${b.id}\n`
        + '      → o le han cambiado el id (arréglalo en `SECCIONES_BLOQUE_F`), o se retiró la '
        + 'sección (y entonces retira también sus anclas: un ancla sin sección no describe nada).');
    }
  }

  // 🔴 LA RED DE SEGURIDAD. El dia que alguien marque una seccion nueva —como paso con
  //    `#contacto-publico` en SCRUM-549— el censo no la traga ni la ignora en silencio.
  for (const id of seccionesMarcadasSinDeclarar(html)) {
    problemas.push(`SECCION MARCADA Y SIN DECLARAR: #${id}\n`
      + '      → lleva un marcador de aprobación y no está en `SECCIONES_BLOQUE_F`. Decide si '
      + 'entra al censo o no, y ESCRÍBELO con su motivo. No decidir es dejarla sin vigilar.');
  }

  // SUELO: si no se ve ninguna unidad, el cero de abajo es ceguera y no limpieza.
  if (us.length === 0 && problemas.length === 0) {
    return {
      ok: false, ciego: true, unidades: 0, sinAncla,
      salida: '🔴 CIEGO: no se ha encontrado NI UNA unidad de texto en secciones '
        + '`data-microcopy="PENDIENTE_FUNDADOR"`. O el atributo cambió, o el extractor se rompió. '
        + 'Un cero aquí se leería como «no hay ninguna promesa sin ancla», que es la conclusión '
        + 'más cara que puede dar este fichero.',
    };
  }

  for (const u of us) {
    const reg = registro[u.id];
    if (!reg) {
      problemas.push(`${u.id} — SIN DECLARAR\n      texto: «${u.texto.slice(0, 120)}»\n`
        + '      → nadie ha dicho qué mecanismo sostiene esta frase. Decláralo en `ANCLAS_F`.');
      continue;
    }
    if (reg.texto !== u.texto) {
      problemas.push(`${u.id} — EL TEXTO CAMBIÓ y su ancla caducó\n      ahora: «${u.texto.slice(0, 120)}»\n`
        + `      antes: «${String(reg.texto).slice(0, 120)}»\n`
        + '      → una frase nueva necesita que alguien vuelva a mirar qué la sostiene.');
      continue;
    }
    if (reg.anclas === SIN_CAPACIDAD) {
      const marca = MARCAS_CAPACIDAD.find((re) => re.test(u.texto));
      if (marca) {
        problemas.push(`${u.id} — declarada SIN_CAPACIDAD y afirma una\n      texto: «${u.texto.slice(0, 120)}»\n`
          + `      → contiene ${marca}. \`SIN_CAPACIDAD\` no es una puerta de escape.`);
      }
      continue;
    }
    if (reg.anclas === SIN_ANCLA) {
      sinAncla.push({ id: u.id, texto: u.texto, promete: reg.promete || '(sin declarar)' });
      problemas.push(`${u.id} — 🔴 AFIRMA UNA CAPACIDAD SIN ANCLA\n      texto: «${u.texto}»\n`
        + `      promete: ${reg.promete || '(sin declarar)'}`);
      continue;
    }
    for (const a of reg.anclas) {
      const v = anclaViva(a, raiz);
      if (!v.viva) {
        problemas.push(`${u.id} — ANCLA MUERTA (${a})\n      ${v.motivo}\n`
          + '      → o el mecanismo se movió (actualiza el ancla), o se retiró (y entonces la frase '
          + 'ya no es cierta y hay que retirarla).');
      }
    }
  }

  // La otra dirección: un ancla que ya no cubre ninguna unidad.
  const vistos = new Set(us.map((u) => u.id));
  for (const id of Object.keys(registro)) {
    if (!vistos.has(id)) {
      problemas.push(`${id} — ANCLA SIN TEXTO\n      → está declarada aquí y no hay ninguna unidad `
        + 'con ese id en el HTML. Retírala: un ancla que sobrevive a su frase deja de describir nada.');
    }
  }

  return {
    ok: problemas.length === 0,
    ciego: false,
    unidades: us.length,
    sinAncla,
    salida: [
      `unidades de texto en secciones de propuesta: ${us.length}`,
      `bloques: ${bloquesDePropuesta(html).map((b) => b.id).join(', ')}`,
      ...(problemas.length ? ['', '🔴 PROBLEMAS:', ...problemas.map((p) => '   · ' + p)] : ['', '✅ todas las unidades tienen su ancla viva.']),
    ].join('\n'),
  };
}

export function censarEnDisco(raiz = process.cwd()) {
  return censar({ html: fs.readFileSync(path.join(raiz, LANDING), 'utf8'), raiz });
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────
// `pathToFileURL` y no comparar rutas a mano: en Windows `import.meta.url` trae `/C:/…` y
// cualquier comparacion de cadenas falla en silencio — el CLI no se ejecutaria y nadie lo notaria.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const r = censarEnDisco(process.cwd());
  console.log(r.salida);
  if (!r.ok) {
    console.log('\n🔴 Este censo NO está enganchado a `pretest` todavía (ver la cabecera).');
    console.log('   El rojo de arriba es CORRECTO y lo reescribe S3 en el punto 4 de SCRUM-551.');
    process.exit(1);
  }
}
