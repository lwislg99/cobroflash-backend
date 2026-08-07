// scripts/_guard-microcopy-mecanismo.mjs — SCRUM-397
//
// UN MICROCOPY OFICIAL NO PUEDE AFIRMAR NADA DE UN MECANISMO APAGADO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// DE DÓNDE SALE
//
// La frase que explica al profesional de dónde sale la fecha de un cobro se propuso TRES veces
// y las dos primeras se devolvieron:
//
//   1ª · nombraba «Bizum automático» — que no existe en ninguna pantalla, solo en comentarios.
//   2ª · nombraba «efectivo» — que está en el conjunto cerrado `PAID_VIA` pero **ninguna ruta lo
//        escribe**: es inalcanzable.
//
// Y el dato que mató a las dos: `BIZUM_MANUAL_ENABLED` y `BIZUM_AUTO_ENABLED` están en `false`.
// Una frase que explica cómo se confirma un Bizum describe algo que hoy no ocurre.
//
// ⚠️ LO QUE ESTO EVITA NO ES UN CAMBIO DE ESTILO. Es volver a afirmar algo de un mecanismo
// apagado — la misma familia que la regla 24 y que SCRUM-400: prometer lo que no funciona.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ DERIVA EL ESTADO Y NO LLEVA UNA LISTA
//
// El guard NO tiene escrito «prohibido decir Bizum». Lee `src/core/flags.ts` y `PAID_VIA`, y
// pregunta por cada mecanismo si HOY es alcanzable. Consecuencias, las dos deliberadas:
//
//   · el día que se encienda `BIZUM_MANUAL_ENABLED`, la frase PODRÁ nombrar Bizum sin tocar este
//     fichero — el guard deja de quejarse solo;
//   · y si alguien apaga la tarjeta, la frase actual pasará a estar mal y el guard lo dirá.
//
// Un guard con la lista escrita a mano habría que desactivarlo el día que cambie el producto, y
// un guard que se desactiva no protege de nada.
import fs from 'node:fs';
import path from 'node:path';

/** El ancla con la que se marca un microcopy aprobado, viva donde viva (doc o interfaz). */
export const ANCLA = 'MICROCOPY-OFICIAL:fecha-de-cobro';

/**
 * Mecanismos de cobro que el microcopy podría nombrar, y CÓMO se sabe si están vivos.
 *
 * `flags`: banderas que lo gobiernan — vivo si alguna está en `true`.
 * `escrituraEnCodigo`: patrón que demuestra que ALGUNA ruta lo escribe de verdad. Un valor que
 *   nadie escribe es inalcanzable aunque no tenga bandera (el caso de `cash`).
 */
export const MECANISMOS = Object.freeze({
  bizum: {
    terminos: /\bbizum\b/i,
    flags: ['BIZUM_MANUAL_ENABLED', 'BIZUM_AUTO_ENABLED'],
    escrituraEnCodigo: /method:\s*'bizum_manual'/,
  },
  efectivo: {
    terminos: /\b(efectivo|met[aá]lico)\b/i,
    flags: [],
    escrituraEnCodigo: /method:\s*'cash'/,
  },
  tarjeta: {
    terminos: /\btarjetas?\b/i,
    flags: [],
    escrituraEnCodigo: /method:\s*'card'/,
  },
});

/** Lee el valor de una bandera en el texto de `flags.ts`. `null` si no está declarada. */
export function valorDeBandera(fuenteFlags, nombre) {
  const m = new RegExp(`^\\s*${nombre}\\s*:\\s*(true|false)\\s*,`, 'm').exec(String(fuenteFlags ?? ''));
  return m ? m[1] === 'true' : null;
}

/** ¿Está VIVO ese mecanismo hoy? Vivo = alguien lo escribe Y (sin banderas o alguna encendida). */
export function estaVivo(clave, { fuenteFlags, fuenteCodigo }) {
  const m = MECANISMOS[clave];
  if (!m) return { vivo: false, motivo: `mecanismo «${clave}» no declarado` };

  const seEscribe = m.escrituraEnCodigo.test(fuenteCodigo ?? '');
  if (!seEscribe) return { vivo: false, motivo: 'ninguna ruta del código lo escribe: es inalcanzable' };

  if (m.flags.length === 0) return { vivo: true, motivo: 'se escribe y no depende de ninguna bandera' };

  const estados = m.flags.map((f) => [f, valorDeBandera(fuenteFlags, f)]);
  const desconocidas = estados.filter(([, v]) => v === null).map(([f]) => f);
  if (desconocidas.length) {
    // 🔴 SUELO: una bandera que no se pudo leer NO se supone encendida ni apagada. No se aprueba.
    return { vivo: null, motivo: `no se pudo leer el estado de ${desconocidas.join(', ')} en flags.ts` };
  }
  const encendidas = estados.filter(([, v]) => v === true).map(([f]) => f);
  return encendidas.length
    ? { vivo: true, motivo: `encendido por ${encendidas.join(', ')}` }
    : { vivo: false, motivo: `apagado: ${estados.map(([f]) => `${f}=false`).join(' · ')}` };
}

/** Extrae los microcopys marcados con el ancla. Devuelve `[{ fichero, linea, texto }]`. */
export function extraerMicrocopys(ficheros) {
  const fuera = [];
  for (const { ruta, texto } of ficheros) {
    if (texto == null) continue;
    const lineas = texto.split(/\r?\n/);
    lineas.forEach((l, i) => {
      if (!l.includes(ANCLA)) return;
      // El microcopy es lo que va DESPUÉS del ancla en la misma línea, o la línea siguiente no vacía.
      const trasAncla = l.slice(l.indexOf(ANCLA) + ANCLA.length).replace(/^[\s:>*|\-–—]*/, '').replace(/-->\s*$/, '').trim();
      let texto2 = trasAncla;
      let linea = i + 1;
      if (!texto2) {
        for (let j = i + 1; j < lineas.length && j < i + 5; j++) {
          const s = lineas[j].replace(/^[\s>*|]*/, '').trim();
          if (s) { texto2 = s; linea = j + 1; break; }
        }
      }
      if (texto2) fuera.push({ fichero: ruta, linea, texto: texto2 });
    });
  }
  return fuera;
}

/** La comprobación. PURA: recibe los textos. Su rojo se ejercita sin ficheros. */
export function comprobar({ ficheros, fuenteFlags, fuenteCodigo }) {
  const lineas = [];
  let fallos = 0;

  const micros = extraerMicrocopys(ficheros);

  // 🔴 SUELO: sin microcopys que mirar, esto no es un verde. Si el ancla desaparece o se
  // renombra, «cero infracciones» y «no encontré el texto» dan el mismo verde.
  if (micros.length === 0) {
    return {
      ok: false,
      salida: `🔴 SUELO: no se encontró NINGÚN microcopy marcado con «${ANCLA}».\n` +
        '   «Cero infracciones» y «no encontré el texto que vigilo» dan el mismo verde y\n' +
        '   significan lo contrario. Si el texto se movió, actualiza el ancla en el MISMO commit.',
    };
  }
  lineas.push(`  [microcopy] ${micros.length} texto(s) oficial(es) con el ancla`);

  for (const m of micros) {
    const nombrados = Object.keys(MECANISMOS).filter((k) => MECANISMOS[k].terminos.test(m.texto));
    if (nombrados.length === 0) {
      lineas.push(`  ⚠️ ${m.fichero}:${m.linea}: no nombra ningún mecanismo de cobro`);
      continue;
    }
    for (const clave of nombrados) {
      const v = estaVivo(clave, { fuenteFlags, fuenteCodigo });
      if (v.vivo === true) { lineas.push(`  ✅ ${m.fichero}:${m.linea}: nombra «${clave}» — vivo (${v.motivo})`); continue; }
      fallos++;
      lineas.push(`\n🔴 EL MICROCOPY OFICIAL NOMBRA UN MECANISMO QUE HOY NO LO ESTÁ.\n`);
      lineas.push(`   ${m.fichero}:${m.linea}`);
      lineas.push(`   «${m.texto.slice(0, 170)}»`);
      lineas.push('');
      // APAGADO e INALCANZABLE no son lo mismo y no se arreglan igual: uno se enciende con una
      // bandera, el otro no existe en el producto. Decir «apagado» del segundo manda a buscar un
      // interruptor que no hay.
      const etiqueta = v.vivo === null ? 'NO SE PUDO DETERMINAR'
        : /inalcanzable/.test(v.motivo) ? 'INALCANZABLE (ninguna ruta lo escribe)'
          : 'APAGADO';
      lineas.push(`   Mecanismo: ${clave} → ${etiqueta}`);
      lineas.push(`   Motivo:    ${v.motivo}`);
      lineas.push('');
      lineas.push('   Esto NO es un reparo de estilo: la frase afirmaría al profesional algo que hoy');
      lineas.push('   no ocurre. Es la familia de la regla 24 y de SCRUM-400 — prometer lo apagado.');
      lineas.push('');
      lineas.push('   Ya se devolvieron DOS versiones por esto: una nombraba «Bizum automático» (que');
      lineas.push('   no existe en pantalla) y otra «efectivo» (que ninguna ruta escribe).');
      lineas.push('');
      lineas.push('   Qué hacer: quitar ese mecanismo de la frase. Y si de verdad se ha encendido,');
      lineas.push('   este guard lo verá solo — lee `flags.ts`, no una lista escrita a mano.');
    }
  }
  return { ok: fallos === 0, salida: lineas.join('\n') };
}

/** Lee del disco y comprueba. `null` en lo que no pueda leer, para que el suelo lo vea. */
export function comprobarEnDisco(raiz = process.cwd()) {
  const leer = (rel) => { try { return fs.readFileSync(path.join(raiz, rel), 'utf8'); } catch { return null; } };
  // Dónde puede vivir un microcopy oficial: la entrada que lo aprueba y la interfaz.
  const candidatos = [
    'docs/master/SCRUM-397.md',
    'public/dashboard/js/invoiceDetailView.js',
    'public/dashboard/js/reportsView.js',
  ];
  // El código donde se comprueba qué métodos se escriben de verdad.
  const codigo = [
    'src/modules/billing/app/routes/chargesAdmin.routes.ts',
    'src/modules/billing/app/routes/psp.routes.ts',
    'src/modules/billing/app/routes/mpWebhook.routes.ts',
    'src/modules/payments/connect/connectWebhook.routes.ts',
  ].map(leer).filter(Boolean).join('\n');

  return comprobar({
    ficheros: candidatos.map((ruta) => ({ ruta, texto: leer(ruta) })),
    fuenteFlags: leer('src/core/flags.ts'),
    fuenteCodigo: codigo,
  });
}
