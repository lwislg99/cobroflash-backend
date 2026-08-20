# SCRUM-555 · punto 4 — el censo ya sabe decir «hay N marcados y he mirado M»

**Medido contra:** `origin/main` = `164d092dc8e955aa1b01ce254133a24553ce91d9` · 2026-08-21T09:20:00+01:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — mismo criterio R14.

**21-ago-2026** · **Carril:** B (landing) · **Gate:** sin gate, corre en `npm test`

**Alcance:** dos ficheros, los dos míos y ya existentes. **No se retira ni se reescribe ningún
texto** —ni «El ERP por WhatsApp para los oficios» ni ningún otro—, **ningún marcador, ningún
`hidden`**, y **no se toca la aprobación de los 37**. No se monta un tercer mecanismo: se extiende
el que ya hay.

---

## ⓪ PASO 0 · los puntos 1, 2 y 3 ya estaban en `main` — medido, no recordado

El encargo pedía comprobarlo antes de empezar. Comprobado con `git cat-file -e` contra
`origin/main`:

| fichero | ¿en `main`? |
|---|---|
| `scripts/_texto-fuera-del-censo.mjs` | ✔ |
| `tests/scrum555-lo-que-el-censo-no-ve.test.mjs` | ✔ |
| `scripts/_citar-fuera-del-censo.mjs` | ✔ |
| `docs/MICROCOPY_FUERA_DEL_ESQUEMA.md` | ✔ |
| `docs/master/SCRUM-555.md` · `docs/master/SCRUM-561.md` | ✔ |

- **Punto 1** — los 16 están **declarados uno a uno con motivo** en `FUERA_DEL_ESQUEMA`, y los tres
  textos de atributo en `TEXTOS_EN_ATRIBUTOS`. Se eligió **declarar**, no ampliar el extractor:
  ampliarlo obligaba a declarar dieciséis anclas nuevas y dejaba `main` en rojo.
- **Punto 2** — citados en `docs/MICROCOPY_FUERA_DEL_ESQUEMA.md` con identificador derivado y texto
  literal. **Re-verificado hoy: 16/16 con `===` y `Buffer.compare` contra el fichero.**
- **Punto 3** — el criterio del identificador (`sección[ámbito]/etiqueta#orden`) está escrito en el
  módulo y en el documento, no implícito en el código.

**Así que este trabajo es sólo el punto 4.**

## ① El hueco, medido

Lo que ya existía y lo que no:

- ✔ **SCRUM-557** puso `seccionesMarcadasSinDeclarar()`: una sección marcada que no está en
  `SECCIONES_BLOQUE_F` sale en rojo, y una declarada que no existe, también.
- 🔴 **Pero ese contador recorre `/<section…>/g`.** Un `data-microcopy` en un `<div>`, un `<p>` o un
  `<a>` **no lo ve nadie**: ni ese censo, ni el mío, ni el guard de publicación. Hoy los cuatro
  marcadores están en `<section>` y por eso no hay nada escondido — **pero eso es suerte, no
  diseño.**
- 🔴 **Y ningún sitio sabía decir el número.** Un rojo cuando algo falta no es lo mismo que poder
  contestar *«son cuatro y he decidido sobre cuatro»*. Sin el número, el día que sean cinco y se
  mire cuatro, el verde de todo lo demás sigue igual de verde. **Es exactamente lo que pasó cuando
  el censo extraía 17 unidades y los textos eran 37.**

## ② Lo entregado

`elementosConMarcador()` — **cualquier etiqueta**, no sólo `<section>` — más `repartoDeMarcadores()`
y `decirElReparto()`.

```
elementos con marcador de propuesta: 4  ·  con decisión escrita: 4
   de los decididos · censados: 2 (heroe-f4, gremios)
                    · fuera CON MOTIVO: 2 (comparativa, contacto-publico)
   marcadores fuera de <section>: 0
```

🟢 **«Mirado» significa DECIDIDO POR ESCRITO.** Una sección declarada `censada:false` **con su
motivo** está mirada: alguien decidió. Lo que no puede existir es un elemento marcado sobre el que
nadie haya decidido nada. Por eso M cuenta los decididos, no sólo los censados — si contara sólo
los censados, el suelo estaría rojo hoy por dos decisiones correctas y acabaría desactivado.

⚠️ **El patrón tolera un `>` dentro de un valor de atributo.** Con `[^>]*` una etiqueta con `>` en
un atributo se corta por la mitad y el marcador que venga detrás se pierde — el defecto que censó
SCRUM-553, aquí en su versión cara: perder un marcador es perder una sección entera de vigilancia.
Hay control que lo prueba, con su control negativo al lado.

## ③ Los 16, re-verificados hoy — 16/16

| identificador derivado | texto literal | naturaleza | afirma | doc |
|---|---|---|---|---|
| `heroe-f4/span#1` | «El ERP por WhatsApp para los oficios» | ROTULO | **IDENTIDAD** | F4-1 |
| `heroe-f4/a#1` | «Probar la demo» | ETIQUETA_DE_ACCION | — | F4-4 |
| `heroe-f4/a#2` | «Empieza gratis» | ETIQUETA_DE_ACCION | CONDICION | F4-5 |
| `gremios/span#1` | «Tu oficio» | ROTULO | — | F6-1 |
| `gremios[fontaneria]/a#1` | «Empezar gratis» | ETIQUETA_DE_ACCION | CONDICION | F6-6 |
| `gremios[fontaneria]/span#1` | «→» | GLIFO | — | F6-6 |
| `gremios[electricidad]/a#1` · `…/span#1` | «Empezar gratis» · «→» | | | F6-6 |
| `gremios[reformas]/a#1` · `…/span#1` | «Empezar gratis» · «→» | | | F6-6 |
| `gremios[climatizacion]/a#1` · `…/span#1` | «Empezar gratis» · «→» | | | F6-6 |
| `gremios[cerrajeria]/a#1` · `…/span#1` | «Empezar gratis» · «→» | | | F6-6 |
| `gremios[pintura]/a#1` · `…/span#1` | «Empezar gratis» · «→» | | | F6-6 |

**Y «Tu oficio» sí aparece en una extracción** — el motivo del ticket decía que no. Es
`gremios/span#1`, está citado desde SCRUM-561 y **el fundador lo aprobó el 20-ago** (F6-1, registro
de SCRUM-563). Lo que era cierto entonces dejó de serlo ese día.

🔴 **«El ERP por WhatsApp para los oficios» sigue siendo el caso distinto**, y sigue igual: es la
única de las 16 con `IDENTIDAD` —declara una **categoría** de producto, no una función—, **no está
aprobada** (declarada fuera en `NO_APROBADAS`, SCRUM-563) y **no la ancla nadie**. Este ticket no
decide sobre ella: la deja donde se la pueda ver.

## ④ Verificación

**SUELO** — si el reparto devuelve cero elementos con marcador, falla declarándose ciego: con cero,
`N === M` por vacío y el suelo diría que todo está mirado sin haber mirado nada.

**CONTROL** — el buscador ve un marcador con un `>` dentro de un atributo, y **no inventa ninguno**
donde no los hay.

**ROJO POR EL MECANISMO** — sobre `283ee5b68c99d5773701b76356ced2681bd2e8c9`, con el fichero
verificado idéntico al **blob** antes de empezar:

| inyección | ¿cae? | qué dice el censo |
|---|---|---|
| marcador en un `<div>` (lo que el contador de `<section>` no ve) | 🔴 sí | `4 → 5 marcados · 4 con decisión escrita` |
| marcador en un `<p>` de copy publicado | 🔴 sí | `5 marcados · 4 con decisión escrita` |
| quitarle el marcador a `#comparativa` | 🔴 sí | `3 marcados · 3` + nombra el declarado que se quedó al vacío |

Las tres veces la landing volvió **byte a byte contra el blob** y `git status` sale **limpio**.
Nunca se usó `git checkout --`. **CR=0** con `Buffer` antes de commitear.

**Tanda completa:** **3924 tests · 3847 pass · 0 fail · 77 skipped**.

⚠️ **La autoprueba lleva su propio aviso**: comprueba que el contador de `<section>` de S1 **no** ve
el marcador del `<div>` — que es la razón de que este suelo exista. Si algún día eso cae, **es
buena noticia**: alguien habrá extendido el censo de S1, y entonces se relaja este trinquete y se
dice. No se tapa.

## ⑤ De camino

🟠 **Tercera vez** que el censo de SCRUM-553 cuenta como extractor un **HTML literal** escrito
dentro de una línea con `.replace()`. **No se ha tocado su tope**: el literal va a su constante con
el motivo al lado. Es de S1 y ya está reportado dos veces. **El heurístico mira el argumento de
reemplazo igual que el de búsqueda.**

## ⑥ Lo que NO se ha hecho

- ⛔ **No se amplía el extractor a todo el marcado.** Lista declarada con motivo, no barrido.
- ⛔ **No se marca más HTML.** Un mecanismo que exige marcar el copy ya aprobado se vuelve ruido y
  acaba desactivado (misma prohibición que SCRUM-549).
- ⛔ **No se retira ni se reescribe ningún texto** (regla 30), ni se retira ningún marcador ni
  `hidden`.
- ⛔ **No se toca `scripts/censo-anclas-bloque-f.mjs`**: el suelo vive en mi módulo y **lee** el
  alcance declarado de S1, que sigue siendo la única fuente de qué está dentro y qué fuera.

## ⑦ Nota sobre el encargo

El texto llegó **cortado**: el punto 3 aparece truncado a media frase («No los numeras tú y yo es;
una clase no») y el bloque de prohibiciones termina en un «⛔» sin contenido. He trabajado sobre lo
legible, que cubre los puntos 1, 2 y 4 sin ambigüedad. **Si el punto 3 pedía algo más que el
criterio escrito del identificador, no me ha llegado.**
