# SCRUM-507 · Distinguir lo que se inventa la IA de lo que escribe una persona

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
