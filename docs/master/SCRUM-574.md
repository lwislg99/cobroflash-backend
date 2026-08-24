# SCRUM-574 · CONT-01: el switch Empresa/Persona — y «Tipo de cliente» resultó ser el campo fiscal de SCRUM-69

**Fecha:** 24-ago-2026 · **Carril:** producto (BLOQUE 1) · **Gate:** STOP levantado — GO del fundador (AA1.4, zona fiscal + esquema)
**Medido contra:** `origin/main` = `9b49190a7ab81be5c88a32b7745623ac78c8354f` · 2026-08-24T00:00:00+02:00
**Tanda:** 3954 tests, 3875 pass, 0 fail, 79 skipped

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Lo entregado:** el PASO 0 medido, el hallazgo que tumbó la premisa del ticket, la columna nueva
aplicada, el switch en los **dos** formularios, y los controles —incluido el positivo— en verde
contra Postgres.

---

## El defecto

El profesional da de alta a un administrador de fincas y a un particular con el mismo formulario y
luego no puede distinguirlos: la diferencia vive en si alguien rellenó «Razón social».

## Lo que se midió (PASO 0 · `P-CONT-4`)

Censo en `docs/CENSO_TIPO_CLIENTE.md`; comando de solo lectura `node scripts/censo-tipo-cliente.mjs`.

**Las dos preguntas del encargo, que son distintas:**

* **Qué permite el esquema:** `customers.tipo_destinatario` es `text`, `nullable`, **sin `DEFAULT`
  y sin `CHECK`**. La lista cerrada existe **solo** en Zod, en el borde de la API.
* **Qué tienen las filas:** **15 clientes, los 15 en `NULL`** (STAGING 4/4, DEV 11/11). Cero razón
  social, cero NIF. **Nada que mapear.**

**Producción no se midió** — no hay `DATABASE_URL` en el árbol (regla 3). **Y S1 no había
entregado nada:** `P-CONT-4` no aparecía en `docs/` ni `.claude/`. Se dijo para que la medición no
se leyera como dos que coinciden. *(El fundador confirmó después los mismos 15/15 desde S1.)*

## El hallazgo, que tumbó la premisa del ticket

El documento de origen declaraba **«NO SE HA ABIERTO EL REPOSITORIO»**. Abierto: «Tipo de cliente»
es `Customer.tipoDestinatario`, el campo de **SCRUM-69 (FACT-1)**, y fija el **plazo legal de la
recapitulativa** (art. 13.2 RD 1619/2012) — `EMPRESARIO` → día 16 del mes siguiente; `PARTICULAR` →
último día del mes. De ahí sale el semáforo de «Pendientes de facturar».

**Y no es la misma distinción que el switch.** Empresa/Persona es **forma jurídica**;
PARTICULAR/EMPRESARIO es **actuar como empresario a efectos de IVA**. Un **autónomo** es PERSONA y
a la vez EMPRESARIO.

🔴 **El caso roto era la víctima del propio ticket:** un administrador de fincas autónomo puesto en
«Persona» —lo correcto en su ficha— habría recibido en silencio el plazo de particular, **~16 días
más corto**, y la bandeja avisaría tarde de una factura vencida.

Se paró y se reportó, que es lo que el encargo mandaba en este caso exacto.

## La decisión, y por qué

**Fundador, 24-ago-2026: OPCIÓN B** — `contact_kind` nuevo para la forma jurídica;
`tipoDestinatario` **intacto**. Descartadas **A** (reutilizarlo) por riesgo fiscal y **C** (switch
sin persistir) porque deja a CONT-08 sin dato que filtrar. La frase «no se añade campo» se había
aprobado creyendo que era una clasificación genérica; medida la premisa, cayó la decisión.

⛔ **Prohibición nueva del fundador:** `contact_kind` y `tipoDestinatario` **no se mezclan en ningún
sitio** — ni migración, ni formulario, ni default que deduzca uno del otro. Lo que esto destapó
tiene ticket propio: **SCRUM-615**.

## La migración

`ALTER TABLE "customers" ADD COLUMN "contact_kind" TEXT;` — **autorización puntual** del fundador
para aplicarla esta sesión; **no es regla nueva** y el esquema sigue siendo suyo.

Preview obligatorio **antes** de tocar nada, con **control positivo delante** (25 `CREATE TABLE`
del esquema entero contra vacío: la herramienta contestaba). Veredicto **aditivo**: ni `DROP`, ni
`RENAME`, ni `TRUNCATE`, ni `SET NOT NULL`. Aplicada con el **CLI local por ruta** (nunca `npx`,
nunca `npm run db:push`), con guard de destino delante y **sin `--accept-data-loss`**, a
`acela/railway` y `acela/yaqu_dev_javier`. Turno de staging tomado y soltado. **Producción no, y no
puede.** Migración de datos: **ninguna** — los 15 siguen en `NULL`.

## Cómo se resolvió lo que parecía no tener salida

Con 15 clientes sin lado declarado, el switch tenía que enseñar algo al abrir una ficha vieja, y
las tres salidas eran malas: declarar por el profesional, inventar un tercer estado (regla 27), o
deducirlo de otro campo (prohibido).

**Ninguna de las tres.** Por debajo el switch son **radios de verdad**, y un grupo de radio sin
ninguno marcado es un estado **nativo** del control. Así que `NULL` se pinta tal cual: los dos
lados apagados, ninguno mintiendo. No es inventar un estado — es no borrar el que la columna ya
tiene. Y los radios traen gratis la exclusividad, el teclado y el anuncio «grupo, opción 1 de 2».

## Verificado en rojo

Sobre el commit `b47e8341`, revirtiendo **byte a byte contra los BYTES DE DISCO** guardados antes
de tocar (`Buffer.compare = 0`), no contra el blob — que es lo que exige SCRUM-570 con
`.gitattributes` normalizando.

| Rotura inyectada | Resultado |
|---|---|
| Esconder un campo **con dato escrito** | ✔ cae: «SE ESTÁ ESCONDIENDO UN DATO ESCRITO» |
| `\|\| 'PERSONA'` en el guardado | ✔ cae nombrando el fichero y el literal |
| Derivar `contactKind` de `tipoDestinatario` | ✖ **NO CAYÓ** → ver abajo |

🔴 **El tercer rojo destapó que mi guard estaba ciego, y es lo mejor que salió de aquí.** Buscaba
`/tipoDestinatario/` tal cual, pero en los formularios la variable se llama
**`fieldTipoDestinatario`**, con T mayúscula: la mezcla real que el guard existe para cazar era
justo la que no podía ver. Y el suelo no lo delató porque su trampa usaba la grafía que el patrón
sí veía — **caso mal elegido, no guard de sobra**. Corregido a `/tipo_?destinatario/i` con el suelo
usando las tres grafías reales del árbol.

Al arreglarlo apareció el segundo defecto, el clásico: el guard **se cazaba a sí mismo** en un
comentario al final de línea que nombra los dos campos para decir que no se mezclan. `soloCodigo`
solo quitaba las líneas que *empiezan* por `//`.

## Control positivo

Alta por **cada** lado del switch, releída de la BD para probar que se escribió, y —lo que de
verdad decide— **`tipoDestinatario` sigue `null` después**: si se contagiara, estaríamos en la
opción A con otro nombre. Más el alta **sin declarar nada**, que nace `NULL`.

## Cuatro guards del repo cazaron defectos reales míos, y los cuatro tenían razón

Un **backtick dentro de un template literal** que cerraba la cadena y dejaba `customerDetailView`
**sin parsear** (el defecto histórico de `exportView`) · el script sin declarar en el **SHELL del
service worker** · **CRLF** en `customerAdmin.ts` · un fixture con **móviles españoles reales** y el
**merchant demo**.

## Hallazgos laterales (se reportan, no se arreglan; regla 37)

* **Deriva DEV/STAGING:** a `yaqu_dev_javier` le faltaba `recargo_equivalencia`. ⚠️ **Se cerró de
  paso y NO fue una decisión:** `db push` sincroniza el esquema entero. Aditivo, nullable, ninguna
  fila tocada. Estaba fuera del alcance y se dice en vez de dejarlo implícito.
* **Los dos formularios de cliente ya divergían:** el de la lista tiene «recargo de equivalencia» y
  le falta «facturación pactada»; el de la ficha 360 al revés. Es zona de **CONT-19**. Por eso la
  regla de campos por lado se puso en la **pieza compartida** y no copiada en cada vista.

## Lo que NO cubre

* **Microcopy: cero escrita.** Los tres rótulos salen con `[PENDIENTE microcopy oficial]` + palabra
  de trabajo y **suben el censo de SCRUM-402 a conciencia (+1)**: una sola constante los apaga a
  los tres cuando el fundador firme el copy. Van con palabra detrás porque en un control de **dos**
  lados el marcador pelado sería inservible — los dos lados dirían lo mismo.
* **Una desviación de Holded, declarada:** el **NIF se queda en los dos lados**. Holded lo quita en
  Persona; en España una persona física también tiene NIF y F1 se lo va a exigir (hallazgo S1-C).
  Revertirlo es **una línea**: añadir `taxId` a `SOLO_EMPRESA`. La decisión final sigue siendo del
  fundador (`docs/CONTACTOS_CAMPOS_POR_LADO.md` §4).
* **CONT-03, CONT-04, CONT-08 (SCRUM-581) y CONT-19 NO se construyen**, solo se deja el sitio.
* **Producción sin medir ni tocar**, por diseño.
* **Los duplicados de clientes**: ni auditados ni tocados, como pedía el encargo.
* **No se tocó el formulario de documentos ni el PDF** (S2 / DOC-10).
* **F1 intacto**, con una corrección de lo medido: el teléfono sigue donde estaba, pero los
  encabezados son `ID · Nombre · Teléfono · Email · Notas · Alta`, así que es el **tercer** `<th>`,
  no el segundo que decía el encargo.
* **`npm run cr:tecnica` no existe en esta rama** (viene de SCRUM-570, aún no en `main`). La
  reversión se verificó con `Buffer.compare` contra los bytes de partida.

## Ficheros

**Nuevos:** `public/dashboard/js/switchFormaJuridica.js` · `tests/scrum574-switch-forma-juridica.test.mjs` ·
`tests/scrum574-mismo-cliente-tras-migracion.test.mjs` · `scripts/censo-tipo-cliente.mjs` ·
`docs/CENSO_TIPO_CLIENTE.md` · `docs/CONTACTOS_CAMPOS_POR_LADO.md` · `docs/sql/SCRUM-574-opcion-B.diff`

**Tocados:** `prisma/schema.prisma` (con GO) · `src/core/validation/schemas.ts` ·
`src/modules/system/customerAdmin.ts` · `public/dashboard/js/customersView.js` ·
`public/dashboard/js/customerDetailView.js` · `public/dashboard/css/styles.css` ·
`public/dashboard/index.html` · `public/sw.js` · `docs/sql/deriva-prod.sql` (regenerado) ·
`tests/_banco-vistas.mjs` (60 → 61) · `tests/scrum402-marcador-no-se-pinta.test.mjs` (censo +1)

---

## Apéndice · el CI en rojo (24-ago-2026): qué se midió y qué era

La rama bloqueaba el merge por el guard de navegador en CI. **La hipótesis que llegaba era que
`guard-contraste` era el único de los nueve sin `--no-sandbox` y moría por el sandbox SUID.**

**Medido antes de actuar, y NO era eso — al menos no como estaba escrito:**

| Lo que se midió | Resultado |
|---|---|
| `--no-sandbox` en `scripts/guard-contraste.mjs`, mi rama | **0** |
| `--no-sandbox` en `scripts/guard-contraste.mjs`, `main` | **0 también** |

O sea que el arreglo de SCRUM-522 **no vive en ese fichero**: vive en un módulo nuevo,
`scripts/_navegador.mjs`, que decide los flags por entorno (`env.CI ? ['--no-sandbox',
'--disable-setuid-sandbox'] : []`) y al que `guard-contraste` pasó a delegar.

**Lo que de verdad le faltaba a la rama era más que un flag:** no tenía `scripts/_navegador.mjs`,
ni `scripts/guards-visuales.mjs`, ni las **62 líneas nuevas de `.github/workflows/ci.yml`** que
crean el job. La rama salió 38 commits antes que `main`.

**Riesgo de conflicto, medido antes de mezclar:** 19 ficheros tocados por la rama, 48 por `main`,
**cero solape** — verificado con un control positivo (`package.json`, que sí está en la lista de
`main`, aparece; sin ese control, un `comm` contra un fichero vacío también imprime cero).
El merge entró **sin un solo conflicto**.

**Resultado tras traer `main`: los 9 guards de navegador en VERDE**, 53,6 s en serie. Ninguno
denuncia nada de CONT-01.

> ⚠️ La primera pasada local murió con `EADDRINUSE` en el puerto 4402 y **no era un defecto**: eran
> procesos `node` colgados de mediciones anteriores mías. El lanzador corre los nueve **en serie**,
> así que no hay colisión de puertos por diseño. Se dice porque ese rojo, leído deprisa, se parece
> mucho a un hallazgo.

**Observación lateral (no se toca — es zona de S1, SCRUM-617):** `scripts/guards-visuales.mjs`
lleva un **byte NUL literal** en el offset 3830, dentro de `ficheroDe(s, k) || '<NUL>'`, usado como
centinela. Funciona, pero hace que **git trate el fichero como binario**: sus diffs no se leen y
`git grep` no lo ve. Se reporta, no se arregla (regla 37).

**Tanda con `main` dentro:** 4048 tests, 3969 pass, 0 fail, 79 skipped. `guards:entrada` verde.
