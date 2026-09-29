# SCRUM-1284 · Minutos de Actions: medición repetible y recortes de repetición

**Medido contra:** `origin/main` = `d2451dbe39f38afc2116e11ce87f5d57c7f1458d` · 2026-09-29T16:20:49Z

Encargo del orquestador (`cobroflash-backend-57`), 29-sep-2026, para una decisión de dinero del
fundador: pasar el repositorio a privado, donde GitHub cobra los minutos de Actions. El fundador
decidió después dejarlo **público** (SCRUM-1283), pero los recortes siguen valiendo: el 72 % de lo que
se consume son comprobaciones que no bloquean nada, y eso también ocupa runners.

## Lo medido (22–28 sep, 7 días completos)

`node scripts/equipo/minutos-actions.mjs --desde 2026-09-22 --hasta 2026-09-28`. Minutos
**facturables**: cada job por separado y redondeado al minuto hacia arriba; los `skipped` no cuentan y
los intentos anteriores de una corrida relanzada sí.

| flujo | corridas | min/semana | % |
|---|---|---|---|
| CI | 802 | 28.852 | 93 % |
| PR automático | 526 | 549 | 2 % |
| Claude Code | 206 (103 con runner) | 523 | 2 % |
| Zona roja | 493 | 505 | 2 % |
| Avisador de PR en rojo | 823 (332 con runner) | 333 | 1 % |
| Conflicto de registro | 309 | 271 | 1 % |
| Vigías programados (los dos) | 70 | 74 | 0 % |
| **Total** | **3.229** | **31.107** | ≈ 133.000 min/mes |

| job del CI | min/semana | media |
|---|---|---|
| meta-guard (informativo) | 8.217 | 12,1 min |
| trinquete de zona (informativo; corre la tanda entera dos veces) | 7.523 | 10,9 |
| guards de navegador (informativo) | 6.505 | 9,4 |
| **build + tests (obligatorio)** | 5.120 | 7,3 |
| constancia del ALTER | 779 | 0,7 |
| vigía del despliegue | 708 | 0,3 |

Precio: Linux 2 núcleos a **0,006 $/min** desde el 1-ene-2026 (changelog de GitHub «Reduced pricing
for GitHub-hosted runners usage»). En privado, sin recortes: ≈ 680 €/mes. La primera estimación
(270 €/mes) medía la duración de la CORRIDA; GitHub factura cada JOB, y el CI lanza seis en paralelo.

## Lo que entra en este PR

| # | recorte | min/semana | vigilancia que se pierde |
|---|---|---|---|
| R4 | el job «vigía del despliegue» solo en push a `main` | ~576 | ninguna: mide producción contra `main`, que no depende del PR; sigue en cada merge y cada 2 h en `vigia-despliegue.yml` |
| R1 | «guards de navegador» no arranca en un PR que solo toca documentación | ~1.310 (156 corridas × ~8,4 min) | ninguna: los 38 `guard:*` no leen `docs/`; el resumen del job dice «NO se han corrido» |

### R1 se midió antes, y se quedó en un tercio

La propuesta era sacar los tres informativos pesados de los PR que solo tocan documentación
(5.344 min/semana). Medido con el censo del meta-guard y un barrido de `tests/`:

- **meta-guard SÍ depende de `docs/`**: 2 de sus 127 ficheros objetivo están allí
  (`scrum758` → `docs/MIGRATIONS_PENDING.md`, `scrum769` → un fichero de `docs/microcopy/`) y 30 guards
  declarantes nombran rutas de `docs/`. Se queda corriendo siempre.
- **el trinquete corre la tanda entera**, y 193 ficheros de test leen `docs/`: una fecha nueva en un
  registro puede volver sensible a la zona un test que la lee. Se queda corriendo siempre.
- **navegador**: ninguno de los 38 scripts `guard:*` nombra `docs/`. Solo este job sale del recorte.

`build + tests` no se toca en ningún caso.

## Descartado, con su motivo

| propuesta | motivo |
|---|---|
| R3 · cancelar la corrida superada en `main` (≤ 4.269 min/semana) | se perdería saber cuál de dos merges seguidos rompió `main`: el agujero de los ocho días de producción congelada. En los PR ya se cancela (`cancel-in-progress` fuera de `main`) |
| R5 · «Zona roja» como paso de un job del CI (~490) | haría falta dar `pull-requests: write` a un job del CI que ejecuta el código del PR, y el único informativo pequeño que queda (`constancia-del-alter`) tiene un secreto. No se cambia seguridad por 12 $/mes |
| R2 · navegador solo si el PR toca `public/` | medido: los guards arrancan el servidor y dos importan de `dist/`, así que dependen de `src/` también. El recorte seguro ya es R1 |
| R6 · «PR automático» solo al crear la rama | sin tocar: un push de bot no dispara `pull_request:synchronize`, y no está medido qué pasa al re-armar tras un conflicto |
| trinquete solo sobre los tests cambiados · meta-guard solo sobre los ficheros cambiados · quitar los informativos del CI de `main` | quitan vigilancia, y ni así se llega a cero. Si el fundador lo quiere, lo pide él |

## Riesgos que quedan escritos

- **Ejecutor propio.** La tarifa de plataforma de 0,002 $/min para ejecutores propios se anunció para
  el 1-mar-2026 y se **aplazó** el 15-dic-2025; leído el 29-sep-2026 en
  `github.com/resources/insights/2026-pricing-changes-for-github-actions`, sigue aplazada y sin fecha.
  Si se reactiva, en privado con los recortes serían ≈ 145 €/mes. Es gratis mientras GitHub no cambie
  de idea.
- **4.043 min/semana de PR cancelados** por volver a empujar a los pocos minutos. No se arregla
  configurando nada: depende de cómo se reparte el trabajo, y eso lo lleva el orquestador.

## Evidencia

- `tests/scrum1284-minutos-actions.test.mjs`: 8 casos en verde. Las cinco mutaciones de
  `MUTACIONES_QUE_ME_TUMBAN` se comprobaron en ROJO a mano antes del commit: cada una tumba un caso
  (7 pass / 1 fail). El censo del meta-guard pasa de 345 a 350 declaraciones.
- Los 16 ficheros de test que leen `ci.yml`, más este: 161/161 en verde, con `npm ci` y
  `npm run build` en un worktree fijado a `origin/main`.
- El guion corrido contra la API real, un día: `855 corridas leídas de 855 declaradas`, salida 0.
