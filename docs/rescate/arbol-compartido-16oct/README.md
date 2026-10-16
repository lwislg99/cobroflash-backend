# Rescate del árbol compartido · 16-oct-2026

**Lo ordena:** el orquestador del equipo de Luis (`cobroflash-backend-f3`), 16-oct-2026, por mensaje a la
S3. Va como rescate, sin ticket, por decisión suya. **Lo ejecuta:** S3.

**Medido contra:** `origin/main` = `3cbea839eec138891d68ee0c0554c646ed369b04` · 2026-10-16T11:41:06Z

## Por qué

El árbol compartido `D:\MILLONARIO\cobroFlash\cobroflash-backend` estaba en
`scrum-1082-flujo-crear-factura-competencia` (`e4ea95e5`), 3.210 commits por detrás de `main`. Tenía 43
ficheros sin seguir que vivían sólo en ese disco. Para poder llevarlo a `main` sin perder nada, lo único
que existe allí y no existe en git sube aquí.

## Qué sube y qué no

| qué | dónde | por qué |
|---|---|---|
| 17 fichas `SESION_ACTUAL_SCRUM-{10_v2,11,12,13,14,27,28,32,34,38,45,47,49,50,57,65,68}.md` | `docs/Srpint Scrum/`, la misma ruta | eran objetos SUELTOS: ni `--remotes`, ni `--all`, ni `--reflog` los alcanzaban, y un `git gc` podía borrarlos. Barridas antes de subir: nombran variables de entorno, ningún valor |
| `demo-stuck-after-firmar.png`, `landing-390-full.png` | esta carpeta (estaban en la raíz) | no estaban en git en absoluto. Son capturas de nuestra landing, con datos de demo |
| 2 frases de `docs/master/SCRUM-1198.md` | anexadas a ese registro | el borrador local tenía 2 frases que no estaban ni en `main` ni en ningún objeto de git |
| `colisiones.sh` | esta carpeta | el guion que mide qué no seguidos chocan con `origin/main`. Sólo lee y lleva un control positivo y uno negativo dentro |
| ⛔ `docs/AUDITORIA_SUPERFICIE_PUBLICA.md` | **NO sube** | es un mapa de puntos débiles de la superficie pública y el repo es público. Lo decide el orquestador |
| ⛔ `docs/historico/semillas-locales/seed-demo-fontaneria.mjs` | **NO sube** | lleva correos personales reales, un IBAN y teléfonos. Lo decide el orquestador |

Lo que NO hace falta rescatar: los 19 PNG `docs/competencia/capturas/servicem8/` son idénticos (mismo blob)
a los de `main`, y `tests/scrum1294-…` y `tests/scrum804b-…` estaban vacíos (0 bytes) en el compartido.
Los tres seguidos modificados (`LICENSE`, `package.json`, el README de verifacturamos) son borradores de
lo que ya está en `main`, en su versión corregida. `.claude/settings.local.json` es igual en HEAD y en
`main`, así que un cambio de rama lo conserva.

## Antes de mover el árbol

- `main` LOCAL va 3.347 commits por detrás: nunca `checkout main` a secas, sino
  `git switch --detach origin/main` o `git switch -C main origin/main`.
- Un checkout con no seguidos que chocan (aunque sean idénticos) o con seguidos modificados que difieren en
  destino se NIEGA ENTERO, sin tocar nada. Probado en un repo de juguete, 5 casos.
- 66 árboles resuelven al `node_modules` del compartido (`npm run topologia`). El checkout no lo toca. Lo
  tocarían un `npm install` o un `prisma generate` hechos ahí después.
- Para repetir las colisiones, en Git Bash (una tubería de PowerShell 5.1 mete un BOM en la primera
  línea y el control positivo sale `missing`):

      bash docs/rescate/arbol-compartido-16oct/colisiones.sh D:/MILLONARIO/cobroFlash/cobroflash-backend
