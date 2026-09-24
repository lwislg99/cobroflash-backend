# SCRUM-903 · 🔴 El marcador de microcopy que se imprime en el PDF

**Medido contra:** `origin/main` = `76c786f60721e0caeb7eac056b5f65863abb6b6b` · 2026-09-17T09:41:22Z
**Rama:** `scrum-903-marcador-impreso` · **Carril:** Sesión 3
**Gate:** el texto que apaga el marcador de la factura es del fundador. Propuesto en §5, **sin firma**.

> Una pantalla mal rotulada se arregla y se recarga. Un PDF mal rotulado ya está en el móvil de un
> cliente, y ahí no llega ningún despliegue.

**La gravedad baja de 🔴🔴 a 🔴** (decisión del orquestador, 17-sep): no hay ni un documento con el
marcador impreso en manos de nadie. El defecto es real —había un camino sin vigilar— pero es una
bomba desactivada antes de existir, no un incendio.

---

## 0 · Cuántos documentos hay afectados: CERO, y qué significa ese cero

Medido **en producción por el fundador**, no por esta sesión:

| | albaranes totales | con calidad «rara» |
|---|---|---|
| **producción** | **0** | **0** |
| staging | 1 | 0 |

⚠️ **La consulta que yo propuse habría fallado.** Escribí `"Albaran"` y `"firmadoPorCalidad"`, que son
los nombres del **modelo de Prisma**; la tabla real es `albaranes` y la columna `firmado_por_calidad`
(text). Lo destapó preguntarle al catálogo en vez de fiarse del esquema. La buena:

```sql
SELECT COUNT(*) FROM albaranes
WHERE firmado_por_calidad IS NOT NULL
  AND split_part(firmado_por_calidad, ':', 1) NOT IN (
    'el_propio_cliente','en_nombre_del_cliente','familiar_o_conviviente',
    'encargado_o_personal_de_obra','portero_o_conserje','otro');
```

🔴 **Y EL CERO ES SOBRE POBLACIÓN CERO. Que nadie lo cite dentro de un mes como prueba de que esto
funciona.** En producción no hay ningún albarán, así que el segundo cero no dice que el filtro sepa
reconocer una calidad rara: dice que no se ha enfrentado a ninguna. **Se ha medido el mundo, no el
instrumento.** Al instrumento lo miden los casos de §2, que sí le ponen delante una.

Del otro camino (la factura) ya se sabía: 0 facturas en producción, y además hace falta más de un
tipo de IVA.

## 1 · Los nueve, uno a uno

**POBLACIÓN MIRADA:** 380 ficheros del programa (285 `.ts` de `src/` + 95 `.js` del panel), **8.363
literales de cadena recorridos por AST**. Por AST y no por `grep`: un marcador en un comentario no se
imprime nunca, y contarlo habría inflado la población del lado tranquilizador.

De ahí: **27 literales contienen un marcador** · 21 son la declaración de una constante · **10 son
usos** · de ésos, **9 son el texto entero** (y 1 va acompañado: `criterioCaja.ts:77`).

⚠️ **El censo hubo que hacerlo DOS VECES, y la primera se dejaba fuera el más grave.** El marcador
vive bajo **cinco nombres distintos** — `MICROCOPY_PENDIENTE_290`, `MICROCOPY_PENDIENTE_308`,
`MARCADOR_MICROCOPY_DESGLOSE`, `PENDIENTE`, `MARCA_PENDIENTE` (esta última exportada y **sin usos**).
Un censo calibrado a `MICROCOPY_PENDIENTE` devuelve 8 y parece completo; el que se quedaba fuera era
justo el del PDF. Por eso el censo final busca por VALOR y descubre los nombres, no al revés.

### Los ocho de API — salen mal, alguien lo ve, se arregla

Todos responden `message:` con el marcador como texto entero, con su `error:` en claro al lado.

| sitio | `error` que acompaña | se alcanza cuando |
|---|---|---|
| `albaranes.routes.ts:1368` | `albaran_no_firmado` | se factura un albarán sin firmar |
| `albaranes.routes.ts:1371` | `albaran_ya_facturado` | el albarán ya tiene `invoiceId` |
| `albaranes.routes.ts:1388` | `facturacion_no_disponible` | el merchant está en modo `receipt` |
| `albaranes.routes.ts:1426` | `albaran_no_convertible` | hay motivos de casación (van en claro aparte) |
| `albaranes.routes.ts:1565` | — (éxito parcial) | se facturó pero falló el sellado o el adicional |
| `albaranes.routes.ts:1572` | `facturacion_no_disponible` | el `catch` del mismo camino |
| `invoicesAdmin.routes.ts:986` | el de `puedeRectificarse` | se rectifica una factura en estado no permitido |
| `criterioCaja.ts:77` | — | **no es texto entero**: el marcador va seguido de una frase |

### 🔴 El noveno, y el décimo que no estaba en la lista

**`pdf.service.ts:613`** — cabecera del desglose de IVA de una FACTURA, sólo con más de un tipo
impositivo. **Este ya estaba declarado y vigilado** (§3).

**`albaranFirmante.ts:269` NO es una respuesta de API: se imprime en el PDF del ALBARÁN.**
`etiquetaCalidad()` lo devuelve y `albaranPdf.service.ts` lo pinta en «En calidad de: ». Medido
ejecutando la función real:

```
"el_propio_cliente"            -> "El propio cliente"          (las seis, escritas)
"administrador"                -> "[PENDIENTE microcopy oficial]"   <-- MARCADOR IMPRESO
"ADMINISTRADOR"                -> "[PENDIENTE microcopy oficial]"   <-- basta cambiar mayúsculas
```

**Alcanzabilidad:** las dos rutas de firma validan contra el set, así que un dato NUEVO no puede
entrar mal. Queda abierto: datos anteriores a esa validación, y el día que se retire o renombre un
id — los albaranes firmados con él quedarían huérfanos y reimprimirían el marcador al regenerar.

Y se corrige un comentario que llevaba tiempo mintiendo: decía que las seis etiquetas seguían sin
aprobar y que por eso se imprimía el marcador. Están escritas, y ahora hay un caso que lo ata.

## 2 · Lo construido

`src/core/documentos/sinMarcadorPendiente.ts` · `textoParaDocumento(valor, donde)` devuelve el texto
y **lanza** si lleva un marcador. **Aplicado en un solo sitio: el albarán** (el porqué, en §3).
No escribe ni una palabra de microcopy: sólo cambia quién se entera de que falta.

⚠️ **El primer arreglo era peor que el defecto, y se detectó porque el caso rojo no cayó.** El bloque
de firma del albarán termina en `catch {}` **vacío** (está para que un PNG corrupto no tumbe el
documento). Con la comprobación dentro, encontrar un marcador no daba «el PDF no se genera»: daba
**un albarán firmado sin su firma, sin nombre y sin fecha, en silencio**. La etiqueta se resuelve
FUERA del `try`, y hay un caso que vigila justo eso.

**9 casos propios, código 0, 0 saltados**, cada criterio con sus dos mitades.

## 3 · 🔴 LA PREMISA DEL TICKET ERA FALSA, y esto es lo que más importa del ticket

El enunciado decía: «9 sitios, y **ninguno dentro de la población de ningún guard**». **No es cierto
para los que se imprimen**, y lo destapó la tanda completa: mi arreglo puso **17 casos en rojo**.

Lo que ya existía, medido leyéndolo:

- **`scripts/censo-marcadores.mjs` barre `public/`, `public/dashboard/js` y `src/`.** La premisa de
  que «`src/` no lo mira nadie» es falsa para el censo, y está escrita en el propio fichero de
  SCRUM-667 desde entonces.
- **`tests/scrum667-marcador-visible.test.mjs`** vigila las dos preguntas caras: cuántos marcadores
  VE alguien, y **cuál llega al PDF DEL CLIENTE**. Tiene un registro `EN_EL_PAPEL` con los
  **declarados** —hoy dos: el desglose de la factura y el pie del albarán con su presupuesto— y
  exige que el papel traiga **exactamente** ésos. Ni uno más ni uno menos.

Por eso **la mitad de la factura se ha retirado**: hacerla fallar cambiaba por la puerta de atrás una
política decidida en SCRUM-667, con su registro y su control negativo. Regla 41: se arregla el
código, no el guard.

⚠️ **Y `pdf.service.ts` queda IDÉNTICO a `main`, byte a byte — ni siquiera un comentario.** Al
retirar el filtro dejé escrito ahí *por qué* no va, y saltaron otros dos guards (SCRUM-603b y
SCRUM-723): vigilan que el ámbito que genera la factura no cambie respecto a la base de la rama,
porque cambiar lo que imprime una factura ya emitida es la regla 29. Miden **caracteres**, así que
un comentario cuenta. Tienen razón: el sitio para explicar por qué ese fichero no se toca es éste y
el caso de la tanda, no el fichero. Un tercer guard (SCRUM-838) cazó además una tautología que dejé
en mis propios casos —`assert.equal(antes, antes)`—, y también tenía razón: se ha sustituido por un
control que compara con el mismo albarán y una calidad válida, para que el rojo pruebe el filtro y
no otra avería. Lo que apaga ese marcador es **escribir el texto** y retirarlo de `EN_EL_PAPEL`
en el mismo commit — el propio guard lo dice en su mensaje de fallo.

**El hueco real, y es el que este ticket cierra:** el banco de SCRUM-667 genera su albarán con
`firmadoPorCalidad: null`, así que **la rama de la calidad no se ejercita nunca**. El guard existía,
miraba el sitio correcto, y su banco no llegaba a ese caso. Es exactamente el mismo patrón que el
`v.estado = 'borrador'` de `guard-marcadores-en-pantalla.mjs`.

## 4 · La red — PROPUESTA, no implementada

⛔ No he tocado `guard-marcadores-en-pantalla.mjs`.

**Por qué no veía el frontal:** su población son vistas y scripts del panel; `ESTADOS` son estados
**de carga** (`con-datos`, `sin-datos`, `error`), no de documento; y su banco (`rico()`) fabrica **un
único juego de datos** con cinco campos de estado fijos —`status:'pending'`, `estado:'pendiente'`,
`estadoCobro:'Pendiente'`, `firmado:false`, `emitido:false`— más el `v.estado = 'borrador'` de la
línea 194.

**El número que pedías: 22 de 92 scripts del panel ramifican por un estado de documento**, y el banco
sólo les sirve un valor de cada campo. No es que una vista tenga el banco fijado: **ninguna vista se
prueba en más de un estado de documento**; `albaran-detail` es sólo donde ya se notó.

**Qué propongo, para decidir tú:**

- **No hace falta un guard nuevo para el papel: ya está y funciona** (SCRUM-667). Lo que le falta es
  **que su banco cubra las ramas**, empezando por un albarán con `firmadoPorCalidad` puesto. Es más
  barato y más honesto que añadir un segundo vigilante al mismo sitio.
- **Para las respuestas de API sí falta población**, y ahí sí propondría algo aparte: por AST, todo
  literal que acabe en el `message` de un `res.json`. **Qué caso de hoy lo pondría rojo:** los 8 de
  §1 — y ése es el punto, el número no puede salir 0 el día que se enciende.
- **El banco por estados es un ticket aparte y más grande**: 22 scripts × sus estados, y hay que
  decidir de dónde salen esos estados sin inventarlos. Medido, no empezado.

## 5 · 🔴 EL LITERAL, PROPUESTO Y SIN FIRMAR

> No está escrito en el producto: una frase plausible puesta por una sesión parece aprobada, y el
> marcador al menos se ve. Aquí y en el comentario **15694** del ticket — **no** en `docs/microcopy/`,
> que exige firma válida a todo lo que contiene (SCRUM-726) y es el archivo de lo firmado, no el
> buzón de lo pendiente.

Hace falta **un** texto: la cabecera del desglose de IVA de la factura (`pdf.service.ts:613`). El
albarán **no necesita texto nuevo**: sus seis etiquetas ya están escritas.

| propuesta | a favor | en contra |
|---|---|---|
| **Desglose por tipo de IVA** | dice lo que hay debajo; «desglose» es la palabra de la AEAT | «IVA» se queda corto con IGIC o IPSI — el código ya llama `impuesto` a esa variable |
| **Desglose por tipo impositivo** | no se rompe en Canarias, Ceuta ni Melilla; término del reglamento | más frío y más largo: un autónomo no dice «tipo impositivo» |
| **Bases imponibles** | es lo que enumera la columna ancha | no menciona las cuotas, y la tabla también las trae |

**Recomendación: «Desglose por tipo impositivo».** Al escribirlo hay que **retirar
`MARCADOR_MICROCOPY_DESGLOSE` de `EN_EL_PAPEL` en el mismo commit**, o SCRUM-667 se queda esperando
un marcador que ya no sale.

## 5bis · Hallazgo lateral, sin arreglar: un rojo que sólo existe dentro de la tanda completa

`tests/scrum765-*` · «el meta-guard ARRANCA de verdad al invocarlo por su ruta» falla con
`spawnSync ETIMEDOUT` **sólo dentro de la tanda completa**. Medido:

- aislado, con la máquina libre: `node scripts/meta-guard-mutaciones.mjs --solo-censo` tarda
  **38 s** y sale con **código 0**;
- el caso lo invoca con `timeout: 120000`, y dentro de la tanda —7.248 casos compitiendo— se pasa;
- **las dos tandas completas de esta rama lo dieron rojo, y las dos veces aisladas pasó**;
- no hay constancia previa de esto en `docs/BUGS.md` ni en el propio fichero.

No es de este ticket y **no lo he tocado**: es un guard de otro carril, y un timeout que se sube sin
medir es la forma de ocultar que algo se está volviendo lento. Queda dicho aquí: un caso que sólo es
rojo cuando hay carga es un rojo intermitente, y de ésos ya sabe esta casa.

## 6 · Lo que este PR NO hace

1. **No escribe ningún texto.** Los 9 marcadores siguen ahí.
2. **No toca los 8 de API**: salen igual que hoy.
3. **No toca la factura**: su marcador está declarado y vigilado (§3).
4. **No reescribe ningún documento emitido** (regla 29) — y no hay ninguno.

---

# APÉNDICE · FASE c (17-sep-2026) · ¿Cuántos bancos están fijados en un estado?

> ⚠️ Se ANEXA. Nada de lo de arriba se toca.

**Medido contra:** `origin/main` = `2be8fe16a3245322e64837f789189875e0c9f560` · 2026-09-17T14:37:21+01:00
**Rama:** `scrum-903c` · **Instrumento:** `scripts/censo-bancos-fijados.mjs`

## El patrón que abre esta fase

Un guard puede estar en el sitio correcto, declarar la población correcta, y no ver nada porque
**su banco fija un estado**. Salió dos veces el mismo día, en dos guards distintos:

* `guard-marcadores-en-pantalla.mjs:194` hace `v.estado = 'borrador'` a todo albarán. La vista
  `albaran-detail` está entre las 27 vigiladas; su banco nunca sirve un albarán `firmado`, que es
  donde vivía el marcador de SCRUM-895.
* el banco de `scrum667-marcador-visible` genera su albarán con `firmadoPorCalidad: null`, así que
  la rama que pinta la etiqueta de calidad no se ejercita jamás.

## 🔴 Lo primero que midió el instrumento fue que SON DOS FAMILIAS, no una

El primer criterio derivaba el dominio de un campo de los valores que ese campo toma en el árbol.
**Falló los dos controles positivos, por motivos opuestos:**

* `estado` tiene **44 valores distintos** en el árbol, porque el nombre lo comparten el albarán, la
  factura, el trabajo, el bot y media docena de censos. Un dominio por nombre de campo no existe:
  `'borrador'` y `'refunded'` no son el mismo eje.
* `firmadoPorCalidad` tiene **uno**, `null`, así que no parecía dominio ninguno.

De ahí las dos familias, que se cuentan por separado:

| | qué es | cómo se detecta |
|---|---|---|
| **① PARCIAL** | el banco sirve k de N valores de un dominio DECLARADO | enlace por **valor**, no por nombre de campo |
| **② AUSENTE** | el banco fija un campo en `null`/`''` que en otro sitio sí lleva dato | el campo recibe literal real en ≥1 fichero más |

Sin la ②, el caso de SCRUM-667 no sale. Sin la ①, no sale el de SCRUM-895.

## POBLACIÓN

| | |
|---|---|
| ficheros leídos | **1.570** |
| dominios declarados en el árbol | 91 → **70 útiles**, 21 descartados por ser listas de nombres |
| ficheros de `tests/` y `scripts/` **con banco** | **851** |
| · **clasificados** | **422** |
| · **NO CLASIFICADOS** (cuentan del lado malo) | **429 · 50 %** |
| bancos acusados en alguna familia | **414 de 851 · 49 %** |

**La mitad no se clasifica**, y eso es la mitad del resultado: son bancos que no asignan ningún
valor perteneciente a un dominio declarado. No significa que estén sanos — significa que este
instrumento no puede decir nada de ellos.

## CONTROLES

**✅ POSITIVO — los dos casos, cada uno en su familia:**

```
① scripts/guard-marcadores-en-pantalla.mjs:194 · schema:estado  sirve 1/3 → falta emitido, firmado
② tests/scrum667-marcador-visible.test.mjs:237 · firmadoPorCalidad fijado en vacío; lleva dato en 16 ficheros
```

> 🔴 **El positivo exige el EJE, no sólo el fichero.** La primera versión daba el control por bueno
> porque `guard-marcadores-en-pantalla` salía acusado… por el eje `schema:plan`. Acertaba la
> respuesta conocida **por el motivo equivocado**, que es no tener control.

**✅ NEGATIVO:** 113 pares banco·eje recorren su dominio ENTERO y salen limpios (p. ej.
`tests/albaran.test.mjs · ALBARAN_MODOS_VALORACION` 2/2). El criterio no acusa por existir.

**SUELO:** 0 bancos o 0 dominios declarados → sale CIEGO con código 2.

## HALLAZGO ① · PARCIAL — y por qué va partido en dos listas

| | pares |
|---|---|
| **FIABLE** — dominio documentado en una columna del esquema | **329** |
| **AMBIGUO** — dominio sacado de un array del código | **831** |

**Los 831 ambiguos contienen falsos positivos que no se pueden separar estáticamente**, y esto es
el límite del instrumento. Un array de literales puede ser un dominio (`FIRMANTE_CALIDAD_IDS`) o
una lista de nombres (`REVISION_HEREDA`, los campos que hereda una revisión; `ORDEN_BORRADO_MERCHANT`,
los modelos que se borran en orden). Se probaron **tres** cortes para separarlos —que sus valores se
asignen, que los asigne un mismo campo, que sean cortos— y **ninguno lo consigue**, por una razón
que es del lenguaje y no del corte: en este árbol **los identificadores se escriben como cadenas**
(`modelo: 'invoice'`, `campo: 'lines'`), así que un nombre de campo es un valor asignado igual que
`'firmado'`.

Los **329 fiables** sí son señal. Cabeza de la lista, por cuánto se pierden:

```
 7   1/8   scripts/_pagina-panel.mjs:82 · schema:type  → 7 tipos de evento sin servir
 6   1/7   scripts/seed-demo.mjs:209    · schema:trade → 6 oficios sin servir
 6   1/7   tests/_tenencia-por-lectura.mjs:95 · schema:trade
 6   2/8   scripts/seed-demo.mjs:382    · schema:type
 …
 2   1/3   scripts/guard-marcadores-en-pantalla.mjs:194 · schema:estado → emitido, firmado
```

**23 de los pares fiables son de `scripts/guard-*`**, que es la población que más importa: un banco
de semilla que sirva un solo oficio es un dato de prueba pobre; un GUARD que sirve un solo estado
es una promesa de vigilancia que no se cumple.

## HALLAZGO ② · AUSENTE — 593 pares, y el orden no es el bueno

El criterio ordena por en cuántos ficheros más ese campo sí lleva dato. La cabeza la ocupan campos
genéricos —`name` (232), `type` (174), `status` (154)— y **el caso conocido de SCRUM-667 cae en el
puesto 221 de 595**. O sea: el instrumento lo VE, pero no lo destaca.

Fijar `name: null` en un banco casi nunca importa; fijar `firmadoPorCalidad: null` sí, porque hay
una rama de producto detrás. **Esa diferencia no está en el dato que tengo**: haría falta saber si
el producto RAMIFICA sobre el campo, y `firmadoPorCalidad` no se compara nunca contra un literal
—entra por `FIRMANTE_CALIDAD_SET.has(id)`—, que es justo lo que tumbó el primer criterio.

## ③ ¿Se puede vigilar esto con un guard, o sólo leer?

**Con un guard, NO. Sólo se puede leer, y hay que decirlo.**

No es por falta de instrumento: es que el criterio, medido, **no separa lo que acusa**.

1. **La ① ambigua tiene 831 pares con falsos positivos irreducibles.** Un guard que los emitiera
   daría rojos sobre `REVISION_HEREDA` —una lista de campos que hereda una revisión, donde no hay
   ningún estado que servir—. Un rojo injusto enseña a desactivar el guard, y entonces se pierde
   también la parte que sí valía.
2. **La ② no sabe ordenar por daño.** Con el caso real en el puesto 221, un trinquete sobre su
   número subiría y bajaría por `name: null` en bancos nuevos, sin relación con el defecto.
3. **El 50 % no clasificado no mejora solo.** Un guard que no puede hablar de la mitad de su
   población no está vigilando esa mitad: está callando sobre ella.

> 🔒 Contra un valor ilegible se programa una barrera. Contra uno plausible no hay síntoma — y
> estas dos listas están llenas de valores plausibles.

**Lo que SÍ es accionable hoy, sin guard:** los **329 pares fiables**, y dentro de ellos los **23
de `scripts/guard-*`**. Esa lista es corta, está ordenada y cada entrada dice qué estado NO se
sirve. Se lee, se decide cuál importa, y se arregla el banco de ese guard — uno a uno, con su
motivo, como se arregló el de SCRUM-895.

**Con qué se compara esta respuesta.** En la novena auto-referencia dije que SÍ se podía vigilar
porque la distinción era de **posición sintáctica** —una propiedad del texto, decidible—. Aquí la
distinción es **semántica**: si una lista de cadenas es un dominio o un índice de nombres depende
de lo que significan, no de dónde están escritas. Por eso allí la respuesta fue sí y aquí es no.

⛔ **No se ha arreglado ningún banco** (regla 9). El censo cuenta y ordena.

---

# APÉNDICE · FASE d (17-sep-2026) · Los 24 pares de guards, y los dos arreglados

> ⚠️ Se ANEXA. Nada de lo de arriba se toca.

**Medido contra:** `origin/main` = `de798f5c9ca710041adf93886f1e63da390e6339` · 2026-09-17T15:43:02+01:00
**Rama:** `scrum-903d`

**Premisa comprobada antes del PASO 0** (norma nueva): el censo se volvió a correr sobre el main de
ahora —82 commits por delante de la medición de la fase c— y **sigue en pie**: 1.583 ficheros,
861 bancos, los dos casos conocidos salen. Las ramas `scrum-903c` y `scrum-895-literales-firmados`
ya están en main, así que el instrumento estaba en el árbol.

## ① Los 24 pares de `scripts/guard-*`, ordenados por si hay un defecto detrás

No por cuántos estados se pierden: por **si algo conocido vive en el estado que no sirven**.

### A · Defecto conocido y MEDIDO — se arreglan (bloque ②)

| guard | eje | sirve | qué vivía ahí |
|---|---|---|---|
| `guard-marcadores-en-pantalla.mjs:194` | `schema:estado` | 1/3 | **SCRUM-895**, en `firmado` |
| `tests/scrum667-marcador-visible.test.mjs:237` | `firmadoPorCalidad` | sólo vacío | el marcador de `albaranFirmante.ts:269`, **impreso en el papel del cliente** |

### B · Mismo pin, mismo sujeto, defecto plausible sin medir — los que yo arreglaría después

| guard | eje | sirve | por qué importa |
|---|---|---|---|
| `guard-objetivo-tactil.mjs:201` | `schema:estado` | 1/3 | **El mismo albarán clavado en `borrador`.** Y SCRUM-895 acaba de meter en la barra de `firmado` el rótulo más largo de las once (`Facturar con el presupuesto`, 27 car.). Este guard mide objetivos táctiles ≥44 px: **nadie ha medido nunca esa barra**. |
| `guard-vias-de-cobro.mjs:248` | `schema:connectStatus` | 1/4 | Su sujeto **es** si el profesional puede cobrar, y la fila de tarjeta depende de Connect (reglas 18/23). Eje y sujeto coinciden, como en el caso medido. |

### C · El pin no toca el sujeto del guard — bajo valor

`schema:role` → falta `tecnico` (4 guards) · `schema:plan` → falta basic/empresa/trial (4) ·
`schema:connectStatus` en otros 5 · `schema:status` de equipo (3) · `schema:subscriptionStatus` (2) ·
`schema:status` de notificación (1). Son guards de maquetación y marcadores: su veredicto no
depende de esos ejes. El que más me preocuparía de este grupo es `appUserRole = 'admin'`, global y
fijo en varios: si alguna vista oculta controles a `tecnico`, no se mide en ninguno.

### D · Falso positivo semántico — no hay nada que arreglar

`guard-firma-con-tramos.mjs:46` · `schema:paymentTerms` 1/3. **Su eje real es `tiers`, no
`paymentTerms`**: el censo acierta el campo y falla el sujeto. Es exactamente el límite que declaré
en la fase c, ahora con nombre y apellidos.

> **Mi recomendación, y decides tú:** arreglar B1 (`guard-objetivo-tactil`) a continuación, porque
> SCRUM-895 acaba de hacer que su punto ciego sea load-bearing. Luego B2. C y D no se tocan.

## ② Los dos arreglados, con el control que decide

### El pin visible… y el invisible

`guard-marcadores-en-pantalla` tenía **dos** pins en el mismo eje, no uno:

1. `v.estado = 'borrador'` — explícito, el que estaba medido.
2. **`window.appModoEmision` sin poner.** Desde SCRUM-905 `facturaFiscalDisponible()` falla cerrado:
   sin modo, las dos primarias contextuales del albarán firmado no se pintan. O sea que **servir el
   estado `firmado` no habría bastado**: el botón seguiría sin salir, y nada en el fichero decía
   «modo de emisión», así que nadie iría a buscarlo.

> 🔒 **Un global ausente fija tanto como una constante escrita, y es peor: no se ve.**

Los estados se leen ahora de `window.ALBARAN_STATES` —la tabla que ya usa `destinoEfectivo`—, no
escritos a mano: una segunda copia del dominio volvería a quedarse atrás en silencio.

### EL CONTROL QUE DECIDE — medido en cuatro pasadas, no razonado

Se reintrodujo **el defecto exacto de SCRUM-895** (retirar `btnConvertirFactura` de
`ROTULOS_ALBARAN`) y se corrió el guard antes y después del arreglo:

| | banco | resultado |
|---|---|---|
| **A** · defecto puesto, banco VIEJO | `borrador` | **rc=0 · VERDE** — el defecto escapa |
| **B** · árbol limpio, banco NUEVO | `borrador, emitido, firmado` | rc=0 · verde, **mismos techos** |
| **C** · defecto puesto, banco NUEVO | `borrador, emitido, firmado` | 🔴 **rc=1** — `albaran-detail` pinta 2 |

**A → C es la prueba**: con el banco arreglado el guard CAZA lo que antes se le escapaba. **B es el
control negativo**: lo que ya cazaba lo sigue cazando y no salta nada nuevo.

El fichero de producto se restauró **byte a byte** después de cada mutación (`cmp -s`), y se
comprobó `git status` antes de seguir: un guard muerto a mitad deja ficheros mutados en el árbol.

### El segundo: el banco de SCRUM-667

Servía un albarán **sin firma ninguna** (`firmadoAt`, `firmadoPorNombre`, `firmadoPorCalidad` los
tres a `null`), y `albaranPdf.service.ts:349` calcula la etiqueta del firmante **sólo si**
`firmadoPorCalidad` tiene valor. Ese bloque no se ejecutaba jamás — y ahí dentro está
`albaranFirmante.ts:269`, uno de los nueve sitios de este ticket **y de los caros: se imprime en el
papel que se lleva el cliente.**

Ahora el estado de firma es un parámetro y el test sirve los dos papeles.

| | resultado |
|---|---|
| árbol limpio, banco nuevo | **10/10 verde** — nada nuevo salta |
| calidad **desconocida**, banco nuevo | 🔴 **rc=1** — caza el marcador impreso en el papel |

Con el banco viejo esa rama era **inalcanzable**, así que no había rojo posible.

### LOS NÚMEROS

| | antes | después |
|---|---|---|
| pares (vista, estado) medidos por el guard de marcadores | 81 | **87** |
| estados de albarán servidos | 1 de 3 | **3 de 3** |
| apariciones cazadas en árbol limpio | 12 | **12** (mismos techos) |
| defectos reintroducidos que caza | **0 de 1** | **1 de 1** |
| papeles del cliente medidos por SCRUM-667 | 2 | **3** |
| estados de firma servidos | 1 de 2 | **2 de 2** |

⛔ **Ningún fichero de producto tocado.** Sólo los dos instrumentos.
