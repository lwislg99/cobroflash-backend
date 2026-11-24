# SCRUM-1801 · Una rama `scrum-<dígito>…` sin número para el censo tumba el obligatorio de todos los PR: comprobación en la puerta

**Medido contra:** `origin/main` = `f8dc0244675d00709b896101b97c89bd22468923` · 2026-11-24T02:41:10Z (cabecera `Date:` de `gh api -i zen`)

A9: comprobación → `scripts/guard-rama-con-numero.mjs`

Mutaciones: catálogo → `tests/scrum1801-guard-rama-con-numero.test.mjs`

**Puesto:** J6 (`jv-j6fh`) · **Rama:** `scrum-1801-guard-rama-con-numero` · encargo del orquestador J (`cobroflash-backend-2d`), pieza ① del ticket. Carril J6: el guard nuevo, su test y este registro. `scripts/_numero-de-rama.mjs` y `tests/scrum804-la-rama-viva.test.mjs` NO se tocan (regla 41).

## Qué se construyó

- `scripts/guard-rama-con-numero.mjs`: lee la rama actual (`GITHUB_HEAD_REF`; si no, `GITHUB_REF_NAME`; si no, `git rev-parse --abbrev-ref HEAD`), IMPORTA `numeroDeRama` y sale con 0 verde · 1 ROJO · 2 CIEGO. Siempre imprime su población: `1 rama mirada: <nombre> (de <origen>)`.
- ROJO (código 1) cuando la rama empieza por `scrum-<dígito>` y `numeroDeRama` devuelve `null`, con este mensaje: «tu rama `<nombre>` no tiene número para el censo (scripts/_numero-de-rama.mjs): scrum804 caerá en TODOS los PR. A la 27ª pieza de un ticket, ticket hijo.»
- `tests/scrum1801-guard-rama-con-numero.test.mjs`: 7 casos, que lanzan el guard como proceso con `GITHUB_HEAD_REF` inyectado. Son el rojo primero (sin el guard, `scrum-1787aa-x` entra en `agruparRamas` como `sinNumero` y el filtro de scrum804 la cruza), verde para `scrum-1801-…`, ROJO para `scrum-1787aa-x`, `relevo/sin-numero`, `claude/pr-…` y `main` en verde, CIEGO sin rama, el filtro copiado contra el fuente de scrum804 y la rama de ESTE árbol.

## Lo medido el 24-nov-2026 (y la desviación del encargo, aceptada)

- **Población:** `git ls-remote --heads origin` = 192 refs; sin `main`, 191. **68 no tienen número** para `numeroDeRama`. 54 de ellas son `claude/pr-*`, las que crea el workflow `@claude`; el resto, `aparcado-…`, `espera/scrum-…`, `exp-…` y otras. Con esas 68 en el remoto, scrum804 está en verde: su suelo solo cruza los nombres que casan `/^scrum-\d/i` (el filtro de `soloEnGit`).
- **Desviación:** el encargo pedía rojo también para `relevo/sin-numero`. Con rojo para TODA rama sin número, el test caería en cada PR de `@claude` sin que nada estuviera roto. El guard pone rojo solo a la población que tumba scrum804. Lo aceptó el orquestador por mensaje, el 24-nov. `agruparRamas` (`scripts/_censo-reparto.mjs`) solo excluye `main`: no hay más exclusiones del censo que copiar.
- **Dos anclas:** el filtro `/^scrum-\d/i` está escrito en el guard (`FILTRO_DE_SCRUM804`) y en scrum804, que no lo exporta y no se toca. El caso «el filtro copiado sigue siendo el de scrum804» lee el fuente de scrum804 y cae si cambia.
- **Rojo real, sin inyectar:** en un repo de prueba creado con `git init -b scrum-1787aa-x`, el guard sale 1 con el mensaje entero. En esta rama sale 0: «el censo la cuenta como SCRUM-1801».
- **Mutación** (catálogo, `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`, sobre el commit `8269f1b9f39ccb48bb787408a12efc9e11b8b225`): `const n = numeroDeRama(limpio);` → `const n = limpio.length;` da VIVA. Cae «ROJO para `scrum-1787aa-x`», más dos colaterales: el control positivo y `relevo/…`. Después, `git status --porcelain` vacío.

## Para J3 · la línea que mete el guard en `npm run guards:entrada` (NO escrita: `scripts/guards-entrada.mjs` es de J3)

`GUARDS` enumera ficheros de `tests/`, así que lo que se registra es el test. Este es el diff propuesto, al final de `GUARDS`, detrás de la entrada de scrum1294:

```diff
+  // SCRUM-1801 · la rama desde la que vas a empujar tiene número para el censo; si no, scrum804 cae en
+  // TODOS los PR (24-nov-2026, `scrum-1787aa-…`). Sin `dist` ni base, ~2 s (siete hijos de node).
+  { fichero: 'tests/scrum1801-guard-rama-con-numero.test.mjs',
+    porque: 'una rama `scrum-<dígito>…` sin número para `numeroDeRama` tumba scrum804 en todos los PR' },
```

Antes de aceptarla, J3 mide el techo con `tests/scrum976-guards-entrada-con-techo.test.mjs` (los siete hijos de este test suman ~2 s en esta máquina).

## Para Luis (S0) · ② y la fila del script nuevo — solo propuesto

**② `.github/workflows/pr-automatico.yml`**: un paso detrás del «Candado — solo ramas scrum-», con la rama por `env` como el candado:

```diff
+      - name: Candado — la rama tiene número para el censo (SCRUM-1801)
+        env:
+          GITHUB_HEAD_REF: ${{ github.ref_name }}
+        run: node scripts/guard-rama-con-numero.mjs
```

Esto supone un `actions/checkout` antes del paso. Si el candado actual corre sin checkout, va después del checkout del job.

**Fila de `docs/equipo/dos-equipos.md` §3** (S0): `scripts/guard-rama-con-numero.mjs` → **J6**, por el área del ticket que lo crea (SCRUM-1801, `area-j6`). Hoy solo lo cubre la fila general de `scripts/` (lo dice `node scripts/carriles.mjs de --nueva`).

## Qué no corrí

La suite ENTERA no se corrió antes del empujón: el tope de contexto del encargo (170k) no la admitía, y se avisó al orquestador antes de empujar. La lista de lo que sí corrió va en el comentario de entrega de Jira.
