// scripts/zona-roja.mjs — SCRUM-168
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ HACE: dice si una lista de ficheros toca la ZONA ROJA. Lo usa un job de CI que comenta
// en el PR. No bloquea, no aprueba, no exige nada.
//
// POR QUÉ EXISTE, con el encuadre YA CORREGIDO (decisión del fundador, 27-jul-2026):
//
// El ticket lo planteaba como complemento de un gate de «Require review from Code Owners»
// vía `.github/CODEOWNERS`, redundante para el carril B y útil solo para anunciar el bypass
// del carril A. **Ese gate no va a existir: el fundador ha decidido no activarlo.** Así que
// esto no complementa nada — **es la única señal que hay sobre la zona roja**, para los dos
// carriles. Cambia lo que se le puede exigir: no puede permitirse callar.
//
// (Verificado además, y por eso el encuadre viejo tampoco describía el presente: `.github/
// CODEOWNERS` NO EXISTE ni ha existido nunca. `git log --all --diff-filter=A -- '*CODEOWNERS*'`
// no devuelve ningún commit en ninguna rama de `origin`, y `docs/ASESOR.md` §5 sigue siendo el
// texto anterior a mecanizar. Tres tickets —168, 176 y 179— se apoyaban en un «commit de Task 3»
// que no está en el repositorio remoto. Puede estar sin empujar en la máquina de su autor;
// desde aquí no se puede saber y no se afirma. Es el patrón de los incidentes #7 y #10.)
//
// DÓNDE VIVE LA LISTA: AQUÍ, y en un solo sitio. El workflow y el test leen ESTA constante —
// no cada uno la suya. Dos listas a mano que deben cuadrar es el fallo de `ADMIN_ONLY_ROUTES`
// (SCRUM-158), y el propio ticket avisaba de él. La prosa de `docs/PLAN_EJECUCION_Y_PARALELO.md`
// §3.2 se comprueba contra esta constante en el test: si alguien edita el documento y no la
// constante, sale rojo. La documentación describe; el código decide.
// ─────────────────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';

/**
 * LA ZONA ROJA. Cada entrada con su motivo: una lista de rutas sin el porqué se convierte en
 * folclore y nadie se atreve a quitar nada.
 */
export const ZONA_ROJA = [
  { patron: 'prisma/schema.prisma', porque: 'schema de producción; §3 de ASESOR es el único freno duro' },
  { patron: 'src/app.ts', porque: 'montaje de rutas y auth: lo tocan los dos carriles' },
  { patron: 'jobs.routes.ts', porque: 'la ruta más caliente del carril A' },
  { patron: 'public/dashboard/js/jobDetailView.js', porque: 'pantalla estrella; rediseño por fases' },
  { patron: 'homeView.js', porque: 'idem, entrada del dashboard' },
  { patron: 'docs/QA/SUITE_REGRESION.md', porque: 'guion de QA compartido' },
  { patron: 'package.json', porque: 'dependencias y scripts: un cambio afecta a todas las sesiones' },
  { patron: 'docs/YAQU_MASTER.md', porque: 'única fuente de verdad (regla 35)' },
];

/**
 * HUECOS DECLARADOS — lo que esta señal NO cubre, dicho en voz alta.
 *
 * Un hueco visible es mejor que una protección decorativa: la decorativa se cuenta como
 * cobertura y nadie vuelve a mirarla.
 */
export const HUECOS_DECLARADOS = [
  {
    que: 'los serializers',
    porque:
      'no son una ruta. Estaban en la lista como `jobs.routes.ts (serializers)`, y esa entrada ' +
      'no cubría lo que decía cubrir: `serializ` aparece hoy en 11 ficheros de 8 módulos ' +
      '(jobs, maintenance, exports, expenses, invoicing, quotes, core/http, core/i18n). Cualquier ' +
      'patrón de ruta que los persiga o deja fuera la mayoría o marca medio repo.',
    precedente:
      'SCRUM-97: los serializers filtraban IBAN y portalToken. Y `portalToken` vive hoy en 5 ' +
      'ficheros, NINGUNO de ellos `jobs.routes.ts` — o sea que el precedente exacto que ' +
      'justificaba la entrada caía fuera de ella.',
  },
];

/**
 * ¿Casa un fichero con un patrón? Cubre las formas que se usan de verdad en esta lista:
 *   `tests/` o `/tests/`  → cualquier cosa bajo ese directorio
 *   `src/app.ts`          → esa ruta exacta
 *   `homeView.js`         → ese nombre de fichero, esté donde esté
 *   `*.ts`                → esa extensión, en cualquier sitio
 * NO cubre `**`, negaciones (`!`) ni clases de caracteres: si algún día hacen falta, se añaden
 * CON su caso de test. Aceptar en silencio un patrón que no se entiende es cómo un guard
 * empieza a mentir.
 */
export function casa(fichero, patron) {
  const f = fichero.replace(/\\/g, '/').replace(/^\.?\//, '');
  const p = patron.replace(/\\/g, '/').replace(/^\//, '');

  if (p.endsWith('/')) return f === p.slice(0, -1) || f.startsWith(p);
  if (p.startsWith('*.')) return f.endsWith(p.slice(1));
  if (!p.includes('/')) return path.posix.basename(f) === p;
  return f === p || f.startsWith(`${p}/`);
}

export function tocaZonaRoja(ficheros, zona = ZONA_ROJA) {
  const golpes = [];
  for (const f of ficheros) {
    const entrada = zona.find((z) => casa(f, z.patron));
    if (entrada) golpes.push({ fichero: f, patron: entrada.patron, porque: entrada.porque });
  }
  return golpes;
}

/** Los literales entre acentos graves de la línea "ZONA ROJA" del PLAN — para el test de deriva. */
export function patronesDocumentados(textoPlan) {
  const linea = textoPlan.split('\n').find((l) => /ZONA ROJA/.test(l));
  if (!linea) return [];
  return [...linea.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim()).filter(Boolean);
}

export const MARCA = '<!-- yaqu:zona-roja -->'; // ancla para no acumular un comentario por push

export function informe(golpes) {
  return (
    `${MARCA}\n### 🔴 Este PR toca la zona roja\n\n` +
    golpes.map((g) => `- \`${g.fichero}\` → \`${g.patron}\` · ${g.porque}`).join('\n') +
    `\n\nEsto **no bloquea nada** y no pide aprobación: deja constancia. No hay gate de ` +
    `«Require review from Code Owners» y no va a haberlo (decisión del fundador), así que ` +
    `**este aviso es la única señal que existe sobre la zona roja** — para los dos carriles. ` +
    `Quien la toca lo avisa en el ticket (ASESOR §4); si este PR va sin revisión cruzada, que ` +
    `sea a la vista y no por descuido.\n\n` +
    `<sub>Fuera de cobertura, a sabiendas: ` +
    HUECOS_DECLARADOS.map((h) => h.que).join(', ') +
    ` — ver \`scripts/zona-roja.mjs\`.</sub>\n`
  );
}

// ── CLI: `node scripts/zona-roja.mjs <fichero-con-la-lista>` ──────────────────────────────
// Lee las rutas cambiadas (una por línea, que es lo que escupe `git diff --name-only`) y
// escribe el informe en stdout; vacío si no toca nada. Sale 0 SIEMPRE: este aviso no bloquea,
// y un job que puede tumbar un PR por un fallo suyo se acaba quitando — y entonces no avisa.
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const lista = process.argv[2];
  const ficheros =
    lista && fs.existsSync(lista)
      ? fs.readFileSync(lista, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
      : [];
  const golpes = tocaZonaRoja(ficheros);
  if (golpes.length) process.stdout.write(informe(golpes));
  process.exit(0);
}
