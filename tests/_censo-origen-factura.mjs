// tests/_censo-origen-factura.mjs — SCRUM-289 (A0.3) · ¿qué sitios ATAN una población de facturas
// a su DOCUMENTO DE ORIGEN (el presupuesto)?
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE
//
// A0.3 abre la FACTURA SUELTA: una factura sin presupuesto, sin trabajo y sin albarán. El riesgo
// no es que reviente —`Invoice.quoteId` siempre fue nullable y el árbol guarda ese null en todas
// partes (medido en SCRUM-287)—: es que un sitio la EXCLUYA o la CUENTE MAL **en silencio**, y
// entregue una factura que parece bien o un informe que cuenta mal.
//
// Ese fallo no se ve en un diff, porque ninguna línea está mal: el defecto vive en que una
// población se restringe por `quoteId` y nadie vuelve a mirar cuando aparece una factura que no
// tiene. Ya pasó una vez y está escrito en el árbol: **SCRUM-236** encontró
// `quoteId: { not: null }` en `getTeamMetrics` descartando en silencio todo el flujo de Trabajos
// —las filas por empleado no sumaban el total y la pantalla no lo decía—. Se arregló ahí. El
// mismo patrón sigue vivo, a propósito y bien, en `funnelForPeriod`. La diferencia entre los dos
// no la dice el código: la dice quien lo midió. Por eso esto es un CENSO, no una prohibición.
//
// LO QUE ESTE MÓDULO NO HACE: no prohíbe atar una factura a su origen. Muchas veces es correcto
// (un embudo de presupuestos DEBE contar solo presupuestos). Lo que impide es que aparezca un
// sitio nuevo **sin que nadie lo haya clasificado**.
//
// POR QUÉ AST Y NO TEXTO
//
// Mismo motivo que `_embudo-factura.mjs` (SCRUM-203), y el segundo es el que decide:
//  1. `quoteId` aparece en 32 ficheros de `src/`: un `grep` no distingue un `where` de una
//     asignación, de un `select` o de un comentario.
//  2. **La trampa de auto-referencia.** Un guard de texto se caza a sí mismo en el comentario que
//     explica la prohibición (mordió en SCRUM-176/168/3/193). Este fichero está lleno de la
//     palabra que perseguiría. El AST no ve comentarios: el problema no se mitiga, deja de existir.
//
// `typescript` es dependencia de desarrollo y `npm test` corre `tsc` antes que nada.
//
// LO QUE ESTE ANALIZADOR **NO** VE (declarado aquí, no descubierto en un rojo raro)
//
//  · Receptor con alias: `const t = tx.invoice; t.findMany({...})`. Se detecta el método de algo
//    que se LLAMA `invoice`, no el de una variable que resulte serlo. Cerrarlo exige el checker
//    de tipos (proyecto entero en memoria); hoy nadie escribe así en este repo.
//  · `where` construido fuera del literal (`const w = {...}; findMany({ where: w })`). NO es un
//    agujero: cuenta como sitio y sale en el censo, porque el analizador no puede ver qué lleva
//    dentro. Falla cerrado — la alternativa es un verde que no ha comprobado nada.
//  · SQL crudo (`$queryRaw`). No es una consulta del ORM y no la ve nadie aquí; queda fuera de la
//    población declarada, dicho para que un cero no se lea como «no hay».
//  · El camino de LECTURA de un solo registro (`invoice.quote?.total` en un serializer). Eso lo
//    midió SCRUM-287 y es otra pregunta: allí el null ya está guardado. Aquí se miran POBLACIONES.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Métodos de Prisma que devuelven o cuentan una POBLACIÓN (no un registro suelto por id). */
const METODOS_POBLACION = new Set([
  'findMany', 'findFirst', 'count', 'aggregate', 'groupBy', 'updateMany', 'deleteMany',
]);

/** Modelos cuya población puede quedar atada al presupuesto. `expense` entra porque el margen
 *  se calcula por `quoteId` (`getQuoteMargin`) y un gasto sin presupuesto no entra en ningún
 *  margen — el mismo silencio, en otra tabla. */
const MODELOS = new Set(['invoice', 'expense']);

/** Cómo queda atada la población a su origen. El TIPO importa: no es lo mismo excluir que agrupar. */
export const ATADURAS = {
  FILTRA: 'filtra la población por el origen (where sobre quoteId)',
  AGRUPA: 'agrupa la población por el origen (by: quoteId)',
  NAVEGA: 'arrastra el origen en la proyección (select/include de quote)',
  OPACO: 'el where no es un literal: no se puede ver qué filtra',
};

const ficherosTs = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosTs(p, out);
    else if (/\.ts$/.test(e.name) && !/\.d\.ts$/.test(e.name)) out.push(p);
  }
  return out;
};

/** ¿El nodo contiene, en cualquier profundidad, un identificador/clave con este nombre? */
function mencionA(nodo, nombre) {
  let visto = false;
  const ver = (n) => {
    if (visto) return;
    if (ts.isIdentifier(n) && n.text === nombre) { visto = true; return; }
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && n.text === nombre) { visto = true; return; }
    ts.forEachChild(n, ver);
  };
  ts.forEachChild(nodo, ver);
  return visto;
}

/**
 * 🔴 LOS SPREAD SON EL CASO QUE ESTE ANALIZADOR ESTUVO A PUNTO DE NO VER, y es el sitio que
 * motiva el ticket.
 *
 * `funnelForPeriod` filtra así:
 *     const soloDePresupuesto = { quoteId: { not: null } };
 *     client.invoice.count({ where: { merchantId, createdAt: inPeriod, ...soloDePresupuesto } })
 *
 * Dentro del `where` NO aparece el identificador `quoteId` por ninguna parte: aparece
 * `soloDePresupuesto`. Un analizador que busque `quoteId` en el subárbol del `where` devuelve
 * «limpio» sobre LA consulta que excluye las facturas sueltas del embudo. Cero de «no hay» y
 * cero de «no supe mirar» son el mismo número y significan lo contrario.
 *
 * Se resuelve el spread contra las declaraciones del MISMO fichero. Si no se puede resolver
 * (viene de otro módulo, de un parámetro, de una llamada), el sitio se marca OPACO y entra en el
 * censo igual: fallar cerrado, nunca dar por limpio lo que no se ha podido leer.
 */
function objetosDelFichero(sf) {
  const mapa = new Map();
  const ver = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer
        && ts.isObjectLiteralExpression(n.initializer)) {
      mapa.set(n.name.text, n.initializer);
    }
    ts.forEachChild(n, ver);
  };
  ver(sf);
  return mapa;
}

/** ¿El `where` menciona el origen, mirando también DENTRO de los spread que se puedan resolver?
 *  Devuelve 'si' | 'no' | 'opaco'. */
function whereMencionaOrigen(where, objetos, profundidad = 0) {
  if (mencionA(where, 'quoteId') || mencionA(where, 'quote')) return 'si';
  let opaco = false;
  for (const p of where.properties) {
    if (!ts.isSpreadAssignment(p)) continue;
    const destino = ts.isIdentifier(p.expression) ? objetos.get(p.expression.text) : null;
    if (!destino || profundidad > 3) { opaco = true; continue; }
    const r = whereMencionaOrigen(destino, objetos, profundidad + 1);
    if (r === 'si') return 'si';
    if (r === 'opaco') opaco = true;
  }
  return opaco ? 'opaco' : 'no';
}

const propiedad = (obj, nombre) => {
  if (!obj || !ts.isObjectLiteralExpression(obj)) return null;
  for (const p of obj.properties) {
    if (!ts.isPropertyAssignment(p)) continue;
    const k = p.name;
    const texto = ts.isIdentifier(k) || ts.isStringLiteral(k) ? k.text : null;
    if (texto === nombre) return p.initializer;
  }
  return null;
};

/**
 * Sitios del árbol donde una población de facturas (o de gastos) queda atada al presupuesto.
 * @returns {Array<{fichero:string, linea:number, modelo:string, metodo:string, ataduras:string[]}>}
 */
export function sitiosQueAtanAlOrigen(raiz) {
  const sitios = [];
  for (const fichero of ficherosTs(path.join(raiz, 'src'))) {
    const texto = fs.readFileSync(fichero, 'utf8');
    const sf = ts.createSourceFile(fichero, texto, ts.ScriptTarget.Latest, true);

    const objetos = objetosDelFichero(sf);

    const visitar = (n) => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
        const metodo = n.expression.name.text;
        const receptor = n.expression.expression; // p.ej. `prisma.invoice`
        if (METODOS_POBLACION.has(metodo) && ts.isPropertyAccessExpression(receptor)) {
          const modelo = receptor.name.text;
          if (MODELOS.has(modelo)) {
            const arg = n.arguments[0];
            const ataduras = [];
            if (arg && ts.isObjectLiteralExpression(arg)) {
              const where = propiedad(arg, 'where');
              if (where && ts.isObjectLiteralExpression(where)) {
                const r = whereMencionaOrigen(where, objetos);
                if (r === 'si') ataduras.push(ATADURAS.FILTRA);
                else if (r === 'opaco') ataduras.push(ATADURAS.OPACO);
              } else if (where) {
                ataduras.push(ATADURAS.OPACO);
              }
              const by = propiedad(arg, 'by');
              if (by && mencionA(by, 'quoteId')) ataduras.push(ATADURAS.AGRUPA);
              for (const clave of ['select', 'include']) {
                const proy = propiedad(arg, clave);
                if (proy && mencionA(proy, 'quote')) { ataduras.push(ATADURAS.NAVEGA); break; }
              }
            }
            if (ataduras.length) {
              sitios.push({
                fichero: path.relative(raiz, fichero).replace(/\\/g, '/'),
                linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
                modelo,
                metodo,
                ataduras,
              });
            }
          }
        }
      }
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
  }
  return sitios.sort((a, b) => a.fichero.localeCompare(b.fichero) || a.linea - b.linea);
}

/** Clave estable de un sitio. SIN la línea: un sitio no cambia de identidad porque alguien añada
 *  un comentario encima, y un censo que se rompe con cada línea insertada es ruido que la gente
 *  actualiza sin leer — lo contrario de lo que hace falta. El ordinal desempata dos llamadas
 *  iguales en el mismo fichero (pasa dos veces hoy) y solo se mueve si alguien añade o quita una,
 *  que es justo cuando el censo TIENE que revisarse. */
export function clavesDe(sitios) {
  const vistos = new Map();
  return sitios.map((s) => {
    const base = `${s.fichero}::${s.modelo}.${s.metodo}`;
    const n = (vistos.get(base) ?? 0) + 1;
    vistos.set(base, n);
    return `${base}#${n}`;
  });
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CENSO — los 24 sitios del árbol, LEÍDOS UNO A UNO, con su veredicto.
//
// Esto NO es una allowlist: es el resultado de una medición, y su valor está en que cada
// entrada dice QUÉ le pasa a una factura suelta ahí. Un sitio nuevo que no esté aquí es ROJO,
// no porque atar al origen esté prohibido, sino porque nadie lo ha mirado todavía.
//
// Veredictos:
//   CLAVE      · el origen es la clave de búsqueda de UN registro. Una suelta no es el objetivo
//                de esa búsqueda; no hay población que excluir. Correcto.
//   POBLACION  · la población es, por definición, «lo nacido de un presupuesto». Excluir la
//                suelta es correcto Y está escrito en el propio código.
//   TRATADO    · trae TODO y hace VISIBLE lo no atribuible en vez de tirarlo (SCRUM-228/236).
//   PROYECCION · solo arrastra el origen en select/include. Con quote null el campo sale null y
//                el consumidor ya lo guarda (medido en SCRUM-287; el `as any` lo quitó SCRUM-342).
//   OPACO      · el `where` no es un literal (spread condicional). Leído a mano: NO ata al origen.
//                Se queda en el censo porque el analizador no puede verlo, y un sitio que no se
//                puede leer automáticamente es exactamente el que hay que revisar a mano.
//   HUECO      · SÍ ata al origen y la suelta queda fuera sin que nadie lo vea. Declarado, con su
//                motivo, y NO tapado en este incremento (ver el test).
export const CENSO = {
  'src/lib/invoicing.ts::invoice.findFirst#1': { veredicto: 'CLAVE', nota: 'idempotencia al crear desde un charge que YA tiene quote' },
  'src/modules/billing/app/routes/psp.routes.ts::invoice.findFirst#1': { veredicto: 'CLAVE', nota: 'OR chargeId/quoteId; el quoteId entra por spread condicional solo si hay quote' },
  'src/modules/billing/app/routes/receipt.routes.ts::invoice.findFirst#1': { veredicto: 'CLAVE', nota: 'guardado por `if (quote)`, con camino alternativo por evento' },
  'src/modules/billing/app/routes/receipt.routes.ts::invoice.findFirst#2': { veredicto: 'CLAVE', nota: 'idéntico al anterior, en la otra ruta de recibo' },
  'src/modules/expenses/domain/expenses.service.ts::expense.findMany#1': { veredicto: 'PROYECCION', nota: 'lista de gastos; include quote solo para el id' },
  'src/modules/expenses/domain/expenses.service.ts::expense.aggregate#1': { veredicto: 'POBLACION', nota: 'gastos GENERALES = los que a propósito no tienen presupuesto (quoteId null)' },
  'src/modules/expenses/domain/expenses.service.ts::expense.findMany#2': { veredicto: 'HUECO', nota: 'getQuoteMargin: el margen SOLO existe por presupuesto. Una suelta no da margen malo — no aparece. Hueco PREEXISTENTE: ya afecta al flujo de albaranes/recapitulativa, que fija quoteId null' },
  'src/modules/exports/app/routes/exports.routes.ts::invoice.count#1': { veredicto: 'OPACO', nota: 'spread condicional de fechas; no ata al origen' },
  'src/modules/exports/app/routes/exports.routes.ts::invoice.findMany#1': { veredicto: 'OPACO', nota: 'spread condicional de fechas; no ata al origen' },
  'src/modules/exports/domain/exportData.ts::invoice.findMany#1': { veredicto: 'OPACO', nota: 'where construido por whereRango(); no ata al origen' },
  // SCRUM-343 unificó `/admin/exports/expenses.csv` por el builder compartido: la lectura de
  // gastos que vivía en `exports.routes.ts` NO desapareció, se MOVIÓ aquí (`buildGastos`). Esta
  // entrada ya existía y cubre las dos descargas, así que la vieja quedó fantasma y se retiró.
  'src/modules/exports/domain/exportData.ts::expense.findMany#1': { veredicto: 'OPACO', nota: 'where construido por whereRango(); no ata al origen' },
  'src/modules/invoicing/domain/verifactu.service.ts::invoice.findFirst#1': { veredicto: 'OPACO', nota: 'encadenado de huella: filtra por vfHash y merchant, no por origen' },
  'src/modules/jobs/domain/job.service.ts::invoice.aggregate#1': { veredicto: 'POBLACION', nota: 'totalCobrado de un Job = facturas de SUS quotes. Una suelta no pertenece a ningún Job' },
  'src/modules/maintenance/domain/maintenance.service.ts::invoice.findMany#1': { veredicto: 'POBLACION', nota: '€ nacidos del ciclo de mantenimientos (quote.origin); una suelta nunca nació de uno' },
  'src/modules/metrics/domain/metrics.service.ts::invoice.count#1': { veredicto: 'POBLACION', nota: 'embudo de PRESUPUESTOS: etapa «facturadas». Filtro simétrico con «cobradas» y razonado en SCRUM-236' },
  'src/modules/metrics/domain/metrics.service.ts::invoice.count#2': { veredicto: 'POBLACION', nota: 'embudo de PRESUPUESTOS: etapa «cobradas». La asimetría con la anterior es EL bug que cerró SCRUM-236' },
  'src/modules/metrics/domain/metrics.service.ts::invoice.findMany#1': { veredicto: 'TRATADO', nota: 'rendimiento del equipo: SCRUM-236 quitó el quoteId:{not:null}; lo no atribuible se ve en «Sin asignar»' },
  'src/modules/reports/app/routes/reports.routes.ts::invoice.findMany#1': { veredicto: 'TRATADO', nota: 'P&L: trae TODAS y usa quoteId para separar «no atribuible» de «del propietario» (SCRUM-228)' },
  'src/modules/system/app/routes/customersAdmin.routes.ts::expense.aggregate#1': { veredicto: 'HUECO', nota: 'gastos de un cliente atribuidos SOLO vía quote.customerId. Un gasto sin presupuesto no llega nunca a su cliente. Hueco PREEXISTENTE: Expense no tiene customerId' },
  'src/modules/system/app/routes/invoicesAdmin.routes.ts::invoice.findFirst#1': { veredicto: 'PROYECCION', nota: 'detalle de factura; accesos al quote ya guardados (SCRUM-287) y sin `as any` (SCRUM-342)' },
  'src/modules/system/invoiceAdmin.ts::invoice.findMany#1': { veredicto: 'PROYECCION', nota: 'listado admin; include quote opcional' },
  'src/modules/system/invoiceAdmin.ts::invoice.findFirst#1': { veredicto: 'PROYECCION', nota: 'detalle admin; el OPACO es el spread condicional de merchantId, no el origen' },
  'src/modules/system/invoiceAdmin.ts::invoice.findFirst#2': { veredicto: 'OPACO', nota: 'spread condicional de merchantId; no ata al origen' },
};
