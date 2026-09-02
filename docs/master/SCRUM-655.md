# SCRUM-655 (T6, sprint Tecnosel) · Apartados, numeración derivada y la descripción que se pinta

**Fecha:** 2-sep-2026 · **Carril:** presupuestos · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `01d5c5a06027a443542cb327e029195ac561fda6` · 2026-09-02T11:06:57+02:00

> **El ticket encogió al medirlo, y eso fue lo mejor que le pasó.** El PASO 0 corrigió dos premisas
> del encargo y las dos correcciones quitaron trabajo en vez de añadirlo.

## 1 · El PASO 0, y los dos canales que no había que construir

«Multilínea» no describe el texto: describe el **canal**. Medidos los tres antes de escribir nada:

| canal | lo que se suponía | lo medido |
| --- | --- | --- |
| **PDF** | «depende del generador» | ✅ **ya resuelto**: `partirConceptoYDescripcion` (SCRUM-603) parte el concepto por el primer salto y lo pinta aparte. Una sola copia, compartida con la factura. **No se toca.** |
| **Pantalla** | «hay que pintarlo» | 🔴 **el hueco real**, con su línea: `quotesDetailView.js:500` metía el concepto como HTML —`<td>${escHtml(l.concept)}</td>`— y el HTML **colapsa** los saltos. Ocho renglones de texto técnico salían en una línea corrida. |
| **WhatsApp** | «llega tal cual» | 🔴 **no es un canal para este dato**: `concept` no aparece ni una vez en `whatsapp.ts`, y el presupuesto viaja como **enlace**. |

> **El tercer canal no había que medirlo: había que no inventarlo.** Es el error que esta casa ya
> pagó —`white-space: pre-line` en dos textos que no lo necesitaban— repetido por analogía.

## 2 · 🔴 Y la descripción tampoco se arregla con `white-space`

El reflejo es `pre-line`. **No se usa, y es deliberado**, por dos motivos que se sostienen solos:

1. Protegería un salto que **en el HTML ya no existe como estructura**.
2. Desde `node:test` **no hay forma de comprobar que el estilo esté puesto**: un test que mira el
   `.js` pasaría con el CSS borrado.

Así que la descripción se convierte en **estructura**: `celdaConcepto` devuelve **un elemento por
renglón**. El salto sobrevive sin depender de ninguna propiedad de CSS, y el test mide el árbol de
nodos que sale — el resultado, no la fuente.

## 3 · Un apartado es una LÍNEA MARCADA, y las cabeceras no suman

`Quote.lines` es plano y todos sus consumidores lo recorren: un array de apartados cambiaría la
forma para todos. La cabecera es **aditiva** — el que no sepa de apartados ve una línea más.

### 🔴 Y «no suman» no era lo que pasaba: era `NaN`

Medido con el `calcTotal` real **antes** de tocarlo:

```
calcTotal([{concept:'Mano de obra', qty:2, price:100}])              →  200
calcTotal([{concept:'1. APARTADO'}, {concept:'Mano de obra', …}])    →  NaN
```

`undefined * undefined` es `NaN`, y contamina la suma entera. Una cabecera sin este arreglo **no
deja el total igual: deja el presupuesto sin total.**

Se filtran **por su marca**, no por «no tener precio»: así una cabecera a la que alguien le meta un
importe sigue sin mover el total. Ése es el rojo que pediste, y está en el test.

## 4 · La numeración es derivada, y dos líneas no pueden compartir número

`1` para la cabecera, `1.01`, `1.02`… para sus partidas, todo desde el par (apartado, posición).
Mover una línea recoloca los números solos. Probado sobre **3 apartados × 15 líneas = 45 números
únicos**, no sobre el ejemplo de cinco: un contador que no se reinicia o un relleno de ceros que
colisiona sale ahí y no en el caso pequeño.

**Sin apartados no se numera nada** y **una línea anterior a la primera cabecera tampoco recibe
número** — darle un «0.01» sería inventarse una sección que nadie escribió.

## 5 · Hallazgo arreglado dentro (regla 37): `calcTierTotal` era una segunda copia

Lo destapó el compilador al hacer `qty`/`price` opcionales: `quotes.routes.ts:14` tenía **la misma
aritmética del total escrita otra vez**. Se habría quedado sumando `undefined` mientras la de
`utils` ya sabía saltarse las cabeceras. **Ahora delega.** Misma zona, bloqueaba la tarea, cabía.

Efecto medido: `quotes.routes.ts` **sale** del censo de aritmética de IVA de SCRUM-627, y la bajada
queda anotada — un arreglo sin anotar se deshace solo.

## 6 · La revisión: campo aparte, derivación construida, **cable parado**

`numeroConRevision` y `vigenteDe` están escritos y probados: crear la `.1` **añade**, no sustituye,
y «vigente» es la revisión más alta, derivada.

🛑 **No se cablea, y el diff va preparado**: `Quote` tiene `quoteNumber Int?` y **no** tiene campo de
revisión. `prisma/schema.prisma` es del fundador.

```prisma
model Quote {
  …
  // SCRUM-655 (T6) · La revisión de un presupuesto. `0` = original, `1` = el «P2004226.1».
  // VA APARTE y NO dentro del texto del número: metido en la cadena, saber qué revisiones hay
  // obligaría a PARSEAR UN TEXTO ESCRITO PARA HUMANOS, y el día que alguien cambie el formato el
  // mecanismo muere en silencio. «Vigente» tampoco es una bandera: es la revisión más alta,
  // derivada — una bandera puede contradecir a los datos (dos vigentes, o ninguna).
  revision Int @default(0)
}
```

```sql
ALTER TABLE "quotes" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;

-- Verificación, detrás y en la misma sesión. Y su suelo: cero filas significa que el ALTER no se
-- aplicó, no que esté bien.
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'quotes' AND column_name = 'revision';
```

Es 100 % aditivo y con `DEFAULT 0`: todos los presupuestos existentes quedan como originales, que es
lo que son. Orden de siempre: **staging → verificar → producción → verificar → `schema.prisma` al
final.**

## 7 · Los guards ajenos que saltaron, y qué decidió cada uno

Nueve, y ninguno se apagó:

| guard | qué cazó | qué se hizo |
| --- | --- | --- |
| `_banco-vistas` ×2 | 67 scripts donde declaraba 66 | subido, con el motivo |
| SCRUM-411 (trinquete) | dominio nuevo inalcanzable | **7 → 8** a conciencia: `revision.ts` espera su campo |
| SCRUM-411 (huérfanos) | `MARCA_APARTADO` y `esApartado` exportados sin consumidor externo | **se les quitó el `export`** — y la clave compartida pasó a probarse **por efecto**, que es más fuerte |
| **SCRUM-619** ×2 | el vocabulario de la línea creció | **la decisión, escrita** — abajo |
| SCRUM-627 ×2 | la lista de aritmética de IVA cambió | anotada la bajada de `quotes.routes.ts` |

### 🔴 La decisión que SCRUM-619 exigía: qué hace la factura con `apartado`

**Nada, y es deliberado.** Un apartado es la estructura de lectura de una **oferta**; la factura es
otro documento y no la hereda. Al facturar, `Invoice.lines` recibe las líneas sin las cabeceras y
sin la marca.

**Los importes no cambian** —las cabeceras nunca sumaron—, así que no hay un euro en juego: lo que
se pierde es el agrupamiento visual. Y no se arregla aquí: tocar la puerta de la factura es camino
de emisión y está fuera de T6. Queda declarado para que la decisión sea de alguien y no del
descuido.

## 8 · Lo que NO se ha tocado

El IVA, los totales con IVA y las cláusulas de cierre (**T7**, la tanda siguiente) · el PDF ·
`whatsapp.ts` · la factura y el camino de emisión · `prisma/schema.prisma` · trabajos, partes y
empleados.

**Suite entera: 4.303 tests · 4.224 pasan · 0 fallos · 79 saltados.**

---

# FASE B (2-sep-2026) · `revision.ts` YA TIENE LLAMADOR — y era el último

> ⚠️ Se ANEXA. Nada de lo de arriba se toca: la fase A documenta lo que era cierto entonces.

**Fecha:** 2-sep-2026 · **Carril:** presupuestos · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `78f008cb1aa42678a2db06b1ac31193bf57d205a`

## 1 · PASO 0 · el gate ERA cierto, y ha caído

La nota de la fase A decía que este módulo no tenía cable porque «`Quote` tiene `quoteNumber Int?`
y NO tiene campo de revisión». **Lo comprobé en el árbol antes de escribir una línea**, y ya no es
cierto: `prisma/schema.prisma:438` trae `revision Int @default(0)` (SCRUM-674, mergeado hoy). El
comentario del propio esquema ya dejaba escrita la decisión de diseño:

> «Vigente» tampoco es una bandera: es la revision mas alta, derivada — una bandera puede
> contradecir a los datos (dos vigentes, o ninguna).

Censo de PASO 0, ejecutado:

```
git ls-tree -r --name-only origin/main | grep -iE 'scrum-?655|revision'
  docs/master/SCRUM-655.md
  src/modules/quotes/domain/revision.ts
  tests/scrum655-apartados.test.mjs

git ls-remote --heads origin | grep -iE 'scrum-?655'
  59b284297bc9a2fb7acac5b76a79b91c7fca6cb0  refs/heads/scrum-655-apartados-presupuesto
```

Esa rama es la fase A y **ya es ancestro de `origin/main`** (comprobado con `merge-base
--is-ancestor`, no por el estado de un ticket). No hay trabajo duplicado.

## 2 · SCRUM-411: 9 → 8, RECONTADO

No restado de cabeza. Ejecutado `analizar()` —el mismo que usa el guard— sobre este árbol:

| | antes | después |
| --- | :-: | :-: |
| módulos de dominio | 126 | 126 |
| alcanzables | 288 | **289** |
| **inalcanzables** | **9** | **8** |

`src/modules/quotes/domain/revision.ts` ya no está en la lista. El trinquete es de igualdad
exacta —cayó con «el tope (9) ya no coincide con la realidad (8)»— así que el tope baja a 8 en
este mismo commit, con su motivo. Y el renglón **se da la vuelta, no se borra**: hay un test que
falla NOMBRANDO el módulo si mañana alguien retira el cable, igual que con `retencionIrpf`.

## 3 · Quién lo consume

`src/modules/system/quoteAdmin.ts` → `getQuoteDetailAdmin`, que es lo que sirve
`GET /admin/quotes/:id`. La pantalla del presupuesto ya recibe:

- `revisiones[]` — todas las versiones del mismo número base, ordenadas, cada una con su `numero`
  pintado (`P2004226`, `P2004226.1`), su estado, su total, y **`firmado`**;
- `vigenteId` — cuál es la buena hoy;
- `numeroConRevision` y `revision` de la que se está mirando.

**`number` NO se toca.** Un presupuesto sin revisiones viaja exactamente como viajaba, y todo lo
que ya lo consumía sigue leyendo lo mismo.

Tres decisiones que no son de estilo:

1. **El grupo es `{merchantId, quoteNumber}`, y un `quoteNumber` NULO no es una clave.** Agrupar
   por null metería en el mismo saco a todos los presupuestos sin numerar del merchant. Sin
   número, un presupuesto es su propio grupo — y eso es la verdad, no un apaño: sin número no hay
   «P2004226» del que ser la revisión.
2. **`firmado` se deriva de `signatureUrl`, no de `acceptedAt`** — el mismo criterio que el libro
   registro y el embudo de métricas, que lo dejan escrito: aceptar y firmar no son lo mismo.
3. **El trazo NO viaja.** `signatureUrl` es un data-URI con la firma del cliente; de la consulta
   sale sólo el booleano.

## 4 · La regla vive en el dominio, y por eso se puede probar

`vistaDeRevisiones(propia, grupo)` es una función pura en `revision.ts`, y es lo que corre el
endpoint. Dentro del endpoint sólo se podría probar con base de datos, y la regla del ticket
—«dos vigentes no es una respuesta»— habría quedado detrás de un gate.

## 5 · 🔴 «Cuál está vigente» con dos respuestas no es una respuesta

`vigenteDe` (fase A) resuelve el empate **en silencio**: recorre y se queda con la primera que vio.
`vigenteUnicaDe` (fase B) PARA y nombra a las dos:

```
DOS VIGENTES A LA VEZ: P2004226.1 (revisión 1) y P2004226.1 (revisión 1).
  «Cuál está vigente» con dos respuestas no es una respuesta. Elegir una de las dos aquí
  sería peor que fallar: la pantalla enseñaría una y el PDF podría enseñar la otra…
```

**Y cae con el mecanismo viejo**, que es lo que prueba que hacía falta. Midiéndolo salió algo peor
de lo que yo suponía: escribí el test esperando que la segunda empatada quedara como no-vigente, y
el rojo dijo `true`. `esVigente` compara `{numero, revisión}`, así que con un empate **las DOS
contestan «soy la vigente»**. No es que una desaparezca de la pantalla: es que las dos se pintan
como la buena a la vez. El test conserva esa medición.

## 6 · 🔴 Un presupuesto FIRMADO no se reescribe

Si el cliente pide cambios sobre uno ya firmado, eso es una revisión NUEVA. La firma cubre lo que
el cliente VIO. `nuevaRevisionDe(anterior, siguiente)` es pura y devuelve **los datos de la fila
nueva, sin `id`**: no tiene a quién sobrescribir aunque se lo pidieran. El test comprueba la huella
del original antes y después — ni una línea cambia.

Y el reparto de campos es **cerrado y contrastado con el esquema**: `REVISION_HEREDA` (el
contenido), `REVISION_NO_HEREDA` (la firma, la evidencia, la decisión, el cobro, el enlace público,
el PDF… cada uno con su motivo) y `REVISION_LA_PONE_EL_SISTEMA`. Un test lee `model Quote` de
`prisma/schema.prisma` y exige que **todo campo escalar esté clasificado**: una columna nueva sin
clasificar cae en rojo. Sin eso, un campo nuevo simplemente no viajaría — y eso no falla: la
revisión nace sin ese dato y nadie se entera hasta que el cliente lo echa de menos en el documento.

## 7 · Lo que NO se ha hecho, y por qué

- **No hay endpoint para CREAR la revisión.** El encargo pedía consumidor y la pregunta de
  pantalla; un `POST` que crea filas es superficie de escritura nueva y no estaba pedida.
  `nuevaRevisionDe` queda como la regla ejecutable, declarada como tal en el registro de huérfanos,
  y se borra esa línea el día que un `POST` la cablee. **Es la siguiente fase natural.**
- **No se toca la pantalla.** El backend ya manda `revisiones` y `vigenteId`; pintarlo lleva
  microcopy y la microcopy se propone, no se aprueba (regla 30). **Propuesta, sin aprobar:** en el
  detalle, junto al número, un selector con las versiones y la vigente marcada.
- **`prisma/schema.prisma` no se toca** y **no hace falta ninguna columna más**: `revision`,
  `quoteNumber` y `signatureUrl` ya están.
- **Ni la pantalla del parte ni sus ficheros** (sesiones 2 y 3) · ni el camino de emisión.

## 8 · Un hallazgo de otro carril, que se REPORTA y no se arregla

`esVigente` compara por `{numero, revisión}` y no por `id`. En el camino de pantalla es inofensivo
—`vigenteUnicaDe` para antes de que dos puedan empatar—, pero es una comparación que **no
distingue dos filas distintas con los mismos dos números**. Queda medido y escrito aquí; cambiarlo
tocaría la superficie de la fase A y no bloquea nada.

## 9 · LOS ROJOS · commit de resguardo `6681feef8612f9172a2bf99ed7db599189b1d094`

Cinco inyecciones. Cada una: inyectar → compilar → medir → restaurar → verde. Nada sin commitear.

| # | Qué se rompe | Qué cae |
| :-: | --- | --- |
| 1 | el empate se resuelve en silencio (`if (false && empatadas.length > 1)`) | 2/15 · «dos revisiones empatadas PARAN» **y** «el empate revienta la VISTA entera» |
| 2 | el suelo de ceguera no mira | 1/15 · «un censo que no se ve NI A SÍ MISMO se declara ciego» |
| 3 | la revisión hereda `signatureUrl` y `acceptedAt` | 1/15 · «la revisión NO hereda la firma, ni la decisión, ni el cobro» |
| 4 | se quita `clausulasExcluidas` del reparto (simula una columna nueva sin clasificar) | 1/15 · «TODO campo de Quote está clasificado» — y **nombra el campo** |
| 5 | **se retira el cable**: `quoteAdmin` deja de importar `vistaDeRevisiones` | 4/25 de SCRUM-411 · el tope vuelve a descuadrar **y** el renglón dado la vuelta cae NOMBRANDO el módulo |

El rojo 4, literal — un guard que dice «falta algo» sin decir qué obliga a buscarlo a mano:

```
🔴 HAY 1 CAMPO(S) DE `Quote` QUE NADIE HA CLASIFICADO: clausulasExcluidas.
```

Y el rojo 5, que es el que protege el trabajo de este ticket dentro de seis meses:

```
🔴 `revision.ts` ha vuelto a ser INALCANZABLE: alguien ha quitado el cable de la fase B.
  `src/modules/system/quoteAdmin.ts` ya no importa `vistaDeRevisiones`, así que
  `GET /admin/quotes/:id` deja de llevar `revisiones` y `vigenteId`. La pantalla no puede
  contestar cuáles hay ni cuál está vigente, y lo hace SIN FALLAR: enseña la versión que
  pidió y calla las demás.
```

Un tope numérico solo habría dicho «9 en vez de 8». Este dice quién se cayó y qué deja de
funcionar — que es la diferencia entre un guard que se atiende y uno que se sube sin mirar.
