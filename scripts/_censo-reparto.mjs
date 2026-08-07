// scripts/_censo-reparto.mjs — SCRUM-387
//
// LA DERIVACIÓN, EN UN SOLO SITIO. La usan el CLI (`censo-reparto.mjs`) y la suite
// (`tests/scrum387-censo-reparto.test.mjs`). Si cada uno tuviera su copia, el día que divergieran
// el censo diría una cosa y su guard confirmaría otra — que es exactamente el defecto que este
// ticket existe para cerrar.
//
// ── QUÉ AFIRMA CADA FUENTE, Y POR QUÉ NO SE PUEDEN SUSTITUIR ────────────────────────────────
//   `main`  responde QUÉ ESTÁ HECHO. Una entrada en `docs/master/SCRUM-<n>.md` es la constancia
//           del trabajo, no su anuncio: el trinquete de SCRUM-273 obliga a escribirla, y el de
//           SCRUM-267 le exige el sha contra el que se midió.
//   Jira    responde QUÉ HAY QUE HACER.
//
// Nadie las cruzaba, y por eso en un solo día se reconstruyeron 304, 367 y 319. **Este fichero es
// el cruce.**
//
// ⚠️ NO decide nada: no cierra tickets, no borra ramas, no toca Jira. Produce LISTAS CON NOMBRES.
// «Hay 7 desfases» no sirve para repartir; «SCRUM-304, SCRUM-367, SCRUM-319» sí.

/** Un fichero de entrada de máster → su número de ticket. `null` si no lo es (README, notas…). */
export function numeroDeEntrada(ruta) {
  const m = /(?:^|[\\/])SCRUM-(\d+)\.md$/.exec(String(ruta));
  return m ? Number(m[1]) : null;
}

/**
 * Los tickets con constancia en `main`, derivados de la lista de ficheros de `docs/master/`.
 *
 * Devuelve un Map número → fichero para poder NOMBRAR la fuente en el informe: un censo que dice
 * «hay desfase» sin decir dónde mirar obliga a rehacer el trabajo a mano.
 */
export function ticketsConEntrada(ficheros) {
  const m = new Map();
  for (const f of ficheros) {
    const n = numeroDeEntrada(f);
    if (n !== null) m.set(n, f);
  }
  return m;
}

/** `SCRUM-304` → 304. Tolera minúsculas y espacios; devuelve `null` si no hay número. */
export function numeroDeClave(clave) {
  const m = /SCRUM-(\d+)/i.exec(String(clave).trim());
  return m ? Number(m[1]) : null;
}

/**
 * Ramas remotas agrupadas por número de ticket.
 *
 * Entra la salida CRUDA de `git ls-remote --heads origin` (o ya sólo los nombres); sale
 * número → [ramas]. Las que no llevan número van a `sinNumero`, y **no se descartan en silencio**:
 * una rama sin número es precisamente la que nadie relaciona con su ticket.
 *
 * ── EXISTIR NO ES ESTAR VIVA, Y AQUÍ ESTÁ TODO EL RUIDO ─────────────────────────────────────
 * Medido: de las 143 ramas de `origin`, **99 ya están en `main`** — residuo que nadie borró. Sin
 * distinguirlas, «dos ramas con el mismo número» dispara 21 alarmas y **ninguna sirve para
 * repartir**: la mayoría son dos formas de un trabajo que ya se mergeó. La alarma que importa es
 * dos ramas **que NO están en main**, porque ahí sí hay dos personas construyendo a la vez.
 *
 * `esAncestroDeMain` decide, y puede devolver `null` cuando NO SABE (objeto no disponible en
 * local). `null` NO se cuenta como mergeada: se marca `indeterminada` y se informa aparte. Este
 * ticket nació de leer un vacío como si fuera un hecho.
 */
export function agruparRamas(entrada, esAncestroDeMain = null) {
  const filas = (Array.isArray(entrada) ? entrada : String(entrada).split('\n'))
    .map((l) => String(l).trim())
    .filter(Boolean)
    .map((l) => {
      const [sha, ref] = l.split(/\s+/);
      return ref ? { sha, nombre: ref.replace(/^refs\/heads\//, '') } : { sha: null, nombre: sha };
    });
  const porTicket = new Map();
  const sinNumero = [];
  let enMain = 0, vivas = 0, indeterminadas = 0;
  for (const { sha, nombre } of filas) {
    if (nombre === 'main') continue;
    const estado = esAncestroDeMain ? esAncestroDeMain(sha, nombre) : null;
    const clase = estado === true ? 'en-main' : (estado === false ? 'viva' : 'indeterminada');
    if (clase === 'en-main') enMain++; else if (clase === 'viva') vivas++; else indeterminadas++;
    const n = numeroDeClave(nombre.replace(/^scrum-/i, 'SCRUM-'));
    if (n === null) { sinNumero.push({ nombre, clase }); continue; }
    if (!porTicket.has(n)) porTicket.set(n, []);
    porTicket.get(n).push({ nombre, clase });
  }
  return { porTicket, sinNumero, total: filas.filter((f) => f.nombre !== 'main').length, enMain, vivas, indeterminadas };
}

/**
 * EL CRUCE. `entradas` (Map de `ticketsConEntrada`) × `abiertos` (lo que Jira tiene sin cerrar).
 *
 * Tres cubos, y los tres importan por motivos distintos:
 *   · `desfases`   — ABIERTO en Jira **y** con entrada en `main`. Es el que hace que se
 *                    reconstruya trabajo hecho. Es la lista que el fundador necesita para repartir.
 *   · `enMainYCerrado` — el control positivo: hecho y cerrado. Si este cubo sale vacío, el cruce
 *                    no está cruzando nada.
 *   · `abiertoSinEntrada` — trabajo pendiente de verdad. NO es una alarma: es la cola normal.
 */
export function cruzar({ entradas, abiertos }) {
  const abiertosPorNumero = new Map();
  for (const it of abiertos) {
    const n = numeroDeClave(it.key ?? it);
    if (n !== null) abiertosPorNumero.set(n, it);
  }

  const desfases = [];
  const abiertoSinEntrada = [];
  for (const [n, it] of abiertosPorNumero) {
    const fichero = entradas.get(n);
    if (fichero) desfases.push({ numero: n, clave: `SCRUM-${n}`, fichero, estado: it.estado ?? null, titulo: it.titulo ?? null });
    else abiertoSinEntrada.push({ numero: n, clave: `SCRUM-${n}`, estado: it.estado ?? null });
  }

  const enMainYCerrado = [];
  for (const [n, fichero] of entradas) {
    if (!abiertosPorNumero.has(n)) enMainYCerrado.push({ numero: n, clave: `SCRUM-${n}`, fichero });
  }

  const porNumero = (a, b) => a.numero - b.numero;
  return {
    desfases: desfases.sort(porNumero),
    abiertoSinEntrada: abiertoSinEntrada.sort(porNumero),
    enMainYCerrado: enMainYCerrado.sort(porNumero),
  };
}

/**
 * EL SUELO, y es el motivo por el que este ticket existe.
 *
 * «Cero desfases» y «no supe leer el directorio» son el mismo número con significados opuestos.
 * Este ticket nació de leer un vacío al revés: un `ls-remote` sin resultados se interpretó como
 * «rama borrada = mergeada» cuando también podía significar «rama que nunca llegó».
 *
 * Devuelve la lista de motivos por los que el censo NO es de fiar. Vacía = fiable.
 */
export function motivosParaNoFiarse({ entradas, abiertos, ramas }) {
  const motivos = [];
  if (!entradas || entradas.size === 0) {
    motivos.push('CERO entradas en docs/master/: o el directorio no se ha leído, o se ha leído otro sitio. Un censo sin entradas no dice «todo alineado», dice que no ha mirado');
  }
  if (!abiertos || abiertos.length === 0) {
    motivos.push('CERO tickets abiertos en Jira: con 70+ en el tablero eso es un fallo de consulta o de credenciales, no un tablero limpio');
  }
  if (!ramas || ramas.total === 0) {
    motivos.push('CERO ramas remotas: `ls-remote` no ha devuelto nada. Sin eso no se puede afirmar que no hay duplicados');
  }
  return motivos;
}

/**
 * Las alarmas de rama: DOS O MÁS ramas SIN MERGEAR con el mismo número.
 *
 * No es una curiosidad — es la forma que tiene el defecto de manifestarse antes de costar dinero:
 * cuando hay dos vivas, alguien ya está reconstruyendo lo del otro y no se enterará hasta el
 * conflicto.
 *
 * Cuentan las `viva` y las `indeterminada`; **no** las `en-main`. Una rama ya mergeada que nadie
 * borró no es trabajo en paralelo, es basura — y contarla ahoga la señal entre 21 alarmas de las
 * que ninguna sirve. Las indeterminadas cuentan porque no saber no es lo mismo que descartar.
 */
export function alarmasDeRama(ramas, { umbral = 2 } = {}) {
  const alarmas = [];
  for (const [numero, lista] of ramas.porTicket) {
    const sinMergear = lista.filter((r) => r.clase !== 'en-main');
    if (sinMergear.length >= umbral) {
      alarmas.push({
        numero,
        clave: `SCRUM-${numero}`,
        ramas: sinMergear.map((r) => r.nombre).sort(),
        cuantas: sinMergear.length,
        residuo: lista.length - sinMergear.length,
      });
    }
  }
  return alarmas.sort((a, b) => b.cuantas - a.cuantas || a.numero - b.numero);
}

/** Ramas ya mergeadas que siguen en `origin`. No es alarma: es limpieza, y conviene verla. */
export function residuoParaBorrar(ramas) {
  const out = [];
  for (const [numero, lista] of ramas.porTicket) {
    for (const r of lista) if (r.clase === 'en-main') out.push({ numero, clave: `SCRUM-${numero}`, rama: r.nombre });
  }
  for (const r of ramas.sinNumero) if (r.clase === 'en-main') out.push({ numero: null, clave: '(sin número)', rama: r.nombre });
  return out.sort((a, b) => (a.numero ?? 1e9) - (b.numero ?? 1e9) || a.rama.localeCompare(b.rama));
}
