// tests/_copy-cobro-profesional.mjs — SCRUM-1080: detector de PROMESAS de COBRO hechas AL
// PROFESIONAL, sin condicionar por el modo de emisión.
//
// LA REGLA (regla 24 enmendada, SCRUM-612c, 21-sep-2026): con la facturación apagada (ES real,
// `INVOICING_ES_ENABLED` OFF), YaQu no cobra por NINGUNA vía a los clientes del profesional: «ni
// enlace de pago, ni señal al aceptar el presupuesto, ni recordatorios de pago […] El profesional
// cobra por fuera de YaQu hasta que exista la factura.»
//
// SCRUM-299 vigila la promesa de FACTURA hecha al CLIENTE FINAL en copy PÚBLICO, y excluye
// `public/dashboard/**` A PROPÓSITO (decisión de J6, docs/master/SCRUM-299.md §299b): esa app es
// del PROFESIONAL, no material público-cliente. La población de ESTE guard es justo la contraria —
// la promesa de COBRO hecha AL PROFESIONAL, en su propia app y en los emails de ciclo de vida que
// él recibe (`lifecycle.service.ts`). No se ensancha SCRUM-299 (forzaría sus dos ejes de diseño a
// la vez y rompería su propio test): se construye este, nuevo.
//
// CASO MOTIVADOR (medido en docs/master/SCRUM-1029.md §2 y §11.1, 21/22-sep-2026, más el barrido
// previo a este guard, 22-sep-2026): 7 superficies prometían cobrar sin condición — el checklist de
// ajustes, el asistente de alta, el tutorial, la pantalla del plan, dos emails de ciclo de vida, el
// pie que comparten los 7 emails, y `puertaSerie.js` (la «puerta de última oportunidad» de
// Configuración, que repite el MISMO microcopy aprobado del asistente en un componente hermano —
// la 7ª la encontró precisamente el barrido de A23 #1 al escribir este guard, no el guard ya en
// marcha: tres censos seguidos, tres números distintos, 5 → 6 → 7, y las tres veces lo que se
// escapaba era lo COMPARTIDO o lo HERMANO, nunca una pantalla mirada de frente). Las 6 primeras las
// gateó el PR #1650; la 7ª la gatea J1 aparte (dueño de `puertaSerie.js`, `dos-equipos.md` §3.2).
// Todas por el modo de emisión (`window.appModoEmision` en el navegador, derivado de
// `getEmissionMode` en el servidor) SIN reescribir el texto — el texto sustituto está pendiente de
// firma de Javier (regla 39).
//
// CRITERIO — declarado, es la mitad del guard: una promesa de cobro es roja si el FICHERO que la
// contiene no tiene ninguna condición REAL sobre el modo de emisión — una llamada a
// `getEmissionMode(` o una comparación `appModoEmision === /!== '...'`. NO basta con que el
// identificador aparezca: `settingsView.js` ya usaba `window.appModoEmision` ANTES de este ticket
// para pintar el modo (un pill informativo en Cumplimiento — asignaciones y lookups, ninguna
// comparación) sin condicionar nada — medido leyendo el fichero en el commit anterior a #1650
// (`fae6a849`, líneas 198-220): la palabra está, la comparación no. Exigir la COMPARACIÓN, no la
// mera presencia, es lo que separa «se pinta el modo» de «se condiciona por el modo».
//
// GRANULARIDAD — declarada, y es el SUELO de este guard: la condición se busca en el FICHERO
// entero, no en la función que envuelve cada frase. Las superficies medidas gatean con TRES
// mecanismos distintos (return anticipado, filtro de array sobre una propiedad hermana, ternario
// con un booleano recibido como parámetro obligatorio) y ninguno comparte alcance léxico con el
// texto en los tres casos a la vez: `wrap()` en `lifecycle.service.ts` recibe `puedeCobrar` ya
// resuelto por quien la llama, sin mencionar `getEmissionMode` en su propio cuerpo; la entrada de
// `tutorial.js` vive en un array de nivel de módulo y la filtra una función DISTINTA
// (`openHelpGuide`). Bajar a nivel de fichero es lo que permite un criterio ÚNICO para los tres
// mecanismos sin tres reglas ad-hoc por caso. El precio, declarado y no callado: un fichero que YA
// condiciona alguna promesa por el modo de emisión queda ciego a una promesa NUEVA que alguien
// añada sin condicionar en el mismo fichero.
//
// ALCANCE DECLARADO — dos casos vistos y dejados fuera A PROPÓSITO, no una excepción (la diferencia
// importa: esto dice qué NO mira el guard; una excepción diría que SÍ lo ve y lo perdona):
//   · `settingsView.js` (tarjeta «Cobros con tarjeta» / Stripe Connect): promete cobro con tarjeta
//     sin condicionar por modo de emisión, pero `PAYMENTS_CONNECT_ENABLED` está OFF global
//     (`src/core/flags.ts`, «hasta CONNECT-1») — 0 víctimas hoy en NINGÚN merchant. No cumple la
//     barra de A7 («un hallazgo solo es ticket si tiene víctima HOY»). Si CONNECT-1 activa el flag,
//     esto deja de ser cierto y hay que remedirlo — no es un veredicto permanente.
//   · `settingsView.js` (checkbox «Recibir email cuando un cliente paga»): el patrón de abajo SÍ lo
//     reconocería como promesa si no cayera en un fichero ya condicionado — es una preferencia de
//     notificación que el PROFESIONAL configura para sí mismo, no una promesa de marketing sobre una
//     capacidad nueva. Categoría distinta a propósito, no un hueco del detector.
// Ninguno de los dos bloquea el guard hoy: ambos viven en `settingsView.js`, que ya condiciona su
// tarjeta de ajustes — quedan fuera del alcance de «lo que sabe nombrar», declarado aquí y no
// callado.
//
// Este guard cubre lo que sabe NOMBRAR: los patrones de abajo, calcados de las frases reales
// medidas. Que salga verde significa que no encuentra ESTAS promesas con ESTA redacción — no que
// no exista ninguna con otra.
import fs from 'node:fs';
import path from 'node:path';
import { literalesDeJs } from './_copy-publico.mjs';

const EXT_DASHBOARD = new Set(['.js', '.html']);

// Requiere la COMPARACIÓN o la LLAMADA, no la mera presencia del identificador (ver CRITERIO).
const GATE_RE = /\bgetEmissionMode\s*\(|\bappModoEmision\s*(?:===|!==)/;

/** ¿El fichero tiene una condición REAL sobre el modo de emisión (no solo la palabra)? */
export function ficheroCondicionaPorModoEmision(textoOriginal) {
  return GATE_RE.test(textoOriginal);
}

/**
 * Censo DERIVADO por recorrido del árbol (nunca lista a mano): `public/dashboard/**` completo +
 * el único fichero fuera de esa carpeta que la regla 24 alcanza hoy, `lifecycle.service.ts`.
 * @returns {{rel:string, texto:string, bruto:string, condicionado:boolean}[]}
 */
export function recolectarCopyProfesional(raiz) {
  const out = [];
  const leer = (abs, rel) => {
    const bruto = fs.readFileSync(abs, 'utf8');
    const ext = path.extname(rel).toLowerCase();
    let texto = bruto;
    if (ext === '.js' || ext === '.ts') {
      const m = literalesDeJs(bruto);
      // Fallback declarado (igual que SCRUM-299): prefiere un falso ROJO a un falso VERDE.
      texto = m ?? bruto;
    } else if (ext === '.html') {
      texto = bruto.replace(/<!--[\s\S]*?-->/g, (s) => s.replace(/[^\n\r]/g, ' '));
    }
    out.push({ rel, texto, bruto, condicionado: ficheroCondicionaPorModoEmision(bruto) });
  };

  const recorrer = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      const r = `${rel}/${e.name}`;
      if (e.isDirectory()) recorrer(abs, r);
      else if (EXT_DASHBOARD.has(path.extname(e.name).toLowerCase())) leer(abs, r);
    }
  };
  recorrer(path.join(raiz, 'public', 'dashboard'), 'public/dashboard');

  const lc = path.join(raiz, 'src', 'modules', 'messaging', 'domain', 'lifecycle.service.ts');
  if (fs.existsSync(lc)) leer(lc, 'src/modules/messaging/domain/lifecycle.service.ts');
  return out;
}

// Patrones de PROMESA DE COBRO AL PROFESIONAL — «cobrar/cobro/te paga/recordatorio de pago», NO
// «factura + entrega» (eso es SCRUM-299). Cada uno calcado de una frase real medida en
// docs/master/SCRUM-1029.md §2/§11.1, con nombre, para poder decir por qué cayó.
// ⚠️ «cliente»/«te» + «pagar» con una VENTANA ancha entre medias cazaba falsos positivos reales
// (medido corriendo el censo, no razonado): `homeView.js` — «Se lo pedimos al cliente TRAS pagar»
// (cuándo se pide una reseña) y «El cliente elige nivel Y paga ese» (cómo se reparte el IMPORTE
// dentro de un presupuesto, no quién procesa el cobro); `reportsView.js` — «Cómo TE pagan» (título
// de un informe de cobros YA completados, la misma clase que «Pendiente de cobro» que SCRUM-1029
// §5 ya declaró SIGUE BIEN). Ninguna de las tres promete que YaQu vaya a procesar un cobro nuevo.
// Las dos frases reales medidas («el cliente paga desde el móvil», «tus clientes pueden pagar con
// tarjeta») tienen «cliente(s)» PEGADO al verbo pagar, sin cláusula intermedia — de ahí la ventana
// corta. Se retira el patrón suelto de «te + pagar»: ninguna de las superficies medidas lo
// necesita (la fila del IBAN cae igual por «cliente+pagar» del resto de la tarjeta) y es el que
// producía el falso positivo de `reportsView.js` sin aportar ningún caso real.
const PATRONES_PROMESA_COBRO = [
  { marcador: 'verbo cobrar + antes de empezar', re: /\bcobr(?:a|ar)\s+antes\s+de\s+empezar\b/i },
  { marcador: 'facturas se generan solas al cobrar', re: /\bfacturas?\s+se\s+generan?\s+solas?\s+al\s+cobrar\b/i },
  { marcador: 'cliente + pagar, pegados (cobro por YaQu)', re: /\bclientes?\s+(?:pueden?\s+)?paga(?:r|n|rá|rán)?\b/i },
  { marcador: 'recordatorio automático de pago/cobro', re: /\brecordatorios?\s+autom[aá]ticos?\s+de\s+(?:pago|cobro)\b/i },
  { marcador: 'cabecera "lista para cobrar"', re: /\blista\s+para\s+cobrar\b/i },
  { marcador: 'documento futuro atado a la emisión (primera factura con YaQu)', re: /\bprimera\s+factura\s+con\s+yaqu\b/i },
];

const lineaDe = (texto, idx) => texto.slice(0, idx).split('\n').length;
const recorte = (texto, idx) => texto.slice(Math.max(0, idx - 12), idx + 48).replace(/\s+/g, ' ').trim();

/**
 * PROMESAS de cobro al profesional en un texto. Devuelve una por LÍNEA (varias señales en la misma
 * línea son la misma promesa). El criterio de si CAE en rojo (condicionado o no) lo aplica quien
 * llama, cruzando esto con `ficheroCondicionaPorModoEmision`.
 * @returns {{linea:number, marcador:string, frag:string}[]}
 */
export function promesasDeCobro(texto) {
  const porLinea = new Map();
  for (const { marcador, re } of PATRONES_PROMESA_COBRO) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    let m;
    while ((m = g.exec(texto)) !== null) {
      const linea = lineaDe(texto, m.index);
      if (!porLinea.has(linea)) porLinea.set(linea, { linea, marcador, frag: recorte(texto, m.index) });
      if (m.index === g.lastIndex) g.lastIndex++; // guarda anti-bucle en match vacío
    }
  }
  return [...porLinea.values()].sort((a, b) => a.linea - b.linea);
}
