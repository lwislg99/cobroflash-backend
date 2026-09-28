# SCRUM-1216a · La pantalla de la serie deja de prometer lo que no hace

**Medido contra:** `origin/main` = `cd78b8264d042dc01afe1ee714b002278f25e0a1` · 2026-09-28T14:41Z (J1, árbol `cobroflash-jv1`; rama nacida de `f9dc44a3`)

SCRUM-1216 se partió en dos el 28-sep-2026. **1216a** es lo urgente que NO toca el camino de emisión.
**1216b** (el número de arranque declarado llega a la factura) toca `allocateInvoiceNumber` y va aparte.

## ① Qué se retira: la promesa

«Seguimos por ahí para que tu numeración no tenga saltos.», del alta (paso 2, `onboardingView.js`) y de
la puerta D1 de Ajustes (`puertaSerie.js`).

Es **falsa desde el 7-sep-2026**, con el corte de la serie F (SCRUM-780, `ba1cd2d5`). Medido contra el
`allocateInvoiceNumber` real (tx falso, SCRUM-1203): con «41» declarado y sin declarar nada salen las dos
`F260001`; el control anterior al corte da `2026-CF-042`. Se cumplió del 6-ago al 7-sep.

Lo demás de las dos pantallas **se queda como está**: la pregunta, el campo «Número» (lo necesita 1216b,
decisión del orquestador), la vista previa del servidor y el aviso «Compruébalo bien…». El hueco que deja
la frase lo cubre un `margin-top` en la vista previa: sin componente nuevo ni token nuevo.

## ② En `receipt` no se pinta NI el paso del alta NI la puerta de Ajustes

Regla 24: con `INVOICING_ES_ENABLED` en OFF, YaQu no emite nada. Medido antes de construir:

- **La puerta de Ajustes se enseñaba HOY en `receipt`.** `/admin/me` calcula `puertaSerieDisponible` sin
  mirar el modo (`app.ts:544-548`), y `puertaSerie.js` sólo ocultaba la vista previa (SCRUM-1029). Salían
  la pregunta, el campo y la promesa.
- **Guardar por detrás no bastaba.** `debeOfrecerArranqueDeSerie` con `invoiceSeriesYear: 2026` da
  `false` en 2026 y `true` a 1-ene-2027. Un merchant en `receipt` no emite nunca, así que nada vuelve a
  escribir el año y la puerta se le reabriría cada Nochevieja.

Se ocultan los dos con el modo que ya trae `/admin/me`, **sin tocar `src/`**:

- el alta filtra el paso marcado `pasoDeSerie` cuando `window.appModoEmision === 'receipt'` (`app.js` lo
  fija antes de abrir el asistente);
- `puertaSerieVisible` devuelve `false` en ese modo.

Decisión: ocultar el paso del alta en OFF, el fundador; extenderlo a la puerta de Ajustes, el orquestador,
sobre esta medición.

⚠️ **Fuera de España esto no aplica.** `getEmissionMode` devuelve `fiscal` para cualquier país que no sea
ES (`emission.service.ts:36-41`), así que un merchant no-ES emite hoy y ve el paso. Para él 1216a retira
la promesa falsa. El número declarado sigue sin llegar a su factura hasta 1216b.

## ③ Red — `tests/scrum1216a-serie-sin-promesa.test.mjs` (5)

Monta el dashboard con `tests/_banco-vistas.mjs` y pulsa, en las dos pantallas y en los dos modos:

- 🔴 **`receipt`, alta:** se recorre el asistente entero, sin el paso de la serie, sin la promesa y sin
  ninguna llamada a `/admin/onboarding/serie*`. Control: avanza al menos tres pasos distintos.
- 🔴 **`receipt`, Ajustes:** `renderPuertaSerie` devuelve `null` aunque el servidor la ofrezca, y
  `puertaSerieVisible(true)` es `false`.
- **`fiscal`, alta** (control positivo del filtro): el paso SÍ sale, sin la promesa, con la vista previa,
  y sigue guardando `{ vieneDeOtroSitio: true, ultimoNumero: 41 }`. Esto último **no cambia**: el campo
  se queda para 1216b.
- **`fiscal`, Ajustes:** la puerta sale sin la promesa, y la visibilidad sigue obedeciendo al servidor.
- **En el fuente de las dos pantallas:** la promesa no está.

**En rojo primero:** con las dos pantallas de `main` (hash de blob comprobado igual al de `main`) caen
los 5, por la promesa y por `receipt`. En `receipt`, los títulos recorridos eran `["¿A qué te dedicas?",
"¿Ya has facturado en 2026?", …]` y la puerta de Ajustes se pintaba. Con el cambio pasan los 5, y los 35
de los cuatro ficheros afectados.

### Tests existentes que cambian (regla 41: ninguno se relaja)

`scrum313-pantalla-numeracion` (lista de microcopy literal) y `scrumD1-puerta-serie` (las dos pantallas
dicen lo mismo) exigían la frase retirada. Sale de las dos listas, que siguen exigiendo el resto igual, y
su AUSENCIA la exige ahora `scrum1216a`. El guard de SCRUM-1029 no se tocó y sigue verde.

## ④ Lo que queda para 1216b, y SCRUM-1200

- **1216b:** con «41» declarado, la primera factura tiene que ser `F260042`; sin declarar, `F260001`.
  Toca `allocateInvoiceNumber` (regla 40) y lleva textos nuevos firmados. **J1 no lo empieza hasta que el
  GO del fundador para el camino de emisión, y los textos, estén escritos en el ticket.**
- **SCRUM-1200 vuelve a importar con 1216b.** En cuanto el número declarado cambie la factura, que el
  alta se trague un 400 con `.catch(() => {})` deja de ser inocuo: el profesional creería haber declarado
  el 41 y emitiría el 1. Va dentro de 1216b.

---

# SCRUM-1216b · El número de arranque declarado llega a la factura

**Medido contra:** `origin/main` = `cd78b8264d042dc01afe1ee714b002278f25e0a1` · 2026-09-28T15:30Z (J1; rama `scrum-1216b-numero-de-arranque`, encima de 1216a)

**GO del fundador para el camino de emisión (regla 40):** SCRUM-1216, comentario **17347**. Textos: los
cinco de la pregunta en el 17347 (firmados por Javier) y los tres de error en el **17349** (por el
orquestador, por delegación). Esquema: ALTER aditivo de dos columnas, decidido por el orquestador con el
SÍ de Javier (entrada en `docs/MIGRATIONS_PENDING.md`).

De las tres firmas de SCRUM-780 se reabre UNA: «serie nueva que empieza en 0001» pasa a «empieza donde él
diga». El formato `F260001` y la retirada del prefijo siguen intactos.

## ⑤ El rojo, contra el emisor REAL

`tests/scrum1216b-numero-de-arranque.test.mjs` no da por supuesto DÓNDE se guarda el arranque. Declara
por la ruta real (`POST /admin/onboarding/serie`, app real con Prisma sustituido), aplica al merchant lo
que la ruta escribe y emite con el `allocateInvoiceNumber` real (tx falso). Commiteado en ROJO
(`3516cad2`) antes de tocar el emisor:

| caso | antes | después |
|---|---|---|
| declara «41» | 🔴 `F260001` | `F260042` |
| la vista previa promete lo que sale (41) | 🔴 `F260001` / `F260001`: igual, pero MAL | `F260042` / `F260042` |
| F…0001..0010 emitidas + declara 41 | 🔴 200 (su serie saltaría de la 10 a la 42) | 409 `choca_con_emitidas` |
| declaró 41 y luego «No» | — | las dos columnas a **NULL explícito** → `F…0001` |
| CONTROL · «No, empiezo ahora» | `F…0001` | `F…0001` |
| **CONTROL SCRUM-780** · dev: contador viejo en 6 por `FG-001..005`, sin declarar | `F…0001` | `F…0001` |
| CONTROL · declarado 41 con F…0042 y 0043 emitidas | `F…0044` | `F…0044` (nunca repite) |
| CONTROL · declarado este año, factura el 15-ene del siguiente | `F(AA+1)0001` | igual |

## ⑥ Qué se tocó

- **Esquema:** `invoiceStartSeq` e `invoiceStartYear`, `Int?` sin default. `invoice_start_seq` guarda el
  ARRANQUE (declaró 41 → 42): nadie suma después, así que la vista previa y el emisor no pueden discrepar
  por un `+1`. Año PROPIO: `invoiceSeriesYear` lo reescribe el emisor en cada factura. **NULL = no
  declaró, que NO es 1**: si alguien «limpia» poniendo 1, «no contestó» y «declaró empezar en el 1» dejan
  de distinguirse para siempre.
- **Emisor (`invoiceNumber.service.ts`), dentro del GO:** dos campos más en el `select` y UNA línea en la
  rama F: `seq = seqDeLaSerieF(siguienteSeqDeLaSerieF(…), m, year)`. `seqDeLaSerieF` es pura y exportada:
  `máx(derivada, arranque)` si el arranque es de ese año, y un arranque corrupto (0, negativo, decimal,
  NaN, texto) cae a lo derivado. **`nextInvoiceNumber` no entra**: es el contador de la serie vieja.
  Rectificativas, cerrojo, auditoría y formato, intactos.
- **Rutas (`app.ts`):** `/admin/onboarding/serie` escribe las dos columnas (NULL explícito con «No»), y
  `/previa` y la respuesta del guardado componen el número con **la misma `seqDeLaSerieF`**. El choque del
  arranque, la relectura dentro del cerrojo y la puerta de `/admin/me` cuentan también la serie F
  (`emitidasDelAnio`, con `parseNumeroDocumento`). El bloqueo del prefijo sigue mirando sólo la vieja,
  porque tras el corte el prefijo no entra en la ordinaria.
- **Pantallas:** los textos firmados en UN sitio (`SERIE_TEXTOS`, `puertaSerie.js`), usados por el alta y
  por Ajustes. Se retira el campo «Serie». El año va por `ANIO_EN_CURSO` / `anio` (guard de SCRUM-313).

## ⑦ SCRUM-1200, cerrado aquí

`tests/scrum1216b-pantalla-arranque.test.mjs` (14) monta el dashboard y pulsa en las dos pantallas:

- **«Sí» sin número o con uno que no vale:** no avanza, no manda nada, el campo en Peligro (DESIGN.md
  §Inputs) y debajo el texto firmado. Vacío → `errorNumeroFalta`. Letras (`value` vacío +
  `validity.badInput`), 0, negativo, decimal → `errorNumeroNoValido`.
- **Rechazo del servidor**, decidido por `err.code` y nunca por el texto: `numero_fuera_de_rango` →
  `errorNumeroGrande`; `choca_con_emitidas` (409) → su texto aprobado. **No avanza**: `onNext` se queda en
  el paso si `save` devuelve `false`. El tope no se copia en el navegador: lo pone el servidor.
- **Mutación:** hacer que el `save` devuelva `true` en su `catch` (volver a tragárselo) hace caer
  exactamente los dos casos 400/409. Y contra las pantallas de 1216a caen los 14; muchos por el título
  nuevo, por eso vale la mutación y no ese rojo.

### Tests existentes que cambian (regla 41: ninguno se relaja)

- `scrum313-pantalla-numeracion`: la microcopy se exige literal en `SERIE_TEXTOS` y usada por el
  asistente (`TS.titulo(ANIO_EN_CURSO)`, …). Antes se exigía copiada en el asistente.
- `scrum1162` y `scrum1216a`: el título del paso es el firmado de nuevo en el 17347.
- `scrum780` (el caso de dev) sigue verde **sin tocarlo**.

### Guards que se movieron con el cambio, y por qué ninguno se relaja

- `scrum291` fija el sha256 de `invoiceNumber.service.ts`, y dice qué hacer: «si el GO existe, actualiza
  el hash EN EL MISMO COMMIT». Se actualizó (`ccfaacab…` → `74d298cb…`) citando el comentario 17347 y lo
  que cambia. Así el permiso queda en el diff.
- `scrum461`: `docs/sql/deriva-prod.sql` no miraba las dos columnas nuevas (el censo se habría
  encogido). Se regeneró con `scripts/generar-sql-deriva.mjs`: 487 columnas.
- `scrum525d`: dos coordenadas de `docs/legal/AUDITORIA_CAMINO_EMISION.md` se movieron de línea
  (`allocateInvoiceNumber` 395 → 432; `vf_hash`/`vf_prev_hash` 903-904 → 908-909). Se llevan donde están
  hoy; la afirmación no cambia.
- `scrum601` (`aPelo` 155 → 156): el diff del censo entre 1216a y 1216b es UNA línea, «Facturas
  recibidas», de un fichero que no cambió. Ya era visible, pero el censo no la veía. Entró porque
  `T.titulo(…)` puso el nombre `titulo` en su lista de nombres llamados en un sumidero. Explicado en el
  propio test.
- `scrum1185`: `/previa` seguía leyendo `req.body.serie`, que ya no manda ninguna pantalla. Arreglado en
  el CÓDIGO: la vista previa usa el prefijo del merchant.

**Tanda:** `npm test` entero murió por memoria de la máquina a las 7.598 pasadas. Lo que había fallado
hasta ahí se re-corrió fichero a fichero y está verde, salvo `scrum910d`: el assert de libuv de Windows
con `--test-force-exit`, que pasa 5/5 sin él. El resto de la tanda lo corre el CI.

## ⑧ Antes de mergear

La condición era que **producción tuviera las dos columnas, verificadas por catálogo**: `schemaDrift.ts` no
deja escuchar en `NODE_ENV=production` si el esquema espera columnas que la base no tiene (SCRUM-1122), y el
PR se mergea solo. J1 no empujó hasta tenerla.

✅ **Se cumple según SCRUM-1216, comentario 17369.** La medición es del **orquestador**, con la salida que
devolvió Javier; J1 no tiene clave de producción y no la ha visto de primera mano. La cita por lo que lleva
dentro: la salida literal, y un discriminador **por datos** que separa producción de staging (14/2 frente a
8/9), porque contar columnas no las separaba (66 en las dos). Detalle en `docs/MIGRATIONS_PENDING.md`.

Producción tiene 2 facturas (SCRUM-1216, comentario 17362: «facturas de prueba», según Javier). El camino de
emisión YA ha corrido allí, y esas dos no se renumeran nunca (regla 29). Este cambio no las toca: sólo decide
el número de las que se emitan a partir de ahora.

## ⑨ El rojo del PR #1895, y por qué no entraba (28-sep-2026, ~18:50Z)

**Medido contra:** `origin/main` = `0afa87cd`, run 36442328364, jobs 108995722459 (intento 1) y
109035653408 (intento 2), los dos sobre la misma cabeza `a00aac73`.

1. **El meta-guard es ajeno a esta rama, y es SCRUM-1100.** Con la MISMA cabeza, el intento 1 salió CIEGO en
   `scrum757` y el 2 en `scrum859`; en cada intento el otro fichero salió VIVO. Los dos con la firma de 1100:
   «NO APARECE en la pasada mutada», resumen llegado y recuentos que cuadran (scrum859: 9/7 frente a 20/0 en
   la limpia, el mismo recuento que 1100 lleva midiendo desde el 23-sep). Ninguno de los dos ficheros está en
   el diff. Esa misma tarde, el mismo CIEGO salió en `scrum-1179-b2-suelos` (859), `scrum-1179-e-…` (757) y
   `scrum-1229-firma-tecnico-viaje` (859). La hipótesis heredada («el CIEGO de scrum757») era la mitad: el
   fichero rota. No se ha relanzado.
2. **Lo que de verdad lo paraba era un CONFLICTO con main** (`mergeable: CONFLICTING`, 134 commits por
   detrás): `docs/MIGRATIONS_PENDING.md` (J6 registró el mismo ALTER en main) y el anclaje de
   `scrum601`. Resuelto con `git merge origin/main` dentro de la rama: en MIGRATIONS se queda la entrada de
   J6 y se le añade la verificación de producción de 17369; `scrum601` se REGENERÓ con su propio censo sobre
   el árbol fusionado → `{ flag: 17, tipo: 7, aPelo: 156 }` (el +1 flag de SCRUM-1164 y el +1 «a pelo» de
   este ticket, por separado). Tras el merge: tests de la rama + scrum237/267/854/976/1168/601 = 113/113 en
   12 ficheros, 0 saltados; `guards:entrada` 112/112.
