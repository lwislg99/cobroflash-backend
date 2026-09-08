// scripts/_guard-arbol-y-borrado.mjs — SCRUM-685
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 QUÉ IMPIDE ESTO, Y TIENE FECHA
//
// El 2-sep-2026 se ejecutó `scripts/db-push-prod` —sin modificar, haciendo exactamente lo que
// promete— desde el checkout compartido, que estaba **1.933 commits detrás de `origin/main`**. Su
// preview propuso, contra **PRODUCCIÓN**:
//
//     DROP TABLE job_assignees · DROP TABLE email_messages
//     DROP COLUMN retencion_irpf_declarada / suplidos / paid_via / … (~30 columnas)
//
// El script no falló: comparó producción contra un esquema fósil y produjo el SQL correcto para
// esa entrada. **Lo que estaba mal era el árbol.**
//
// Lo pararon DOS cosas, y sólo una es diseño:
//   ① el GO explícito del script — protege **si alguien LEE el diff**;
//   ② que el shell de aquella sesión no tenía stdin, así que `read` recibió EOF y abortó solo.
//
// La ② es SUERTE. Este fichero convierte esa suerte en mecanismo.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS DOS PREGUNTAS QUE SE HACEN ANTES DE ENSEÑAR UN SOLO `ALTER`
//
//   A. ¿El árbol desde el que comparo **existe en el remoto y está al día**? Un esquema que no
//      se puede nombrar por su SHA no se puede auditar después.
//   B. ¿El SQL que saldría **borra algo**? Un push aditivo y un borrado destructivo NO comparten
//      aprobación. El borrado se aprueba en su propio ticket, o no se aprueba.
//
// 🔴 Y EL SUELO, que es el corazón del ticket: si `git fetch` FALLA, esto **aborta declarándolo**.
// «No pude comprobar» y «estoy al día» NO son el mismo verde. Un guard que ante la duda deja
// pasar es peor que no tenerlo, porque además tranquiliza.
import { clasificarFichero, RECHAZADA } from './_clasificador-sql.mjs';

export const AL_DIA = 'al_dia';
export const ATRASADO = 'atrasado';
export const ADELANTADO_PUBLICADO = 'adelantado_publicado';
export const ADELANTADO_SIN_PUBLICAR = 'adelantado_sin_publicar';
export const SUCIO = 'sucio';
export const CIEGO = 'ciego';

/**
 * ¿En qué estado está el árbol respecto al remoto?
 *
 * `git` se inyecta —un objeto con `fetch()`, `detras()`, `delante()`, `sucioSchema()`,
 * `enElRemoto()`— para poder ejercitar cada rama sin montar repositorios de mentira.
 *
 * ⚠️ **ESTAR POR DELANTE NO ES ESTAR DETRÁS, y se decide aquí en vez de dejarlo implícito:**
 *   · DETRÁS  → se prohíbe. Es el caso del 2-sep: el esquema es más viejo que la realidad y el
 *               diff propone borrar lo que se añadió mientras tanto.
 *   · DELANTE y el commit **está publicado** en el remoto → se PERMITE. Es el caso normal de una
 *     rama de esquema en revisión, y se puede auditar: el SHA existe y cualquiera puede traerlo.
 *   · DELANTE y el commit **NO está en el remoto** → se prohíbe. Ese esquema sólo existe en este
 *     disco: nadie podría reconstruir después contra qué se aplicó. No es un capricho de proceso;
 *     es la diferencia entre «se aplicó el esquema a3f9…» y «se aplicó lo que había en un portátil».
 */
export function estadoDelArbol(git) {
  const traido = git.fetch();
  if (!traido || traido.ok !== true) {
    return {
      estado: CIEGO,
      puedeSeguir: false,
      motivo:
        '🔴 CEGUERA: `git fetch origin` no pudo completarse' +
        (traido && traido.error ? ` (${traido.error})` : '') +
        '. Eso NO significa «estoy al día»: significa que no se ha podido comprobar, y las dos ' +
        'cosas no pueden salir por la misma línea. Sin saber si el árbol está atrasado, el ' +
        'preview puede proponer borrar lo que otros añadieron. Aborto sin enseñar SQL.',
    };
  }

  if (git.sucioSchema()) {
    return {
      estado: SUCIO,
      puedeSeguir: false,
      motivo:
        '🔴 `prisma/schema.prisma` tiene cambios SIN COMMITEAR. El esquema contra el que se ' +
        'compara tiene que existir en el remoto y poder nombrarse por su SHA: si no, mañana ' +
        'nadie puede decir qué se aplicó exactamente. Commitea y publica antes de aplicar.',
    };
  }

  const detras = git.detras();
  if (detras > 0) {
    return {
      estado: ATRASADO,
      puedeSeguir: false,
      detras,
      motivo:
        `🔴 ESTE ÁRBOL ESTÁ ${detras} COMMIT(S) DETRÁS DE origin/main. No se enseña ni una línea ` +
        'de SQL desde aquí.\n' +
        '   Un esquema más viejo que la realidad hace que el preview proponga BORRAR lo que se ' +
        'añadió mientras tanto — y el SQL sale correcto, porque la entrada es la equivocada.\n' +
        '   Pasó el 2-sep-2026 con 1.933 commits de retraso: DROP TABLE job_assignees, ' +
        'DROP TABLE email_messages y ~30 columnas de PRODUCCIÓN.\n' +
        '   Qué hacer: `git merge origin/main` en esta rama (nunca rebase), o ejecutar esto ' +
        'desde un worktree al día.',
    };
  }

  const delante = git.delante();
  if (delante > 0 && !git.enElRemoto()) {
    return {
      estado: ADELANTADO_SIN_PUBLICAR,
      puedeSeguir: false,
      delante,
      motivo:
        `🔴 este árbol va ${delante} commit(s) POR DELANTE y su commit NO está publicado en el ` +
        'remoto. Estar por delante no es el problema —una rama de esquema en revisión es normal—; ' +
        'el problema es que ese esquema sólo existe en este disco. Publica la rama (`git push`) ' +
        'para que lo aplicado pueda nombrarse por su SHA.',
    };
  }

  return {
    estado: delante > 0 ? ADELANTADO_PUBLICADO : AL_DIA,
    puedeSeguir: true,
    delante,
    motivo: null,
  };
}

/**
 * ¿El SQL del preview borra algo?
 *
 * 🔴 NO ES UN `grep DROP`, y la diferencia ya costó un rojo: el propio `_clasificador-sql.mjs`
 * cuenta que un auditor improvisado **se cazó a sí mismo** porque la palabra «DROPs» estaba en su
 * comentario. Aquí se reutiliza ese clasificador, que desnuda comentarios y cadenas, trocea en
 * sentencias y reconoce el `DROP COLUMN` **dentro de un `ALTER TABLE`** —que es exactamente la
 * forma en la que Prisma escribe los borrados—.
 *
 * Devuelve `{ hayBorrado, borrados, otrasNoAditivas, motivoGlobal }`.
 *
 * ⚠️ **Sólo el BORRADO aborta.** El clasificador rechaza además `ALTER COLUMN … TYPE`, y eso se
 * SEÑALA pero no corta: es la regla que se pidió («cualquier DROP TABLE o DROP COLUMN»), y una
 * regla más ancha de la acordada se aplicaría a espaldas de quien la acordó. Sale nombrado en el
 * informe para que el humano lo vea antes del GO.
 */
export function borradosDelPreview(sqlDelPreview) {
  const r = clasificarFichero(String(sqlDelPreview || ''));
  if (r.motivoGlobal) {
    // No se pudo leer. Mismo criterio que el suelo de arriba: «no supe mirarlo» no es «está limpio».
    return { hayBorrado: true, borrados: [], otrasNoAditivas: [], motivoGlobal: r.motivoGlobal };
  }
  const rechazadas = (r.rechazadas || []).filter((s) => s.veredicto === RECHAZADA);
  const borrados = rechazadas.filter((s) => /^(DROP|TRUNCATE|DELETE)$/.test(String(s.forma)));
  const otrasNoAditivas = rechazadas.filter((s) => !/^(DROP|TRUNCATE|DELETE)$/.test(String(s.forma)));
  return { hayBorrado: borrados.length > 0, borrados, otrasNoAditivas, motivoGlobal: null };
}

/** El texto que ve el operador cuando el preview trae borrados. */
export function informeDeBorrado(r) {
  if (r.motivoGlobal) return r.motivoGlobal;
  const lineas = [];
  lineas.push('🔴 EL PREVIEW CONTIENE ' + r.borrados.length + ' SENTENCIA(S) QUE BORRAN. NO se pide GO: se aborta.');
  lineas.push('');
  lineas.push('   Un push de esquema y un borrado destructivo NO comparten aprobación. Decir «GO»');
  lineas.push('   a un diff aditivo no puede llevarse por delante datos que nadie ha decidido');
  lineas.push('   borrar — y el 2-sep-2026 ese GO habría borrado dos tablas de producción.');
  lineas.push('');
  for (const s of r.borrados) {
    lineas.push(`   · [${s.forma}] línea ${s.linea}: ${String(s.sql).replace(/\s+/g, ' ').slice(0, 120)}`);
  }
  lineas.push('');
  lineas.push('   ANTES DE APROBAR NADA, LA PREGUNTA NO ES «¿lo apruebo?» SINO «¿QUÉ RAMA FALTA');
  lineas.push('   POR ENTRAR?». Producción puede ir POR DELANTE de main: si el fundador aplicó');
  lineas.push('   columnas a mano para desbloquear un PR que aún no se ha mergeado, este diff');
  lineas.push('   propondrá borrarlas. Búscalas antes de decidir:');
  lineas.push('     git log --oneline -S"<columna>" --all -- prisma/schema.prisma');
  if (r.otrasNoAditivas.length) {
    lineas.push('');
    lineas.push('⚠️  Además hay ' + r.otrasNoAditivas.length + ' sentencia(s) NO aditiva(s) que NO abortan,');
    lineas.push('   pero que conviene mirar antes de dar el GO:');
    for (const s of r.otrasNoAditivas) {
      lineas.push(`   · [${s.forma}] línea ${s.linea}: ${String(s.sql).replace(/\s+/g, ' ').slice(0, 120)}`);
    }
  }
  return lineas.join('\n');
}
