// SCRUM-1524c · LA TABLA de las 25 citas vivas del grupo 1 de SCRUM-1524 c.19280.
//
// Una fila por cita. `viejo` es el literal que había en la línea `linea` del documento, `nuevo` el
// que queda. `fichero` y `rango` dicen a dónde apunta la cita DESPUÉS del arreglo, y `espera` es un
// trozo de texto que TIENE que estar en la primera línea de ese rango: no sale del censo, sale de
// leer la frase del documento. Si `viejo === nuevo` la cita no se toca (las 2 que no pedían nada).
//
// `clase` es la de c.19280: N = cambiar el número y nada más · L = pedía lectura · 0 = no pedía nada.
// `nota` se añade a la MISMA línea física, detrás de `nuevo`: una frase fechada no se reescribe, se le
// pone la fecha al lado (SCRUM-1521 c.19153). Ninguna fila añade ni quita líneas.
const AUD = 'docs/legal/AUDITORIA_CAMINO_EMISION.md';
const PRE = 'docs/legal/PREGUNTAS_ASESOR.md';
const VF = 'src/modules/invoicing/domain/verifactu.service.ts';
const EXP = 'src/modules/exports/app/routes/exports.routes.ts';
const LIB = 'public/dashboard/js/libroRegistroView.js';

export const TABLA = [
  // ── AUDITORIA_CAMINO_EMISION.md · 17 ──────────────────────────────────────────────────────────
  { doc: AUD, linea: 33, clase: 'N', viejo: '`src/modules/system/app/routes/invoicesAdmin.routes.ts:100`', nuevo: '`src/modules/system/app/routes/invoicesAdmin.routes.ts:115`',
    fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts', rango: [115, 115], espera: "router.post('/', requireRole('admin')" },
  { doc: AUD, linea: 39, clase: 'L', viejo: '`src/modules/exports/app/routes/exports.routes.ts:253` y `:563` — SCRUM-1051 (23-sep-2026) movió la línea: el bloque S2 se insertó antes de la función; SCRUM-1296, una importación de tipos; SCRUM-1330, la guarda de «ya sellada» |',
    nuevo: '`src/modules/exports/app/routes/exports.routes.ts:253` y `:568` — SCRUM-1051 (23-sep-2026) movió la línea: el bloque S2 se insertó antes de la función; SCRUM-1296, una importación de tipos; SCRUM-1330, la guarda de «ya sellada»; puesta al día el 13-oct-2026 (SCRUM-1524c): la segunda decía 563 |',
    fichero: EXP, rango: [568, 568], espera: 'await buildVerifactuRegistrosXml(' },
  { doc: AUD, linea: 68, clase: 'N', viejo: '`' + VF + ':153`', nuevo: '`' + VF + ':197`', fichero: VF, rango: [197, 197], espera: 'agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR' },
  { doc: AUD, linea: 73, clase: 'N', viejo: '`src/modules/invoicing/infra/pdf/pdf.service.ts:120`', nuevo: '`src/modules/invoicing/infra/pdf/pdf.service.ts:121`',
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts', rango: [121, 121], espera: 'await axios.get(logoUrl' },
  { doc: AUD, linea: 76, clase: 'N', viejo: '`src/integrations/gemini.ts:43`', nuevo: '`src/integrations/gemini.ts:89`', fichero: 'src/integrations/gemini.ts', rango: [89, 89], espera: 'await fetch(url' },
  { doc: AUD, linea: 102, clase: 'N', viejo: '`' + EXP + ':524`', nuevo: '`' + EXP + ':525`', fichero: EXP, rango: [525, 525], espera: 'requiere certificado digital del emisor' },
  { doc: AUD, linea: 104, clase: 'N', viejo: '`' + VF + ':527`', nuevo: '`' + VF + ':651`', fichero: VF, rango: [651, 651], espera: 'requiere certificado digital del emisor' },
  { doc: AUD, linea: 107, clase: 'N', viejo: '`src/modules/jobs/infra/albaranPdf.service.ts:382`', nuevo: '`src/modules/jobs/infra/albaranPdf.service.ts:412`',
    fichero: 'src/modules/jobs/infra/albaranPdf.service.ts', rango: [412, 412], espera: 'Certificado de evidencias' },
  { doc: AUD, linea: 144, clase: 'N', viejo: '`' + VF + ':947`', nuevo: '`' + VF + ':855`', fichero: VF, rango: [855, 855], espera: 'tests/scrum240-sobre-unico.test.mjs' },
  { doc: AUD, linea: 145, clase: 'N', viejo: '`prisma/schema.prisma:865-866`', nuevo: '`prisma/schema.prisma:917-918`', fichero: 'prisma/schema.prisma', rango: [917, 918], espera: 'vfHash', espera2: 'vfPrevHash' },
  { doc: AUD, linea: 145, clase: 'N', viejo: '`src/modules/invoicing/domain/selladoEstado.ts:116`', nuevo: '`src/modules/invoicing/domain/selladoEstado.ts:119`',
    fichero: 'src/modules/invoicing/domain/selladoEstado.ts', rango: [119, 119], espera: 'export async function sellarTrasEmision(' },
  { doc: AUD, linea: 146, clase: 'N', viejo: '`prisma/schema.prisma:864`', nuevo: '`prisma/schema.prisma:916`', fichero: 'prisma/schema.prisma', rango: [916, 916], espera: 'vfEstado', espera2: 'pendiente_de_sellado' },
  { doc: AUD, linea: 147, clase: 'N', viejo: '`src/modules/fiscal/verifactu/registro.builder.ts:536`', nuevo: '`src/modules/fiscal/verifactu/registro.builder.ts:552`',
    fichero: 'src/modules/fiscal/verifactu/registro.builder.ts', rango: [552, 552], espera: 'EL ÚNICO GENERADOR DEL CONTENIDO DEL SOBRE' },
  { doc: AUD, linea: 176, clase: 'N', viejo: '`src/modules/invoicing/domain/invoiceNumber.service.ts:452-457`', nuevo: '`src/modules/invoicing/domain/invoiceNumber.service.ts:406-411`',
    fichero: 'src/modules/invoicing/domain/invoiceNumber.service.ts', rango: [406, 411], espera: 'SCRUM-207: el modo fiscal del MOMENTO' },
  { doc: AUD, linea: 217, clase: 'L', viejo: '* `' + VF + ':674` — **MEDIDO el 16-sep-2026 (SCRUM-525c);',
    nuevo: '* `' + VF + ':930` *(cita puesta al día el 13-oct-2026, SCRUM-1524c, permiso del fundador en SCRUM-1524 c.19292: el 16-sep-2026 era la 674, y «la 674» y «la 673» de este párrafo son las de aquel día)* — **MEDIDO el 16-sep-2026 (SCRUM-525c);',
    fichero: VF, rango: [930, 930], espera: 'LA R1 SÍ ENTRA HOY EN EL REGISTRO' },
  { doc: AUD, linea: 223, clase: '0', viejo: '`src/modules/invoicing/domain/modoVisible.ts:21`', nuevo: '`src/modules/invoicing/domain/modoVisible.ts:21`',
    fichero: 'src/modules/invoicing/domain/modoVisible.ts', rango: [21, 21], espera: '«se envía» NO EXISTE' },
  { doc: AUD, linea: 234, clase: 'L', viejo: '   `' + VF + ':674` (la 673 se quedó vacía al reescribirlo)',
    nuevo: '   `' + VF + ':930` *(cita puesta al día el 13-oct-2026, SCRUM-1524c: el 16-sep-2026 era la 674)* (la 673 se quedó vacía al reescribirlo)',
    fichero: VF, rango: [930, 930], espera: 'LA R1 SÍ ENTRA HOY EN EL REGISTRO' },

  // ── PREGUNTAS_ASESOR.md · 8 ───────────────────────────────────────────────────────────────────
  // 🔴 Las de la sección 21 NO van al destino que da el censo. El censo sigue el texto que había en la
  // línea citada el día que la cita entró, y ese día la cita YA apuntaba ocho líneas más arriba de lo
  // que su frase describe. `espera` sale del bloque de código que el documento pone debajo de cada una.
  { doc: PRE, linea: 461, clase: '0', viejo: '`src/modules/invoicing/domain/modoVisible.ts:21-24`', nuevo: '`src/modules/invoicing/domain/modoVisible.ts:21-24`',
    fichero: 'src/modules/invoicing/domain/modoVisible.ts', rango: [21, 24], espera: '«se envía» NO EXISTE' },
  { doc: PRE, linea: 693, clase: 'N', viejo: '`libroRegistroView.js:231`', nuevo: '`libroRegistroView.js:246`', fichero: LIB, rango: [246, 246], espera: 'if (libro.miradas > 0) avisar(COPY.descuadre(libro.miradas)' , censo: 238 },
  { doc: PRE, linea: 693, clase: 'N', viejo: '(`:229`)', nuevo: '(`:244`)', fichero: LIB, rango: [244, 244], espera: 'if (asientos.length === 0)', censo: 236 },
  { doc: PRE, linea: 704, clase: 'N', viejo: '`libroRegistroView.js:53-55`', nuevo: '`libroRegistroView.js:60-62`', fichero: LIB, rango: [60, 62], espera: 'descuadre: (miradas) => rotulo(', censo: 60 },
  { doc: PRE, linea: 724, clase: 'N', viejo: '`libroRegistroView.js:223-225`', nuevo: '`libroRegistroView.js:238-240`', fichero: LIB, rango: [238, 240], espera: 'if (Array.isArray(libro.importesIlegibles) && libro.importesIlegibles.length > 0) {', censo: 230 },
  { doc: PRE, linea: 745, clase: 'L', viejo: '`libroRegistroView.js:226`', nuevo: '`libroRegistroView.js:241`', fichero: LIB, rango: [241, 241], espera: 'if (libro.ajenas > 0) avisar(COPY.avisoAjenas' },
  { doc: PRE, linea: 764, clase: 'L', viejo: '`libroRegistroView.js:227`', nuevo: '`libroRegistroView.js:242`', fichero: LIB, rango: [242, 242], espera: 'if (libro.sinNumero > 0) avisar(COPY.avisoSinNumero(libro.sinNumero)' },
  { doc: PRE, linea: 786, clase: 'N', viejo: '`libroRegistroView.js:332-334`', nuevo: '`libroRegistroView.js:346-349`', fichero: LIB, rango: [346, 349], espera: 'if (e.albaranesNoSellados > 0) {', censo: 339 },
];

// La nota fechada del contrato del auditlog. Va en la línea 2, que estaba EN BLANCO: no añade líneas.
export const NOTA = {
  doc: 'docs/legal/AUDITLOG_FISCAL_CONTRATO.md',
  linea: 2,
  viejo: '',
  nuevo: '**⚠️ NOTA FECHADA · 13-oct-2026 · SCRUM-1524c (decisión del fundador, SCRUM-1524 c.19292). Este documento se deja COMO SE ESCRIBIÓ el 29-jul-2026 y NO describe el código de hoy.** La cabecera de abajo dice «Cero código» y «Nada de esto está implementado»: dejó de ser cierto **el mismo 29-jul-2026**, cuando el commit `df8890e63` (fechado ese día a las 16:33, tres horas después del que trajo este contrato) cambió `src/` en nombre de SCRUM-207. Las coordenadas de fichero y línea que cita son las de aquel día y **NO se han puesto al día, a propósito**: medido el 13-oct-2026 (SCRUM-1524b, Jira c.19280), 42 están desfasadas —28 desplazadas y 14 que ya apuntan a otra cosa— y en al menos 6 el código que describían se reescribió; corregirles el número dejaría un texto de julio con aspecto de recién verificado. **NO MEDIDO: cuánto de lo que aquí se propone está construido hoy.** Esta nota no lo dice en ningún sentido; qué hace el sistema se lee en el código, no aquí.',
};
