# SCRUM-1554 · Puerta de go-live

## 19-oct-2026 · SCRUM-1554c · La puerta en un fichero, con un guard que no deja borrar renglones (A); el cierre en ejecución, sólo propuesto (B)

**Medido contra:** `origin/main` = `8ff423895024c7d2ce1c6bcb96054da11a227b90` (base de la rama) · 2026-10-19T07:26Z (hora real, cabecera
`Date:` de `gh api -i zen`). S5, equipo de Luis. El orquestador da OK a A y dice NO a construir B (mensaje
del 19-oct). El carril: el ticket es de `equipo-javier`, pero `docs/go-live/` es nuevo y el guard es nuestro.
El orquestador avisa a su equipo.

A9: comprobación → `tests/scrum1554c-puerta-de-go-live.test.mjs`

### ⚠️ Este fichero choca con el PR #2428 (SCRUM-1554b, equipo de Javier)
#2428 también CREA `docs/master/SCRUM-1554.md`. Lleva abierto desde el 14-oct, con `build + tests` en rojo,
y nadie lo ha tocado desde entonces. **Quien entre segundo resuelve el conflicto juntando las dos
secciones**, sin borrar ninguna. 1554b y 1554c no se solapan en contenido:

| | SCRUM-1554b (Javier, #2428) | SCRUM-1554c (esto) |
|---|---|---|
| Qué es | Clasifica los **57 tickets de Jira** que «esperan al fundador», por tipo de decisión | La **lista de entradas** de la puerta, en un fichero, y un guard sobre ella |
| Toca | Sólo este registro y `docs/master/evidencias/SCRUM-1554b/` | `docs/go-live/puerta.json`, `scripts/go-live/puerta.mjs` y su test |
| Relación con la puerta | Cuenta 3 tickets aparcados en ella (1502, 1551, 1554) | Recoge sus entradas (1–23) |

### Lo medido antes de construir (y cambia lo que se puede prometer)
- **`INVOICING_ES_ENABLED` se enciende por la VARIABLE DE ENTORNO de Railway o por `merchants.flags` en la BD,
  a mano** (`src/core/flags.ts`: merchant > país > env > default). **Ninguno de los dos caminos pasa por la CI.**
  Por eso un guard de CI **no puede impedir** que se encienda: como mucho avisa. El requisito 1 de
  c.19645 («que impida, no que avise») no se puede cumplir desde la CI. Sólo se cumple en ejecución (B).
- **La lista no vivía en ningún fichero.** Estaba en el cuerpo del ticket (filas 1–8) y en sus comentarios
  (9, 10, 11–15). c.19645 nombra otros seis grupos «movidos» sin redactarlos, y **dos entradas sólo constaban
  en registros ajenos**: `SCRUM-1183.md:66` (el botón de exportar sin año) y `SCRUM-1558.md:29`
  (`sendInvoiceEmail` dice `ok` sin enviar; el registro dice «el orquestador lo apunta en la puerta», pero
  en el ticket NO consta). Así que el requisito 2 (autocontenido) tampoco se cumplía.

### A · Lo que entra
1. **`docs/go-live/puerta.json`**: 23 entradas, cada una con `numero`, `que`, `de_donde` y `consta_en`
   (dónde se escribió), y `condicion` cuando la fuente la da. **22 abiertas y 1 cerrada**: la 4, el P1 con
   asteriscos, por PR #2425 (`cd99c713994f`, ancestro de main, comprobado), con su motivo de c.19593/19594.
   Las 18 y 19 dicen «no lo dice el comentario» en `de_donde`: c.19645 no da el ticket de origen. No me lo
   invento.
2. **`scripts/go-live/puerta.mjs`**: `juzgarPuerta`, `leerPuerta` y `recuento`, y línea de órdenes:
   **0** = ninguna abierta · **1** = hay abiertas · **2** = NO PUDE LEER (nunca 0 por no poder leer).
   Hoy: `PUERTA DE GO-LIVE · 22 abierta(s) de 23 · cerradas: 4`, salida 1.
3. **El guard**, que corre en la tanda (`build + tests`, el obligatorio). Declara `TOTAL = 23` y
   `CERRADAS = [4]`, y cae **en los dos sentidos**:
   - una entrada que **desaparece**, aunque se renumere el resto → rojo («una entrada NUNCA se borra»);
   - una entrada **cerrada sin** `{por, motivo, sha, fecha}`, o con un sha que no se puede buscar → rojo;
   - una entrada **nueva**, o una **cerrada que el guard no declara**, o una **reabierta** → rojo, hasta que
     el mismo cambio suba `TOTAL` o toque `CERRADAS`. **Así el diff dice cuál salió** (requisito 3), y su
     motivo queda en la lista.

### Comprobado
| corrida | resultado |
|---|---|
| test nuevo | **14/14** |
| test nuevo + 1349 + 1415 + 824 + 723 | **46/46** |
| **mutantes sobre la lista DE VERDAD** (cambio y `git restore`; árbol limpio al acabar) | **borrar la 23 → cae**, con «faltan 1 entrada(s) (23)…» · **cerrar la 1 sin `cerrada`** → cae, con «cerrada sin {por, motivo, sha, fecha}» y «el guard no lo declara» |
| los 163 ficheros de test que barren `scripts/` o `tests/`, CONTRA LA BASE (la misma tanda en `8ff423895` sin el cambio) | base 85 caídos, rama 87. **Los 2 de más eran míos: `SCRUM-1349`.** Mi `spawnSync` dejaba pasar `FORCE_COLOR`; arreglado donde nace. Los 85 de la base son los de siempre en un árbol sin `dist/` (`scrum1398`, `scrum1262`…) |

### B · El cierre en ejecución: SÓLO PROPUESTA. NO construido
**Por qué no se construye:** cambiar `isFlagEnabled` es tocar un flag de la Parte P a nivel global, y eso es
un STOP del CLAUDE.md. **Lo lleva el orquestador al fundador con la pregunta sola, y nadie lo construye
hasta que haya una cita suya.**

**El diseño** (en `src/core/flags.ts`, dentro de `isFlagEnabled`, justo antes de devolver):
```ts
// SCRUM-1554 · LA PUERTA DE GO-LIVE: INVOICING_ES_ENABLED no se enciende con entradas abiertas.
// Fail-closed: si la lista no se puede leer o no tiene su forma, cuenta como CERRADA la puerta (OFF).
function puertaDeGoLiveLibre(): boolean {
  if (cachePuerta !== undefined) return cachePuerta;
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'docs', 'go-live', 'puerta.json'), 'utf8'));
    cachePuerta = Array.isArray(doc.entradas)
      && doc.entradas.length > 0
      && doc.entradas.every((e: any) => e && e.estado === 'cerrada');
  } catch { cachePuerta = false; }
  return cachePuerta;
}
// …y al final de isFlagEnabled, para este flag y sólo cuando el resultado sería true:
//   if (flag === 'INVOICING_ES_ENABLED' && resultado && !puertaDeGoLiveLibre()) return false;
```
- **`docs/` viaja al despliegue**: `legalPages.routes.ts:13` ya lee `path.join(process.cwd(), 'docs', 'legal')`
  en producción. La lista sólo cambia con un despliegue, así que se lee **una vez por proceso**.
- **Cierra los dos caminos a la vez** (env de Railway y `merchants.flags`), porque los dos pasan por
  `isFlagEnabled`. Y no toca el camino de emisión: lo que cambia es la respuesta del interruptor.

**🔴 Lo que hay que decidir ANTES de construirlo, medido:**
1. **33 ficheros de `tests/` encienden `INVOICING_ES_ENABLED`** (por env o por override) y esperan que
   emita. Con B tal cual, con 22 abiertas, **caen todos**. Hace falta una salida para los tests que **no sea
   un agujero en producción**. Una variable de entorno que salte la puerta es justo el camino que Railway
   puede poner. Opciones, sin elegir: (a) la puerta sólo rige con `NODE_ENV=production` (⚠️ staging
   también lo tiene, según SCRUM-1558, y el de producción no lo he medido); (b) los tests inyectan la
   lista por un parámetro de `FlagContext` que en producción nadie rellena.
2. **Si alguna cuenta tiene hoy el flag encendido** por `merchants.flags` (la demo, por ejemplo), **B se lo
   apaga al desplegar**. No lo puedo medir: ningún árbol tiene credenciales de producción (SCRUM-418).
   ⚠️ **Eximir a las cuentas de prueba es el agujero**: no se propone.
3. **El ratón y el gato del guard**: una entrada cerrada sin arreglar de verdad pasa el guard igual. B no lo
   arregla; lo que lo sujeta es que el cierre lleve `por`, `motivo` y `sha`, y que el diff lo vea un humano.

**🔢 La cifra de los 33, medida después (19-oct, sólo lectura, sobre `8ff423895`).** La pidió el orquestador
para que el fundador no decida B a ciegas:

| cómo encienden el flag | ficheros |
|---|---|
| **`merchant.flags = { INVOICING_ES_ENABLED: true }`** en un objeto que el test pasa a funciones de dominio (`getEmissionMode`, `allocateInvoiceNumber`, `modoDocumentoSuelto`…), o en un Prisma falso o en el banco desechable | **31** (incluidos `_banco-emision-con-estado.mjs`, `scrum974` con su `ENCENDIDA` y `scrum1097`, que es un guard que mide comercios encendidos) |
| **`process.env.INVOICING_ES_ENABLED = 'true'`** | **2** (`emission.test.mjs`, `flags.test.mjs`; el segundo prueba además el override) |
| sustituyen `isFlagEnabled` o su módulo | **0** |

Lo que eso dice de las dos salidas para los tests:
- **(a) la puerta sólo rige con `NODE_ENV=production`**: no toca ninguno de los 33, porque ninguno pone
  `NODE_ENV=production`. ⚠️ Sigue sin medir qué `NODE_ENV` tienen staging y producción.
- **(b) inyectar la lista por `FlagContext`**: 31 de los 33 NO llaman a `isFlagEnabled`: llegan a él a través
  del dominio. Habría que pasar el parámetro por cada función, y eso es mucho más invasivo de lo que parecía.
  Una variante menos invasiva es un interruptor en memoria exportado por `flags.ts` que sólo llaman los tests.
  No se puede poner desde Railway, pero sí desde cualquier código del proceso. Tampoco se elige aquí.

**Dos cosas que YA existen y cambian la pregunta:**
- **`scripts/guard-acreditacion-invoicing-es.mjs` (SCRUM-1097)** es de sólo lectura (lo verifica por AST) y
  contesta la duda 2: si hay hoy algún comercio ES, que no sea la demo, con el override encendido o con alguna
  factura fiscal emitida. **El fundador puede correrlo contra producción antes de decidir B**, sin escribir
  nada nuevo. Dice en su cabecera que no ve la variable de entorno; para eso tiene su brazo (b): ¿se ha emitido
  algo fiscal?
- **Ese guard EXCLUYE A LA DEMO (id=1) a propósito, por la regla 8.** B, tal como está escrita arriba, le
  apagaría la facturación a la demo si tiene el override encendido. Si la regla 8 la deja fuera de la puerta,
  eso lo decide el fundador. Una excepción por id fijo no es el agujero de «eximir cuentas de prueba» (no
  depende de ningún dato que se pueda poner desde fuera), pero tampoco lo propongo yo.
- **`scripts/cambiar-flag-fiscal.mjs`** es, según SCRUM-1097/1099, **la única vía humana y deliberada** de
  encender el override por comercio. Que ese guion se niegue con entradas abiertas cerraría UNO de los dos
  caminos sin tocar `flags.ts` (la variable de Railway seguiría abierta). Se nombra; no se propone ni se ha
  leído entero.

### Lo que NO hace
- **No impide encender el interruptor.** Hasta que exista B, esto es una lista vigilada, no una puerta.
  **La fila c3-17 de la página del fundador NO se cierra con A**: queda a medias, y la cierra B.
- **No está completa.** Recoge lo que consta escrito en el ticket y en los registros de `main` que mandan
  algo a esta puerta (`git grep` de «puerta de go-live» y «SCRUM-1554» en `docs src public tests scripts`).
  Lo que se aparcó sólo de palabra, o en Jira de otro ticket sin registro, no está.
- **No lee Jira.** Una entrada nueva hay que escribirla en el fichero. Si sólo se escribe en el ticket, el
  guard no la ve.
- No he redactado las seis que c.19645 sólo nombra (16–21): llevan el nombre que les dio el comentario.

#### Arreglo del check obligatorio (mismo día, antes de mergear)
El `build + tests` del PR #2601 caía con `not ok 3440 - SCRUM-1480f`: `scripts/go-live/puerta.mjs` (creado en
este mismo PR) es un script NUEVO sin fila en `docs/equipo/dos-equipos.md` §3.3. Medido el motivo: SCRUM-1554
lleva las etiquetas `decision-jefe, equipo-javier, fundador, go-live, legal, microcopy` — NINGUNA es
`area-*`. Por «Cómo nace la fila de un fichero de `scripts/`» (SCRUM-1480), un ticket sin UNA etiqueta de
área hace que el criterio calle: no se le puede dar fila a un puesto. Declarado en
`scripts/_sin-fila-declarados.json` (caso 2: lo crea el equipo de Luis en un ticket sin etiqueta de área).
`tests/scrum1480f-un-script-nuevo-no-entra-sin-fila.test.mjs`: 6/6 verde tras el cambio.
El rojo de `guards de navegador (fuera de la tanda)` (34 verdes, 3 rojos, 1 ciego) es PREEXISTENTE: medido
también en rojo en el último run de `main` (39218813067, el mismo job, misma conclusión `failure`), y
ninguno de los 4 ficheros de este PR toca `public/` ni el dashboard. No es de este PR; no se toca aquí.

## 19-oct-2026 (tarde) · SCRUM-1554d · ¿Cuáles de las 23 son VERDAD hoy? Medido una por una, sólo lectura

**Por qué este tramo y no un «¿cuántas quedan?» sobre el guard.** El guard de SCRUM-1554c ya dice `22 abierta(s)
de 23`: eso es lo que DECLARA la lista. Lo que faltaba — y lo que pidió el orquestador — es si cada declaración
SIGUE siendo verdad hoy, una por una, contra el árbol y contra producción, porque una entrada «abierta» en el
JSON no se vuelve a comprobar sola. **No se tocó `docs/go-live/puerta.json` ni el guard: esto es sólo la medida.**

**Medido contra:** `origin/main` = `eee7d2b4bcea348a05d0020a1e912db73a894cfe` (19-oct-2026) · producción
(`https://yaqu.app/version`) = el mismo `eee7d2b4b`: **el deploy está al día**, así que lo leído en el árbol vale
también para lo que sirve yaqu.app hoy en las páginas públicas. S0, equipo de Luis, con 4 sesiones en paralelo
(una por bloque de entradas), todas sólo lectura: sin tocar `src/`, `public/`, el esquema, ningún flag, ningún
guard, sin login en producción, sin Playwright.

**La pregunta que importa, contestada:** de las 23, **sólo 3 son hoy verdad** (la 3, la 4 —ya cerrada antes de
hoy— y la 21, con una brecha declarada). **17 siguen siendo el mismo defecto que el día en que se apuntaron.**
Y **3 no se pudieron comprobar desde aquí** (13, 17, 18) — con su motivo, no por no haberlo intentado.

| # | condición (resumen) | ¿es verdad HOY? | cómo se midió | qué falta / de quién depende |
|---|---|---|---|---|
| 1 | Los 7 literales de P2 (#2415), sin firma en bloque | **NO** (esperado: nada roto, falta la firma) | `git log --grep=534`: PR #2415 (`c45317338`) sigue en `docs/legal/ALCANCE_BETA.md`, sin revertir. Jira SCRUM-1554 entero (6 comentarios): ninguno dice que la firma en bloque ya ocurrió | La revisión de go-live (fundador/orquestador) todavía no ha empezado — es la condición esperada mientras tanto, no una regresión nueva |
| 2 | R1–R6 del documento legal servido | **NO** | `docs/legal/ALCANCE_BETA.md` + `Invoke-WebRequest https://yaqu.app/legal/alcance-beta`: siguen «Cobro integrado», «Justificantes de cobro», «soporte por email y WhatsApp» (no «sólo email»), «mientras tanto» Bizum/transferencia. La frase «no emite facturas ni ningún otro documento de cobro» no existe en `docs/legal/` | Redactar y firmar (regla 39) las 6; carril **J3** |
| 3 | D1: aviso BORRADOR no se sirve; sí 3×[REVISAR ASESOR] + huecos | **SÍ** | `legalPages.routes.ts:27` omite líneas `>` (el aviso lo es); confirmado en vivo: el HTML de yaqu.app no dice «BORRADOR», y sí aparecen los 3 `[REVISAR ASESOR]` y los huecos (`[NIF]`, `[fecha]`…) | Nada pendiente en esta entrada |
| 4 | El P1 con asteriscos sueltos | **CERRADA** (ya antes de hoy) | Sin cambios desde el cierre declarado en `puerta.json` (PR #2425, `cd99c713994f`) | — |
| 5 | 5 marcas de microcopy «aprobado por el fundador» sin cita que conste | **NO** | `docs/master/SCRUM-1502.md`: las 5 (409 al emitir, desglose por empleado, rótulos del raíl, los 10 de Configuración, bloqueo de serie) siguen cada una en su ticket de origen como «sin aprobar»/«pendiente». `git log --since=2026-10-14` sobre los 5 ficheros: ningún commit añade la cita | Falta localizar o pedir la cita literal del fundador por cada marca; sin carril único, cada una tiene su dueño propio |
| 6 | La oferta *founding* no comprueba el modo `receipt` | **NO** | `plansView.js`: `openAlcanceModal()` pinta el iframe de `/legal/alcance-beta` sin ningún `if` sobre el modo; `founding.ts` no referencia `receipt`/`INVOICING_ES_ENABLED` | Añadir el guard en `plansView.js`; carril **J3** |
| 7 | `terminos.html:48`, «emitir facturas y gestionar cobros» en presente | **NO** (y hay una 2ª frase nueva) | `public/terminos.html:48` y producción, idénticas. **Hallazgo nuevo, fuera de la población medida por SCRUM-1551:** `terminos.html:79-80`, sección 6, «YaQu te ayuda a generar documentos de cotización y factura…», también en presente y también servida en vivo | Reescribir las DOS frases, con firma; carril **J3** |
| 8 | El guard de SCRUM-406 no ve `docs/legal` | **NO** | `tests/scrum406-canal-prometido-existe.test.mjs`: `promesasDeSoporte()` sólo recorre `public/`. La frase «soporte por email y WhatsApp» sigue en `ALCANCE_BETA.md:23-24`, y el propio test declara `whatsapp: false` (el canal no existe) | Extender el guard a `docs/legal/`, o quitar «WhatsApp» del texto; dueño del guard, carril **S1/J3** según el fichero |
| 9 | `readLegalDoc`/`mdToHtml` parte líneas de continuación en `<p>` sueltos | **NO** | `legalPages.routes.ts:20-38`: cualquier línea sin viñeta propia cierra la lista y sale como párrafo. Confirmado en vivo (el P1 y la frase de soporte salen partidos). Sin elegir entre arreglar el renderizador o unir líneas en el `.md` (ya lo decía SCRUM-1554c) | Decisión + arreglo; carril **J3** |
| 10 | Las cicatrices de puesto no las lee nadie | **NO** (mitigado, no cerrado) | `.claude/hooks/identidad.mjs` (hook `SessionStart`, `.claude/settings.json:8`) ya pega el CONTENIDO de `docs/equipo/cicatrices/<puesto>.md` en el arranque — no sólo la ruta. Pero no hay guard que compruebe que una sesión USÓ lo que se le pegó | Falta un mecanismo que convierta un fallo conocido en rojo, no sólo en párrafo (ya lo decía c.19594); puesto S0/orquestador |
| 11 | `index.html:638` «Tarjeta, Bizum o transferencia» sin Connect | **NO**, con reserva | El texto sigue igual en código y en producción. Stripe Connect SÍ está construido (`src/modules/payments/connect/`), pero `PAYMENTS_CONNECT_ENABLED` tiene default `false` en `src/core/flags.ts`, y el propio `CLAUDE.md` (regla 8) dice que hoy no hay cobro con tarjeta activo | **NO PUDE MIRAR** si Railway o `merchants.flags` lo contradicen: eso vive fuera del repo. El NO se apoya en el código + el máster vigente, no en una lectura de producción con credenciales |
| 12 | `aria-label` de la animación dice «cobro», termina en «Firmado» | **NO** | `index.html:432` sigue con «…a cobro»; `:433`/`:465` siguen terminando en «Firmado» | Cambiar el `aria-label`; carril **J3** |
| 13 | CTA final «sin perseguir presupuestos» — ¿hay clientes y cifra? | **NO PUDE MIRAR** | El texto de código no cambió (confirmado), pero la condición de fondo es un HECHO DE NEGOCIO (clientes reales + una cifra enseñable) que no se puede ver desde el repo sin login ni acceso a producción | Lo decide el fundador: si hay cifra, se publica; si no, se aplica el recambio sin firmar |
| 14 | Subtítulo vivo de `index.html:427`, recambio YA firmado (SCRUM-1016 c.19607) | **NO** | El subtítulo sigue sin el literal firmado y sigue prometiendo «te paga — con tarjeta, Bizum o transferencia» (regla 24). El H1 (`:426`) SÍ se aplicó; el subtítulo (`:427`) y su espejo (`:508`) no | Aplicar el literal YA firmado, sin pedir firma nueva; carril **J3** |
| 15 | Bot: «ningún pago pendiente con…», sólo ve cobros internos | **NO** | `botFlow.service.ts:582` idéntico al denunciado, sin el recambio («…por YaQu con…») | Aplicar el recambio + cambio de máster K1; carril **J2**. El valor de `BOT_INBOUND_ENABLED` en Railway: NO PUDE MIRAR, no cambia el veredicto sobre el texto |
| 16 | Fechas de albarán en UTC, no en la zona del negocio | **NO** | `albaranPdf.service.ts:129-131,362` y `albaranes.routes.ts:1349,1601`: `toLocaleDateString` sin `timeZone`. El PDF del PRESUPUESTO sí se arregló (`zonaDelMerchant`, SCRUM-1470); el ALBARÁN se quedó fuera | Aplicar el mismo patrón al albarán; SCRUM-1445 no tiene ficha propia en `docs/master/` |
| 17 | «Las dos líneas bajo el sellado» (SCRUM-1490) | **NO PUDE MIRAR** | `docs/master/SCRUM-1490.md` entero trata de la serie anual de presupuestos (`seriesYear`), nada sobre texto bajo un sellado VeriFactu. `git grep "bajo el sellado"`: nada | El enunciado de esta entrada es ambiguo incluso dentro de la propia puerta; hace falta que quien la movió (c.19645) la redacte |
| 18 | «Las tres preguntas fiscales» | **NO PUDE MIRAR** | La propia puerta admite `"de_donde": "no lo dice el comentario"`. `git grep` no encuentra el concepto como tal | Nada que medir sin que se redacte primero |
| 19 | Los textos del albarán y del libro registro | **NO** | Coincide con `docs/equipo/para-javier.md` §26.2 (SCRUM-1428): 15 claves de `libroRegistroView.js` firmadas por el fundador el 19-ago sin marca en el código; el comentario de cabecera que dice «ni un rótulo… está aprobado» sigue siendo falso | Carril **J1**; decisión ya tomada (SCRUM-1428 c.18325), sólo falta aplicar la marca |
| 20 | Texto de Stripe en inglés, `connect.routes.ts:70` | **NO**, con matiz | El fallback literal YA está en español («Error creando el onboarding»), pero antepone `err?.message` — el mensaje crudo de la librería Stripe, normalmente en inglés — así que lo que de verdad llega al usuario puede seguir en inglés | Envolver siempre `err?.message` en un texto propio en español; si la entrada se refería a la página de Stripe alojada fuera del repo, eso es aparte y NO PUDE MIRARSE |
| 21 | La puerta de producción de SCRUM-418 (ningún worktree con credenciales de prod) | **SÍ**, con brecha declarada | `scripts/comprobar-claves-bd.mjs` + `scripts/_clave-vs-destino.mjs` existen y tienen test (`scrum418`, `scrum418c`, 17 casos, sin gate, corren en `npm test`) | El propio SCRUM-418.md declara que el barrido no corre solo contra los `.env` REALES de cada worktree (no está en CI); decisión pendiente de un hook/paso de arranque |
| 22 | Botón de exportar sin año | **NO** | `docs/master/SCRUM-1183.md` (1183b, 16-oct): decidido explícitamente que esto se manda a ESTA puerta y no se construye sin firma. 1183d (18-oct) no la toca | Firma del fundador eligiendo (b) o (c); hasta entonces sigue bajando CSV vacío |
| 23 | `sendInvoiceEmail` escribe `.eml` y devuelve `ok` sin proveedor | **NO** (confirmado, no tocado) | `email.service.ts:28-169`: sin `RESEND_API_KEY`/`SMTP_URL`, usa `streamTransport` y escribe `storage/outbox/invoice-<n>.eml`, devuelve `{ok:true}`. `docs/master/SCRUM-1558.md:29` ya lo marca «GEMELO CONOCIDO, STOP DEL FUNDADOR» — el gemelo de presupuestos SÍ se arregló; éste se dejó aparte a propósito (regla 40, camino de emisión) | GO escrito del fundador para tocar el camino de emisión; mientras `INVOICING_ES_ENABLED` esté OFF para ES no muerde |

**Resumen en una frase:** de las 23, **2 son verdad hoy sin reparo** (3, 21-con-brecha) + **1 ya cerrada antes de
hoy** (4) = **3 resueltas**; **17 siguen con el mismo defecto del día en que se apuntaron**; **3 no se pudieron
comprobar desde este repo** (13 es un hecho de negocio; 17 y 18 son entradas cuyo propio enunciado no da con qué
medirlas). **Ningún veredicto forzado:** donde la condición dependía de Railway, de `merchants.flags` o de un
hecho de negocio sin ver, la fila dice NO PUDE MIRAR en vez de adivinar.

**Hallazgo nuevo que no estaba en la lista** (de la entrada 7): `public/terminos.html:79-80` («YaQu te ayuda a
generar documentos de cotización y factura…», presente, servida en vivo) es la misma familia de claim que la
entrada 7 y no estaba censada. **No se añade aquí como entrada 24**: eso es tocar `docs/go-live/puerta.json`,
y este tramo es sólo la medida. Queda señalado para quien mantenga el fichero.

**Lo que NO se tocó:** `docs/go-live/puerta.json`, `scripts/go-live/puerta.mjs`, ningún flag (`INVOICING_ES_ENABLED`,
`PAYMENTS_CONNECT_ENABLED`, `BOT_INBOUND_ENABLED`), ninguna variable de Railway, ninguna fila de `merchants.flags`,
ningún test. Sin login en producción (sólo GET públicos a páginas sin sesión) y sin Playwright.

A9: comprobación → ninguna (tramo de sólo lectura, nada que correr en la tanda).
