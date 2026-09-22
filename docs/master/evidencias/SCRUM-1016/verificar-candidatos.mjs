// docs/master/evidencias/SCRUM-1016/verificar-candidatos.mjs — SCRUM-1016i
//
// Verificación PURA (no toca public/index.html) de los candidatos de H1/subtítulo/cabecera contra
// los tres guards reales que hoy bloquean el literal firmado 16427/16513: SCRUM-299 (trinquete de
// "factura"), SCRUM-400 (conformidad vs. documento real) y el ban literal de "declaración
// responsable" (regresión de tests/scrum400-conformidad-landing.test.mjs:163). Importa las
// funciones reales de los guards y les pasa los literales candidatos como strings.
//
// Uso: node docs/master/evidencias/SCRUM-1016/verificar-candidatos.mjs   (desde la raíz del repo)
import { promesasDeFactura } from '../../../../tests/_copy-publico.mjs';
import { comprobar } from '../../../../scripts/_guard-conformidad-landing.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const DOC_PLANTILLA = fs.readFileSync(path.join(RAIZ, 'docs/legal/DECLARACION_RESPONSABLE.md'), 'utf8');

const REGLA26_ESTADO = /(certificaci[oó]n|certificad[oa]s?|homologad[oa]s?|conforme|conformidad|cumple|declaraci[oó]n responsable|adaptad[oa]s?|validad[oa]s? por)/i;
const REGLA26_FISCAL = /(veri\s*\*?\s*factu|verifactu|aeat|hacienda|rrsif|rd\s*1007|1007\/2023|hac\/1177|sistema inform[aá]tico de facturaci[oó]n|productor del sistema)/i;
const REGULADOS = /(veri\s*\*?\s*factu|verifactu|\baeat\b|hacienda|\brrsif\b|declaraci[oó]n responsable)/i;

function evaluarCandidato(nombre, { h1, sub, title }) {
  console.log(`\n===== ${nombre} =====`);

  const bloqueHero = `<h1 id="reg-hero">${h1}</h1>\n<p class="sub">${sub}</p>`;
  const cabecera = `<title>${title}</title>\n<meta property="og:title" content="${title}"/>\n<meta name="twitter:title" content="${title}"/>`;

  const promesasHero = promesasDeFactura(bloqueHero);
  const promesasCabecera = promesasDeFactura(cabecera);
  console.log(`SCRUM-299 (promesas de factura) — hero: ${promesasHero.length}, cabecera: ${promesasCabecera.length}`);
  for (const p of [...promesasHero, ...promesasCabecera]) console.log(`   ⚠ [${p.marcador}] «${p.frag}»`);

  const r = comprobar({
    paginas: [
      { ruta: 'candidato:hero', html: bloqueHero },
      { ruta: 'candidato:cabecera', html: cabecera },
    ],
    documento: DOC_PLANTILLA,
  });
  console.log(`SCRUM-400 (comprobar, doc plantilla real) — ok: ${r.ok}`);
  if (!r.ok) console.log(r.salida.split('\n').map((l) => '   ' + l).join('\n'));

  const textoPlano = `${h1} ${sub} ${title}`;
  const banFrases = [
    ['VeriFactu en certificaci', /VeriFactu en certificaci/i],
    ['declaración responsable', /declaraci[oó]n responsable/i],
    ['como fabricante', /como fabricante/i],
  ];
  for (const [nom, re] of banFrases) {
    if (re.test(textoPlano)) console.log(`   🔴 BAN LITERAL (regresión SCRUM-400): contiene «${nom}»`);
  }

  if (REGULADOS.test(title)) {
    console.log('   🔴 regla 26: el <title>/og:title/twitter:title nombra un término regulado — condición (b) es estructuralmente imposible ahí (literal firmado, comentario 16432).');
  } else {
    console.log('   ✅ regla 26: el <title>/og:title/twitter:title NO nombra VeriFactu/AEAT/Hacienda/RRSIF/declaración responsable.');
  }

  const nombraEnHero = REGULADOS.test(`${h1} ${sub}`);
  if (nombraEnHero) {
    const estadoFiscalJuntos = REGLA26_ESTADO.test(sub) && REGLA26_FISCAL.test(sub);
    console.log(`   ℹ️  regla 26: el hero SÍ nombra un término regulado. ESTADO+FISCAL en la misma frase del subtítulo (dispararía SCRUM-400 con el doc sin emitir): ${estadoFiscalJuntos}`);
  } else {
    console.log('   ✅ regla 26: el hero (H1+subtítulo) no nombra ningún término regulado — la condición ni se aplica.');
  }

  console.log(`Longitud <title>: ${title.length} caracteres — "${title}"`);
  if (title.length > 60) console.log(`   ⚠ pasa de 60: visible "${title.slice(0, 60)}…"`);
}

evaluarCandidato('CANDIDATO 1 · Eje A con matiz citado (H2) en el subtítulo', {
  h1: 'Del presupuesto a la firma, <span class="hl">sin salir de WhatsApp.</span>',
  sub: 'Crea el presupuesto en 30 segundos y tu cliente lo firma desde el móvil por WhatsApp. Hoy generamos cada registro de facturación con el formato oficial de la AEAT; la remisión a Hacienda todavía no está construida, y los founding la estrenaréis sin cambio de precio.',
  title: 'YaQu — Del presupuesto a la firma, sin salir de WhatsApp',
});

evaluarCandidato('CANDIDATO 2 · Sin nombrar términos regulados (más cerca de 26b)', {
  h1: 'Del presupuesto a la firma, <span class="hl">sin salir de WhatsApp.</span>',
  sub: 'Crea el presupuesto en 30 segundos y tu cliente lo firma desde el móvil por WhatsApp. Clientes, gastos y trabajos en un mismo sitio — sin post-its ni Excel.',
  title: 'YaQu — Del presupuesto a la firma, sin salir de WhatsApp',
});

evaluarCandidato('CONTROL · literal firmado 16427/16513 (el que hoy falla)', {
  h1: 'Del presupuesto a la firma — <span class="hl">tu factura VeriFactu, sin cambiar de precio.</span>',
  sub: 'Crea el presupuesto en 30 segundos y tu cliente lo firma desde el móvil por WhatsApp. Cada registro de facturación ya sale con el formato oficial de la AEAT — la remisión a Hacienda se activa con la declaración responsable del fabricante, sin cambiar de precio.',
  title: 'YaQu — Presupuesto y firma; tu factura VeriFactu, en camino',
});
