// scripts/_guard-conformidad-landing.mjs — SCRUM-400
//
// LA WEB NO PUEDE AFIRMAR UN ESTADO DE CONFORMIDAD SIN UN DOCUMENTO EMITIDO DETRÁS.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// DE DÓNDE SALE
//
// El 7-ago-2026 la landing decía, publicado: «Te contesto como fabricante: la facturación
// VeriFactu está construida y en certificación — **con declaración responsable del productor**,
// que es lo que tu gestor te pedirá», y llevaba una insignia «Facturación VeriFactu en
// certificación».
//
// Y `docs/legal/DECLARACION_RESPONSABLE.md` era —y es— una PLANTILLA con placeholders `[…]` cuya
// propia cabecera dice «NO publicar ni entregar a merchants hasta (1) SIF-1 8/8, (2) revisión del
// asesor fiscal, (3) datos reales del productor». **La web invocaba un documento que no está
// emitido.**
//
// ⚠️ ESTO NO ES UNA REGLA NUEVA. La entrada A4.1 del máster YA prohíbe «factura», «VeriFactu» y
// los claims fiscales en la landing. Lo que había publicado la incumplía. Este guard **no cambia
// la regla: la aplica**, y por eso retirarlo no requiere enmendar el máster ni puede revertirse
// alegando que fue una decisión de producto.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ COMPRUEBA, Y POR QUÉ NO ES UN `grep VeriFactu`
//
// Vigila la CONJUNCIÓN de dos cosas, no una palabra:
//
//   ① que el texto publicado afirme un ESTADO DE CONFORMIDAD (certificado, en certificación,
//      homologado, conforme al RRSIF, con declaración responsable, cumple el RD…), y
//   ② que ese estado no esté respaldado por un documento EMITIDO.
//
// Por eso una landing que hable de «facturas» como funcionalidad no cae, y una que diga «estamos
// certificados» sí. Y por eso, el día que el documento se emita de verdad, el guard **deja pasar
// la afirmación** sin tocarle una línea: vigila el hecho, no el vocabulario.
//
// Se retiran los comentarios HTML y los bloques `<script>`/`<style>` antes de mirar: un guard de
// texto que lee comentarios acaba vigilando la explicación en vez de lo publicado (SCRUM-349, y
// mordió el mismo día en SCRUM-395).
import fs from 'node:fs';
import path from 'node:path';

/** Páginas públicas que un visitante lee. La promesa comercial vive aquí. */
export const PAGINAS = ['public/index.html', 'public/precios.html', 'public/terminos.html', 'public/privacidad.html'];
export const DOCUMENTO = 'docs/legal/DECLARACION_RESPONSABLE.md';

/** Texto publicado: sin comentarios, sin script/style, sin etiquetas. Conserva las líneas. */
export function textoPublicado(html) {
  let s = String(html ?? '');
  const hueco = (m) => m.replace(/[^\n]/g, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, hueco);
  s = s.replace(/<script\b[\s\S]*?<\/script>/gi, hueco);
  s = s.replace(/<style\b[\s\S]*?<\/style>/gi, hueco);
  s = s.replace(/<[^>]+>/g, (m) => (m.includes('\n') ? hueco(m) : ' '));
  return s;
}

/**
 * Afirmaciones de conformidad: un término de ESTADO junto a uno FISCAL, en la misma frase.
 *
 * La proximidad es lo que evita el falso positivo: «conforme a nuestra Política de Privacidad» y
 * «conforme al artículo 30 del Código de Comercio» son conformidades de otra cosa, y no llevan al
 * lado ningún término fiscal nuestro.
 */
const ESTADO = /(certificaci[oó]n|certificad[oa]s?|homologad[oa]s?|conforme|conformidad|cumple|declaraci[oó]n responsable|adaptad[oa]s?|validad[oa]s? por)/i;
const FISCAL = /(veri\s*\*?\s*factu|verifactu|aeat|hacienda|rrsif|rd\s*1007|1007\/2023|hac\/1177|sistema inform[aá]tico de facturaci[oó]n|productor del sistema)/i;

/** Un «fabricante/productor» declarado en contexto fiscal también es una afirmación de estado. */
const AUTONOMBRAMIENTO = /(como fabricante|somos (el )?fabricante|como productor|somos (el )?productor)/i;

export function afirmacionesDeConformidad(html) {
  const texto = textoPublicado(html);
  const fuera = [];
  const lineas = texto.split(/\r?\n/);
  lineas.forEach((linea, i) => {
    // Se parte en frases: la proximidad se mide dentro de la frase, no del párrafo entero.
    for (const frase of linea.split(/(?<=[.;!?])\s+/)) {
      const limpia = frase.replace(/\s+/g, ' ').trim();
      if (!limpia) continue;
      const estado = ESTADO.test(limpia) && FISCAL.test(limpia);
      const auto = AUTONOMBRAMIENTO.test(limpia);
      if (estado || auto) {
        fuera.push({
          linea: i + 1,
          texto: limpia.slice(0, 160),
          motivo: auto && !estado ? 'se declara fabricante/productor de un sistema de facturación'
            : 'afirma un estado de conformidad fiscal',
        });
      }
    }
  });
  return fuera;
}

/**
 * ¿Está EMITIDO el documento? Emitido = sin placeholders y sin la cabecera de «no publicar».
 *
 * 🔴 SUELO: un documento que no se puede leer NO cuenta como emitido. «No lo encontré» y «está
 * emitido» no pueden terminar en el mismo verde: el segundo autoriza a publicar una afirmación.
 */
export function documentoEmitido(md) {
  if (md == null) return { emitido: false, motivos: ['no se pudo leer el documento'] };
  const s = String(md);
  if (!s.trim()) return { emitido: false, motivos: ['el documento está vacío'] };
  const motivos = [];

  // Los PLACEHOLDERS se buscan en TODO el documento: uno sin rellenar en el cuerpo impide
  // emitirlo igual que en la cabecera.
  const placeholders = s.match(/\[[^\]\n]{1,60}\]/g) || [];
  // Se descartan los enlaces markdown [texto](url), que no son placeholders.
  const reales = placeholders.filter((p) => !new RegExp(`${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(`).test(s));
  if (reales.length) motivos.push(`quedan ${reales.length} placeholder(s) sin rellenar (p. ej. ${reales.slice(0, 3).join(', ')})`);
  if (/\[VALIDAR ASESOR\]/i.test(s)) motivos.push('tiene marcas [VALIDAR ASESOR] pendientes');

  // «NO publicar» cuenta EN TODO EL DOCUMENTO: es una instrucción explícita y no tiene uso
  // legítimo en prosa. Donde aparezca, alguien está diciendo que esto no sale.
  if (/NO\s+publicar/i.test(s)) motivos.push('lleva el aviso de «NO publicar»');

  // ⚠️ «PLANTILLA», en cambio, solo cuenta EN LA CABECERA — y la diferencia la destapó la prueba
  // de rojo R3. Este documento termina con un pie de procedencia: «*Plantilla creada el
  // 13-jun-2026 (S1-E)*». Buscándola en todo el texto, no podría darse por emitido JAMÁS sin
  // borrar esa línea, y borrar el registro de cuándo se creó algo es lo contrario de lo que se
  // hace aquí. Un guard que solo se satisface destruyendo historia acaba desactivado.
  //
  // Los dos criterios NO son el mismo, y por eso no comparten regla: uno es una orden, el otro
  // es una palabra que también aparece contando historia.
  if (/\bPLANTILLA\b/i.test(cabeceraDe(s))) motivos.push('la cabecera lo declara PLANTILLA');

  return { emitido: motivos.length === 0, motivos };
}

/**
 * La CABECERA: el título y el bloque de aviso (`>`) del principio, que es donde un documento
 * declara su propio estado. Se corta en el primer contenido normal — a partir de ahí es cuerpo,
 * y lo que diga sobre plantillas es prosa, no estado.
 */
export function cabeceraDe(md) {
  const fuera = [];
  for (const linea of String(md ?? '').split(/\r?\n/)) {
    const t = linea.trim();
    if (!t || t.startsWith('#') || t.startsWith('>')) { fuera.push(linea); continue; }
    break;
  }
  return fuera.join('\n');
}

/** La comprobación completa. PURA: recibe los textos, no los lee. Su rojo se ejercita sin ficheros. */
export function comprobar({ paginas, documento }) {
  const lineas = [];
  let fallos = 0;

  const doc = documentoEmitido(documento);
  lineas.push(doc.emitido
    ? `  [documento] ${DOCUMENTO}: EMITIDO`
    : `  [documento] ${DOCUMENTO}: NO EMITIDO — ${doc.motivos.join(' · ')}`);

  // 🔴 SUELO: sin páginas que mirar, esto no es un verde.
  const conTexto = paginas.filter((p) => p.html != null && String(p.html).trim());
  if (conTexto.length === 0) {
    return {
      ok: false,
      salida: '🔴 SUELO: no se pudo leer NINGUNA página pública. «Cero afirmaciones encontradas» y\n' +
        '   «no supe leer la landing» dan el mismo verde y significan lo contrario.',
    };
  }
  if (conTexto.length < paginas.length) {
    fallos++;
    const faltan = paginas.filter((p) => !conTexto.includes(p)).map((p) => p.ruta);
    lineas.push(`  🔴 no se pudieron leer: ${faltan.join(', ')} — no se aprueba lo que no se ha mirado`);
  }

  for (const p of conTexto) {
    const afirm = afirmacionesDeConformidad(p.html);
    if (afirm.length === 0) { lineas.push(`  ✅ ${p.ruta}: sin afirmaciones de conformidad`); continue; }
    if (doc.emitido) {
      lineas.push(`  🟡 ${p.ruta}: ${afirm.length} afirmación(es), permitidas — el documento está emitido`);
      for (const a of afirm) lineas.push(`       línea ${a.linea}: «${a.texto}»`);
      continue;
    }
    fallos++;
    lineas.push(`\n🔴 ${p.ruta} AFIRMA CONFORMIDAD Y EL DOCUMENTO NO ESTÁ EMITIDO.\n`);
    for (const a of afirm) {
      lineas.push(`   línea ${a.linea} · ${a.motivo}:`);
      lineas.push(`   «${a.texto}»`);
    }
    lineas.push('');
    lineas.push(`   Por qué NO está emitido: ${doc.motivos.join(' · ')}.`);
    lineas.push('');
    lineas.push('   Esto NO es una regla nueva: la entrada A4.1 del máster ya prohíbe los claims');
    lineas.push('   fiscales en la landing. Lo publicado la incumplía.');
    lineas.push('');
    lineas.push('   Qué hacer: RETIRAR la afirmación. No sustituirla por otra —cualquier texto nuevo');
    lineas.push('   sería microcopy sin aprobar (regla 30)—, y no relajar este guard. Cuando el');
    lineas.push('   documento esté emitido de verdad, la afirmación pasa sola.');
  }

  return { ok: fallos === 0, salida: lineas.join('\n') };
}

/** Lee del disco y comprueba. Devuelve `null` en lo que no pueda leer, para que el suelo lo vea. */
export function comprobarEnDisco(raiz = process.cwd()) {
  const leer = (rel) => { try { return fs.readFileSync(path.join(raiz, rel), 'utf8'); } catch { return null; } };
  return comprobar({
    paginas: PAGINAS.map((ruta) => ({ ruta, html: leer(ruta) })),
    documento: leer(DOCUMENTO),
  });
}
