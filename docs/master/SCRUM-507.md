# SCRUM-507 · Distinguir lo que se inventa la IA de lo que escribe una persona

**Medido contra:** `origin/main` = `a5d678203e39c04772ee1f659842d13002de990c` · 2026-08-12T14:49:43+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-507-cantidad-supuesta` · `HEAD` = `a5d678203e39c04772ee1f659842d13002de990c` · 2026-08-12T14:49:21+02:00

## 1 · Que hace hoy `ai.service.ts:140`, y de donde saca la cantidad

Sale del modelo (`aiComplete` con `LINES_SCHEMA`), se extrae el array JSON del texto y **se mapea
campo a campo**. Las tres lineas que deciden:

```ts
qty:   Math.max(0.01, Number(l.qty)   || 1),
price: Math.max(0,    Number(l.price) || 0),
tax:   Math.min(1, Math.max(0, Number(l.tax) || 0)),
```

**No es solo `qty`.** Son TRES campos con invento silencioso, y el ticket solo nombraba uno:

| campo | si el modelo no lo devuelve legible | quien lo nota |
|---|---|---|
| `qty` | **1** — y ademas `0` cae a 1 (es *falsy*) mientras que `-4` cae a **0,01** | nadie |
| `price` | **0** | nadie |
| `tax` | **0** → la linea se propone **al 0 %** | nadie |

> 🔴 **El de `tax` es el que mas pesa**: un IVA ilegible sale como exento sin que nadie lo decida.
> Sigue habiendo un humano revisando antes del documento, pero **un 0 % no llama la atencion** — es
> un numero perfectamente plausible.

**CONTROL POSITIVO del instrumento:** el mismo barrido encuentra la funcion HERMANA
(`cantidadUtilizable`, la del albaran), que resuelve esto **aparte y con su criterio escrito** — y
cuyo comentario ya critica el mapeo del presupuesto por incoherente: *«con ese, un 0 acaba en 1
pero un -4 acaba en 0,01 — "0,01 unidades" de algo, impreso en un documento que firma el cliente»*.
Asi que el cero de «no hay mas sitios» no es un cero ciego: **hay dos, y el otro ya esta resuelto**.

## 2 · ¿Puede el profesional VER que se invento? — **NO. Y ese es el defecto de fondo**

`suggestQuoteLines` devolvia `{concept, qty, price, tax}` y **ningun campo de procedencia**; su unico
consumidor (`ai.routes.ts:60`) lo pasa tal cual. **Una cantidad propuesta por la IA era
indistinguible de una que tecleo el profesional.** Lo demas —0, 1, no proponer— es la eleccion; esto
era el defecto.

## 3 · LAS TRES OPCIONES, con lo medido debajo

| | que implica, medido |
|---|---|
| **a) 0, como el resto** | coherente con SCRUM-504 y deja la linea visiblemente vacia. **Ojo:** hoy `0` ya es el valor de `price` y `tax` ilegibles, asi que la incoherencia que arregla es solo la de `qty` |
| **b) 1, MARCANDO la linea** | la propuesta sigue siendo util. Necesita microcopy aprobada y sitio en la pantalla del presupuesto |
| **c) No proponer la linea** | la mas honesta, y la unica que **pierde informacion**: el concepto que la IA si entendio se tira con la cantidad que no |

**Recomendacion, en una linea:** **(b) para `qty` y `price`, y (c) para `tax`** — un IVA que no se
entiende no se propone, porque un 0 % plausible no se revisa.

## 4 · LO QUE SE HA CONSTRUIDO, porque sirve para las TRES

`suggestQuoteLines` **declara que tuvo que inventar**: cada linea vuelve con
`supuestos: ('qty'|'price'|'tax')[]`. **Los valores NO se tocan** — elegir entre a, b y c es
decision del fundador, y este cambio no la condiciona: las tres la necesitan.

* **CONTROL NEGATIVO, primero:** una propuesta con cantidades legibles sale **exactamente igual que
  hoy**, con `supuestos: []`. Marcar de mas se aprende a ignorar.
* **El positivo:** vacio, texto, `null`, `0`, negativo y `NaN` quedan declarados, **con el mismo
  valor de siempre**.
* **Rojo por el hecho:** hay test que cae **nombrando el campo** que se invento, y otro que cae si
  alguien CAMBIA el valor creyendo que este ticket lo decidia.

**Lo que falta y es de Luis:** elegir a/b/c y, si es (b), la microcopy del marcador — que iria con
marcador sin aprobar (regla 30).

**No se ha tocado:** ningun flag, el camino de emision, `prisma/schema.prisma`, el aviso de Bizum, ni
ninguna base. **Suite: 3558, 0 fail.**


---

# SCRUM-507 · SEGUNDA ENTREGA · la decision aplicada: (b) para qty y price, (c) para tax

**Medido contra:** `origin/main` = `1237240417ffa623c0def283d8c4603db4b02e96` · 2026-08-13T13:01:34+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-507-tax-no-se-propone`

## La decision del fundador, y por que cierra el ticket

* **`qty` y `price` → (b)**: se mantiene el valor y **la linea viene MARCADA como supuesta**.
* **`tax` → (c)**: **la linea NO se propone**.

El argumento que la cierra es la **asimetria de coste**: una linea que falta se anade a mano en diez
segundos; **una linea exenta que no debia serlo se descubre en una inspeccion**. Y un IVA a cero
*parece una decision que alguien tomo* — una cantidad rara se ve, un 0 % no.

## 1 · LA HERMANA SE REUTILIZA, no se copia

`cantidadUtilizable(bruto)` ya existia para el albaran:

```ts
const n = Number(bruto);
return Number.isFinite(n) && n > 0 ? n : 1;
```

**Ya resuelve la rareza que encontre**, y por eso no se escribe nada nuevo: con ella `0` y `-4` caen
**los dos a 1**, y desaparece el `0,01 unidades` que producia `Math.max(0.01, Number(x) || 1)` —
absurdo que el comentario de la propia hermana ya criticaba. **Una fuente para el mismo hecho**, que
es la leccion de SCRUM-504.

> Esto contesta el punto 3 del encargo **arreglandolo**, no declarandolo: la incoherencia entre `0`
> y `-4` muere al reutilizar la funcion que ya la tenia resuelta.

## 2 · `tax` ILEGIBLE: la linea no se propone, y NO desaparece en silencio

`suggestQuoteLines` pasa a devolver `{ lineas, descartadas }`. Cada descartada lleva **su concepto y
su motivo**, y el navegador **lo pinta**: desaparecer sin decirlo seria otro fallo mudo, que es lo
que llevamos el mes cazando.

⚠️ **El concepto no se tira**: viaja en la descartada, asi que el profesional sabe **que trabajo**
no se pudo proponer y puede escribirlo a mano.

## 3 · `qty` y `price` MARCADOS EN LA PANTALLA

El campo `supuestos` de la primera entrega llega hasta la lista de sugerencias y **cada linea con
algo inventado sale marcada**. Microcopy: **marcador sin aprobar** (regla 30).

## 4 · 🔴 EL TEST ENCONTRO QUE MI PRIMER FILTRO NO CERRABA EL CASO CARO

El descarte lo escribi asi, que es lo que pide el cuerpo:

```ts
const tax = Number(l?.tax);
if (!Number.isFinite(tax) || tax < 0 || tax > 1) { /* descartar */ }
```

**Y dejaba pasar justo el caso peor.** `Number(null)`, `Number('')`, `Number(false)` y `Number([])`
valen **0** — un cero perfectamente finito y perfectamente dentro de rango. Es decir: **un modelo
que directamente se calla el impuesto producia una linea EXENTA**, que es exactamente el motivo por
el que el fundador eligio (c). El caso que el ticket queria cerrar entraba por la puerta de al lado.

Lo caza el test con `tax: null` y `tax: ''`, y el filtro pasa a preguntar por el TIPO, no por lo que
`Number()` acepte convertir:

```ts
function ivaLegible(bruto: unknown): number | null {
  const enRango = (n: number) => (Number.isFinite(n) && n >= 0 && n <= 1 ? n : null);
  if (typeof bruto === 'number') return enRango(bruto);
  if (typeof bruto === 'string' && bruto.trim() !== '') return enRango(Number(bruto.trim()));
  return null;   // ausente, vacio o de otro tipo: no es un IVA, es un «no se sabe»
}
```

> Es **otra vez el guard atado a la FORMA y no al HECHO**, en miniatura y dentro de mi propio
> parche: `Number()` mide *«¿se puede convertir a numero?»*, y el hecho es *«¿dijo el modelo un
> IVA?»*. Ausente no es cero. El `21` sigue descartado aparte: el contrato es la **fraccion**
> (0,21), y colar un porcentaje multiplicaria el impuesto por cien.

## 5 · 🔴 Y EL ROJO ENCONTRO QUE MI TEST NO MEDIA EL CODIGO QUE CORRE

Al inyectar los rojos, **4 de 11 se quedaron verdes**. La causa era una sola y estaba en mi test:
el mapeo vivia DENTRO de `suggestQuoteLines`, detras de la llamada al modelo, asi que el test no
podia ejercitarlo — **lo reproducia en un doble local**. Romper el servicio no movia el doble.

> Es **el mismo defecto que persigue el ticket, cometido en el test**: dos sitios con el mismo
> criterio. Y es exactamente lo que avisa la casa — *«un guard atado a la FORMA y no al HECHO»*.
> Sin la tanda de rojos esto se habria mergeado con 12 tests en verde **que no median nada**.

**Arreglo:** el criterio sale a `src/modules/ai/domain/lineasSugeridas.ts` — codigo puro, sin
`prisma`, sin `config` y sin red — con `cantidadUtilizable`, `ivaLegible` y `mapearLineasSugeridas`.
`suggestQuoteLines` queda en `return mapearLineasSugeridas(parsed)`, y el test **importa de `dist/`
y ejercita lo que corre**. `cantidadUtilizable` se MUEVE (no se copia) al modulo nuevo, y el camino
del albaran la importa de alli: una fuente para el mismo hecho.

Hay ademas un test que cae si el servicio **vuelve a mapear por su cuenta** — el mecanismo que me
engano no se cierra con cuidado, se cierra con un rojo.

## 6 · 🔴 Y EL AVISO NO SE VEIA: LO PINTABA Y ME LO BORRABA YO CUATRO LINEAS DESPUES

Lo encontre releyendo la vista, no por un test. El aviso de descartadas se insertaba con
`results.appendChild(...)` y **cuatro lineas mas abajo** venia
`results.innerHTML = '<p>Sugerencias…</p>'`, que **se lo llevaba por delante**. El nodo se creaba,
se insertaba y desaparecia: en pantalla, nada.

> **Es el fallo mudo del ticket cometido al pintarlo.** Y el test seguia verde porque el texto
> ESTABA en el fuente: otra vez el guard atado a la FORMA (que el codigo exista) en vez de al
> HECHO (que se vea).

Arreglado moviendo el bloque DESPUES del `innerHTML` e insertando con
`insertAdjacentElement('afterbegin', …)` para que salga arriba del todo. Y **con su rojo**: un test
mide que la insercion va despues del ultimo `results.innerHTML =`, y cae con exactamente el bug que
cometi (`exit=1` comprobado, verde restaurado).

## 7 · Lo que movio mi entrega en los trinquetes de la casa (los cinco, arreglados)

| trinquete | que pasaba | que se hizo |
|---|---|---|
| **SCRUM-377** plural de programador | mi microcopy decia `linea(s)` (7 > tope 6) | **se reescribe el marcador**: fuera el contador y el `(s)` — lo que hace falta saber es QUE trabajo falta, y eso lo dicen los conceptos. Vuelve a 6, el tope NO se sube |
| **SCRUM-402** marcadores pintables | +2 sin declarar | `'aiQuoteAssistant.js': 2` **A CONCIENCIA** en el `CENSO`, con el motivo escrito: el mecanismo no existe sin texto |
| **SCRUM-402 R4b** | el fichero no estaba vigilado | lo cubre la misma entrada |
| **SCRUM-411** export huerfano | `ivaLegible` exportado y sin llamador | **se deja de exportar**. Es interno al criterio: la respuesta honesta es no exportarlo, no declararlo en una allowlist |
| **SCRUM-411** categorias suman | consecuencia del anterior | verde al quitar el export |

## Rojos: 14/14, por CODIGO DE SALIDA

Todos con `build=0` (un build roto deja `dist/` con el codigo bueno y el test no mediria nada; el
arnes lo marca aparte y no lo cuenta como rojo). Verde restaurado al terminar, `exit=0`.

| # | rojo inyectado | cae |
|---|---|---|
| 1 | ausente/vacio vuelve a valer CERO → linea EXENTA | 🔴 |
| 2 | desaparece el tope del rango → un `21` se cuela ×100 | 🔴 |
| 3 | la linea con IVA ilegible se propone al 0 % | 🔴 |
| 4 | la descartada pierde el concepto | 🔴 |
| 5 | vuelve el `0,01` (se deja de reutilizar la hermana) | 🔴 |
| 6 | se deja de declarar la cantidad supuesta | 🔴 |
| 7 | se deja de declarar el precio supuesto | 🔴 |
| 8 | **CONTROL NEGATIVO**: se marca una cantidad que la IA leyo BIEN | 🔴 |
| 9 | una linea mala se lleva por delante a las buenas | 🔴 |
| 10 | el servicio vuelve a mapear por su cuenta (la copia que me engano) | 🔴 |
| 11 | la ruta se come las descartadas | 🔴 |
| 12 | el navegador deja de LEER las descartadas | 🔴 |
| 13 | la marca por linea desaparece de la pantalla | 🔴 |
| 14 | la microcopy deja de ser marcador (regla 30) | 🔴 |

## Controles

* **NEGATIVO, primero:** una propuesta con todo legible sale **identica a hoy** — `supuestos: []`,
  `descartadas: []` y ninguna marca en pantalla.
* **Rojo por el hecho:** el test cae **nombrando la linea** cuya cantidad se invento, y cae tambien
  si una linea con IVA ilegible **vuelve a proponerse**.

**No se ha tocado:** ningun flag, el camino de emision, `prisma/schema.prisma`, el aviso de Bizum ni
ninguna base.

## Suite y hallazgo de OTRO carril (regla 9)

**Suite entera con `main` dentro (`origin/main` = `12372404`, «Already up to date»): 3614 tests,
3536 pass, 1 fail.** El unico fallo **no es mio y ya estaba en `main`**:

    tests/scrum409-fixtures-sin-merchant-demo.test.mjs
      → scrum508-los-cinco-dejan-fila.test.mjs:76

**Comprobado en un worktree limpio de `origin/main`: `exit=1`, el mismo y unico fallo.** No he
tocado ese fichero (`git diff origin/main` vacio).

Y la causa es **la trampa de autorreferencia (SCRUM-203)**: la linea 76 de ese test es un
**comentario** que dice *«7 y no 1: el guard de SCRUM-409 lee un `merchantId: 1` como el merchant
DEMO y salta»* — y el guard **casa con el comentario que explica la prohibicion**. El codigo hace
lo correcto (usa `merchantId: 7`); lo que salta es la explicacion de por que.

**Se reporta, no se arregla** (regla 9): es de la sesion de SCRUM-508. La forma conocida de
cerrarlo es leer el fichero **sin comentarios** (`soloEjecutable`), como ya hacen otros guards de
la casa.


---

# SCRUM-507 · TERCERA ENTREGA · los dos textos APROBADOS, sin marcador

**Medido contra:** `origin/main` = `9666e464049e6059cfa39aa7d53ce17abdc0fb12` · 2026-08-13T19:32:23+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-507-tax-no-se-propone`

El fundador firmo los dos textos. Se ponen literales, se quitan los dos marcadores y **el
trinquete de SCRUM-402 APRIETA**.

## Los dos textos, tal cual entran

**TEXTO 1** — `aiQuoteAssistant.js`, arriba del modal de sugerencias, solo si hubo descartadas:

    Esto no lo hemos añadido porque no sabíamos qué IVA ponerle: <conceptos>
    Añádelo tú si va en el presupuesto.

**TEXTO 2** — por linea, debajo de «Cantidad · Precio · IVA», solo en las lineas con algo supuesto:

    Esto lo hemos puesto nosotros: cantidad. Revísalo antes de enviar.
    Esto lo hemos puesto nosotros: precio. Revísalo antes de enviar.
    Esto lo hemos puesto nosotros: cantidad y precio. Revísalo antes de enviar.

## 🔴 EL BUG DE CONCORDANCIA NO SE ARREGLA: DEJA DE SER POSIBLE

Mi marcador decia «cantidad y precio **que no venia** y hemos supuesto» — sujeto plural, verbo
singular. Lo señale como una falta de concordancia; **el fundador vio el fallo de fondo**: la frase
DEPENDIA DEL NUMERO DE CAMPOS, y por eso podia no concordar.

En los textos aprobados el sujeto es **«esto»**, no la lista. La lista es un complemento detras de
los dos puntos, asi que la frase concuerda con uno, con dos y con los que hicieran falta. **No es
que el bug este corregido: es que ya no se puede escribir.** Un guard de la suite lo fija — el
texto se compone SIEMPRE con el mismo esqueleto, y las tres formas se comprueban una a una.

## El salto de linea del TEXTO 1 tiene que VERSE

El texto aprobado lleva `\n` («Añádelo tú si va en el presupuesto.» va en su propia linea). Un `\n`
dentro de un `textContent` **no se ve**: HTML colapsa el salto y la frase saldria pegada. Se anade
`white-space:pre-line` al parrafo, y hay un rojo que cae si desaparece — un texto aprobado que se
pinta de otra forma que la aprobada no es el texto aprobado.

⚠️ Se sigue usando `textContent` y NO `innerHTML` para este aviso: los conceptos vienen del
modelo, y son lo unico de esta pantalla que no ha escrito ni el producto ni el profesional.

## Tildes: comprobadas por codigo, no a ojo

Se me fueron dos en la tanda anterior. El guard exige los caracteres acentuados **por punto de
codigo** (`sabíamos`, `Añádelo`, `Revísalo`), asi que un `sabiamos` sin tilde cae en rojo. Se
comprueba ademas que el fichero sigue en UTF-8 sin BOM: una mojibake (`sabÃ­amos`) pasaria una
comparacion descuidada y llegaria asi a la pantalla.

## SCRUM-402: la entrada se BORRA, no baja a 0

`aiQuoteAssistant.js` sale del `CENSO`. Se borra en vez de escribir `0`, que es lo que dejaron
escrito SCRUM-424 y SCRUM-405 ahi mismo: `censoActual()` solo lista ficheros CON marcadores, asi
que un `0` seria una bajada permanente sin anotar. **Y salir del censo no saca de la vigilancia**,
que es lo que fija R4b.
