# SCRUM-555 · El censo miraba 19 de 35 nodos, y su verde no lo decía

**Medido contra:** `origin/main` = `bb721a852110117d0af17d6c8e07ba59488ead6b` · 2026-08-20T17:10:00+01:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — mismo criterio R14 que
> las demás entradas.

**20-ago-2026** · **Carril:** B (landing) · **Gate:** sin gate, corre en `npm test`

**Alcance:** dos ficheros NUEVOS. **No se ha tocado `scripts/censo-anclas-bloque-f.mjs`** (S1
estaba dentro por SCRUM-553/557), **ni `package.json`**, ni el marcado, ni el copy, ni un solo
`hidden`, `data-microcopy` o `data-propuesta`. No se ha aprobado ni redactado nada.

---

## ⓪ Antes de nada: el rojo que traía yo era mi árbol, no el repo

Reporté un rojo en `contacto-publico/h2#1`. Tras `git fetch origin` + `git merge origin/main`, la
tanda da **3799 · 3722 pass · 0 fail · 77 skipped** y ese rojo **no aparece** (0 ocurrencias) —
exactamente la referencia de S1. **Lo cerró SCRUM-557.** El rojo era mi copia vieja.

---

## ① El defecto, en una línea

Un censo en verde no dice «no hay nada»: dice **«no hay nada donde miré»**. El censo de anclas
del bloque F extrae sus unidades con `<(h1|h2|h3|p|li)>`, y en sus dos secciones eso deja fuera
casi la mitad del texto que un visitante lee.

Medido el 20-ago-2026 sobre `public/index.html`, con un parser de pila de etiquetas (no con el
mismo esquema que se quiere auditar, que es lo que haría que el instrumento heredara el defecto):

| sección | unidades del esquema | nodos de texto | cubiertos | **fuera** |
|---|---|---|---|---|
| `#heroe-f4` | 3 | 8 | 5 | **3** |
| `#gremios` | 14 | 27 | 14 | **13** |
| | **17** | **35** | **19** | **16** |

Y en `#contacto-publico`, tres textos más que **no son elementos**: viven en atributos
(`data-wa-etiqueta`, `data-wa-texto`, `data-email-etiqueta`) y los pinta un script. **Ningún censo
de etiquetas puede verlos, por bien escrito que esté.**

### Lo que se escapa, con nombre

```
[heroe-f4] <span> "El ERP por WhatsApp para los oficios"
[heroe-f4] <a>    "Probar la demo"      [heroe-f4] <a> "Empieza gratis"
[gremios]  <span> "Tu oficio"           [gremios]  <a> "Empezar gratis"  ×6
[gremios]  <span> "→"  ×6
```

⚠️ **«El ERP por WhatsApp para los oficios» no es decorativo:** es una afirmación sobre qué **es**
el producto, vive en un `<span>`, y hoy **no la ancla nadie**. Queda anotada, que es lo que este
ticket puede hacer sin tocar copy sin aprobar.

## ② Lo entregado: no un extractor más grande, una lista declarada y un recuento exacto

**Ampliar el extractor obligaría a declarar dieciséis anclas nuevas y dejaría `main` en rojo** —
justo lo que SCRUM-557 vino a quitar. Se hace lo otro: `scripts/_texto-fuera-del-censo.mjs`
declara la lista **con su motivo, uno a uno, y con la cuenta EXACTA**.

**Exacta y no «al menos dieciséis»:** un umbral con holgura se queda verde el día que se pierde
uno. Es la enfermedad que SCRUM-559 cura en los guards del dashboard — **otra superficie y otros
ficheros, así que no se duplica nada** (ver ⑤).

`tests/scrum555-lo-que-el-censo-no-ve.test.mjs`, 11 pruebas. **Rojo por el mecanismo**, sobre
código ya commiteado (`79842e4e`), devolviendo el fichero byte a byte con `Buffer.compare` — nunca
con `git checkout --`:

| inyección | ¿cae? | qué prueba cae |
|---|---|---|
| quitar una fila de `#comparativa` | 🔴 sí | las cifras acopladas |
| quitar una herramienta de `#todo` | 🔴 sí | las cifras acopladas |
| cambiar el texto de `data-wa-etiqueta` | 🔴 sí | los textos en atributos |
| colar un `<span>` nuevo en `#gremios` | 🔴 sí | el reparto exacto · la lista declarada · la autoprueba |
| meter «cobras» donde no se promete nada | 🔴 sí | la cobertura del detector |

Control positivo antes de empezar: **sin inyectar, verde**. Y al terminar, `git diff` de la
landing **vacío**.

## ③ Punto 1 · el detector léxico NO falla en las dos direcciones

Contrastado contra las dos verdades que ya existen en el repo — `ANCLAS_F` (lo declarado
`SIN_CAPACIDAD` no promete) y la columna «Con YaQu» de la comparativa (que **es** la columna de la
promesa, lo dice su cabecera):

| | población | resultado |
|---|---|---|
| frases que **sí** prometen | 15 | el detector ve **10** — se le escapan **5** |
| frases que **no** prometen | 20 | no salta **ni una** — **0 falsos positivos** |

**Falla en una sola dirección, y una de cada tres.** La premisa de «las dos direcciones» no se
sostiene medida.

Las cinco que se escapan: «Del presupuesto **al cobro**…» · «El recordatorio **sale solo**» · «Cada
movimiento **queda en su ficha**» · «**Lo que entró menos lo que salió**» · «**Salen de tu
catálogo** según escribes».

🔴 **Y por eso NO se amplía el vocabulario.** No comparten palabra: comparten que prometen. Añadir
cinco patrones para estas cinco frases sería enseñarle al detector **las frases de hoy** y quedarse
con la sensación de que ya mira. Lo que sostiene el censo es el **registro** —cada unidad declarada
a mano—; el léxico es una red con agujeros, y ahora los agujeros están **medidos y con trinquete**
para que no crezcan.

> ⚠️ **Dos deslices míos, no del detector**, corregidos antes de concluir: el ancla es de la FILA y
> la promesa vive sólo en la celda «Con YaQu» (contar las tres celdas daba 16 falsos negativos); y
> la celda hay que buscarla **dentro** de su fila, porque la última `cmp-cell` anterior a una línea
> de situación es la de la fila de arriba (daba 9). El número bueno es **4** en la comparativa.

## ④ Punto 1 (segunda mitad) · qué censo cubre qué, por escrito

| sección | censo | unidad |
|---|---|---|
| `#heroe-f4`, `#gremios` | `scripts/censo-anclas-bloque-f.mjs` | **frase** |
| `#comparativa` | `tests/scrum332-comparativa-anclas.test.mjs` | **fila** (`data-fila`) |
| `#contacto-publico` | ninguno (decisión de SCRUM-557) | — |

🟢 **`#comparativa` no es un hueco.** El motivo que hoy lleva en `SECCIONES_BLOQUE_F` —«sus 20
unidades nunca han pasado por el censo»— **se lee como un hueco**, y medido no lo es: sus seis
filas las vigila F5 una a una, en verde, y `scripts/guard-a11y-comparativa.mjs:183` las cuenta.
**No la mira ESE censo ≠ no la mira nadie.** Queda escrito en `CENSOS_DEL_BLOQUE_F`, con una
prueba que cae si S1 añade una sección y nadie dice qué censo la cubre.

**Propuesta para S1 (no aplicada, es su fichero):** cambiar ese motivo por «la cubre el censo de
F5, fila a fila».

## ⑤ Punto 4 · el suelo N ≠ M **no** lo cubre SCRUM-559

Comprobado antes de construir, como pedía el encargo. SCRUM-559 (S2) arregla **dos guards del
dashboard** (`tests/_banco-vistas.mjs`, `dashboard-colision-declaraciones`,
`scrum417-descargar-datos-carga`) y **midió** el suelo del censo del bloque F, concluyendo *«No se
toca su suelo: ya distingue la pérdida parcial»* — con esta tabla:

| caso | ciego | unidades |
|---|---|---|
| intacto | false | 17 |
| sin 1 de 2 secciones | false | **14** ← lo canta |

**Cierto, y en otro eje.** Eso mide la pérdida de una **sección entera**. Lo de aquí es la pérdida
**dentro** de la sección: las 17 unidades de la fila «intacto» cubren 19 de 35 nodos, y ninguna de
las dos filas de esa tabla se mueve por ello. **Misma enfermedad, superficie distinta, ficheros
distintos. No se duplica.**

## ⑥ Punto 3 · cifras acopladas: son CINCO, no una

Barrido del texto visible entero (40 pares «número + sustantivo», 39 únicos). Una lista de una
entrada no es un censo:

| frase de la copia | dice | hay | conjunto | ¿cuadra? | ¿quién la cuenta? |
|---|---|---|---|---|---|
| «Seis situaciones» | 6 | 6 | `.cmp-row` en `#comparativa` | sí | el suelo de a11y, **por accidente** |
| «Tres pasos. Cero fricción.» | 3 | 3 | `.prod` en `#como` | sí | 🔴 **nadie** |
| «Seis herramientas. Una sola app.» | 6 | 6 | `.prod` en `#todo` | sí | 🔴 **nadie** |
| «Un solo plan. Todo incluido.» | 1 | 1 | `.price-card` en `#precios` | sí | 🔴 **nadie** |
| la demo se numera 1…5 | 5 | 5 | `.try-step` en `#probar` | sí | 🔴 **nadie** |

**Las cinco cuadran hoy** y **cuatro están en copy PUBLICADO** (`#como`, `#todo`, `#precios`,
`#probar` no llevan `hidden`) — al revés que la única vigilada, que está en una sección oculta.
Las cinco quedan con trinquete.

> ⚠️ Adivinar el selector daba **cero** donde hay tres: `.step` no existe, el conjunto real es
> `.prod`. Un cero por selector equivocado se lee igual que un desajuste real, y por eso el test
> distingue los dos casos con un suelo antes de comparar.

## ⑦ Punto 2 · el documento de aprobación ya alcanzaba lo que el censo no ve

Comparados **por bytes** (`===` y `Buffer.compare`, nunca `includes()`) los textos de
`docs/MICROCOPY_BLOQUE_F_PARA_APROBAR.md` con las unidades del esquema:

- documento: **51** textos · esquema `h1|h2|h3|p|li`: **38** unidades
- **26** los recoge el documento y el esquema **no puede verlos** (los 16 de arriba, los 3 de
  atributos, y los rótulos y celdas de `#comparativa`)
- **13** los ve el esquema y no están en el documento — y los 13 son **la misma prosa con la
  etiqueta de columna pegada delante** («Con YaQu Lo aceptó con su firma…»). **Es el defecto de
  SCRUM-553, que S1 ya ha entregado. No lo toco.**

🟢 **Conclusión: al documento no le falta ningún texto.** El que tiene el punto ciego es el censo,
y ahora está escrito con nombre y cuenta.

## ⑧ Lo que apareció de camino y no se ha arreglado por mi cuenta

🟠 **El censo de SCRUM-553 cuenta como extractor un HTML literal.** Mi autoprueba escribía
`html.replace(ANCLA, ANCLA + '<span>…</span>')`, y el censo lo contó como «etiqueta con el `>`
pegado» (30 sobre un tope de 29). **No lo es**: es dato de prueba, sin patrón ninguno; lo que lo
dispara es que la línea lleve un `.replace(`. **El tope de S1 no se ha tocado** — el literal va
ahora en su propia constante, con el motivo escrito al lado. **Para S1: el heurístico mira el
argumento de reemplazo igual que el de búsqueda.**

## ⑨ Evidencias

- Tanda completa tras fusionar `origin/main` (553 y 559 incluidos): **3820 tests · 3743 pass ·
  0 fail · 77 skipped**
- `tests/scrum555-lo-que-el-censo-no-ve.test.mjs`: **11/11**, incluida la autoprueba
- Rojo por el mecanismo: **5 de 5** inyecciones caen y nombran la prueba correcta; landing
  devuelta byte a byte las cinco veces (`git diff` vacío)

## ⑩ Lo que NO se ha hecho, y por qué

- ⛔ **No se amplía el extractor** a `span|a|button`: dieciséis anclas nuevas y `main` en rojo.
- ⛔ **No se amplía el vocabulario del detector**: sería ajustarlo a las cinco frases de hoy (③).
- ⛔ **No se toca `scripts/censo-anclas-bloque-f.mjs`**: S1 estaba dentro. La propuesta de ④ se
  deja escrita para quien lo lleve.
- ⛔ **No se toca `package.json`** — luego este fichero **no tiene comando propio**: corre dentro
  de `npm test` por el glob de `tests/*.test.mjs`.
- ⛔ **Nada aprobado, nada redactado, ningún marcador retirado, ningún `hidden` movido.**
