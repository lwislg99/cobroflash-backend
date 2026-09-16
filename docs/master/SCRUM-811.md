# SCRUM-811 · El foco que nadie miraba: 105 de 114, y un solo culpable

**Fecha:** 7-sep-2026 · **Carril:** producto · accesibilidad — **MEDICIÓN** · **Gate:** sin gate — navegador, fuera de `npm test`
**Medido contra:** `origin/main` = `44562c332d1aed2c4ad4c7dfeaf71fd7bd59ce21` · 2026-09-07T03:57:21+01:00
**Tanda:** 5800 tests, 5698 pass, 0 fail, 102 skipped (salida 0) — corrida DESPUÉS de mezclar `main`, que trajo SCRUM-716 ya mergeado

> 🛑 **Esto MIDE. La decisión es del fundador.** No se ha tocado una línea de CSS, no se ha
> construido ningún guard y no se ha tocado ningún objetivo táctil.

## 0 · Obligación 0 · No estaba hecho

`ls-remote` completo (**539 refs**): ninguna rama de 811 ni de foco. No existe `docs/master/SCRUM-811.md`,
ni script de foco en `scripts/`, ni entrada en `package.json`. Sí existe
`scrum-368-anillo-foco-primario-rebasada`, **mergeada y con 0 commits vivos**: puso el anillo en
`.btn-primary` en agosto y su entrada está en `main`. No cubre esto.

## 1 · 🔴 La sonda, ANTES de ninguna cifra

Otra sesión midió esto con `.focus()` y declaró que su lectura no valía. Tenía razón:
**`:focus-visible` es una heurística del navegador sobre CÓMO llegó el foco**, y un foco
programático no la dispara igual. Aquí se pulsa **Tab** con `page.keyboard`, que produce eventos de
confianza.

La sonda son dos botones idénticos en una página servida con el CSS real: uno normal, y otro con el
anillo apagado **en línea** (un `style=` gana a la hoja, medido en SCRUM-764). Y se mide por **dos
caminos que tienen que coincidir**: estilo calculado (con `::before`/`::after`) y **píxeles**
(fotografía de la caja con margen, comparada byte a byte).

| | alcanzable | `:focus-visible` | (a) cambia el estilo | (b) cambian los píxeles |
|---|---|---|---|---|
| ✅ botón normal | sí (1 Tab) | `true` | **sí** | **sí** |
| 🔴 botón con el anillo apagado | sí (1 Tab) | `true` | **no** | **no** |

**Los dos métodos coinciden en los dos casos: la sonda distingue.** Y va montada **dentro de cada
página del censo**, no sólo en el laboratorio: si en una vista no distinguiera sus dos casos, esa
vista no se cuenta.

### 🔴 Y la sonda ya enseña por qué un censo «fácil» habría mentido

`:focus-visible` da **`true` también en el botón sin anillo**. Un censo que preguntara por esa
pseudo-clase habría dado **100 % de cumplimiento** sobre una pantalla con el anillo apagado. Lo que
se mide es si **cambia algo que se ve**, no si la regla aplica.

## 2 · El censo · **105 de 114**

Población: los interactivos **visibles** (`INTERACTIVOS` de `_medidor-de-toque.mjs`, el mismo
selector que usa el guard táctil) de las vistas que el banco monta, incluida Clientes por su helper.

| | de 114 |
|---|---|
| **CON anillo al tabular** | **105** |
| **SIN anillo** | **9** |
| **INALCANZABLES por Tab** | **0** |
| *(aparte)* dentro de un `<details>` cerrado, fuera de población | 7 |

**Por superficie**, sólo las que tienen algo que decir:

| vista | con / total | sin |
|---|---|---|
| `renderQuotesView` | 19 / 27 | **8** |
| `renderHomeView` | 3 / 4 | **1** |
| las otras 16 medidas | completo | 0 |

## 3 · ✅ El suelo · lo que NO se pudo medir (8 vistas), declarado

Una vista que no se pudo montar **no es una vista sin defectos**:

| vista | motivo |
|---|---|
| `renderCustomer360View`, `renderInvoiceDetailView`, `renderParteDetailView` | sólo **2 nodos** |
| `renderPlansView` | sólo 5 nodos |
| `renderLibroRegistroView` | sólo 9 nodos |
| `renderAlbaranesView`, `renderQuoteDetailView` | sólo 11 nodos |
| `renderTeamView` | sólo 14 nodos |

De las **26** vistas que publica el banco se midieron **18**. El «105 de 114» habla de esas 18.

## 4 · 🔴 Obligación 3 · SÍ hay patrón, y es UNA decisión de arquitectura

Los nueve tienen **la misma causa**. El anillo se declara así:

```css
:focus-visible { outline: none; box-shadow: var(--ring); }   /* línea 132 · especificidad (0,1,0) */
```

**Apaga el `outline` y pone el anillo SÓLO en `box-shadow`.** A partir de ahí, cualquier regla que
fije `box-shadow` sobre ese elemento se lo come, y no queda ningún otro canal:

| los que pierden el anillo | la regla que gana | por qué gana |
|---|---|---|
| **8 casillas** del editor de presupuesto | `.field input[type="checkbox"] { … box-shadow: none }` — línea **624** | (0,2,1) **>** (0,1,0) |
| **1** `.home-action.home-cta` | `.home-cta { box-shadow: 0 4px 14px … }` — línea **982** | misma especificidad, **va después** |

Medido en los dos: `box-shadow` sin foco y con foco son **idénticos**.

> **Para el fundador:** no son nueve defectos sueltos. Es **una línea de CSS** (la 132) que renuncia
> al `outline`, y dos sitios donde eso choca. Si el anillo viajara también por `outline`, los nueve
> se arreglarían sin tocar ninguno de los dos componentes.

## 5 · ⚠️ Tres veces se equivocó mi instrumento, y las tres se dicen

Porque la cifra sólo vale lo que valga la sonda:

1. **«6 inalcanzables por teclado» era FALSO.** Eran seis casillas dentro del `<details>`
   «Columnas», **plegado**. Comprobado abriéndolo: **5 de 11 con él cerrado, 11 de 11 con él
   abierto**. No es un defecto, es una sección plegada. Se sacaron de la población y se cuentan
   aparte.
2. **Leía el estilo a los 0 ms del Tab**, con la transición en marcha: una pestaña daba
   `rgba(0,0,0,0) 0px 0px 0px 0px` —un anillo transparente de tamaño cero— y el censo lo contaba
   como «cambia». Se espera a que asiente. Con eso, `.customers-tab` pasó de «sin anillo» a
   **19/19 con anillo**, y aparecieron las 8 casillas que sí lo pierden.
3. **«Cambia» no es «se ve».** Ahora se exige que el estado con foco tenga sombra **no
   transparente y de tamaño no nulo**, o un `outline` real.

Antes de esas tres correcciones la cifra era «114 de 121 y 6 inalcanzables». **Era ruido.**

## 6 · Obligación 4 · Recomendación (NO construida)

**Sí, es exigible en cada PR — pero no todavía, y no como está.** En este orden:

1. **Primero la decisión de la línea 132**, que es de una tarde: si el anillo viaja también por
   `outline` (con `outline-offset`), deja de poder comérselo cualquier `box-shadow` y los **9 de 9**
   caen de golpe. Es la palanca; todo lo demás es parchear.
2. **Después el guard**, y barato porque el instrumento ya existe: es el censo de arriba con un
   suelo. Coste medido: **~90 s** de navegador para 18 vistas — el mismo orden que
   `guard:objetivo-tactil`, que ya corre.
3. **Entra en verde, no en rojo.** Hoy pondría `main` en rojo por 9 casos, y un guard que nace
   rojo se desactiva. Se arregla la 132 primero y el guard entra cuando el número sea 0.

**Lo que NO recomiendo:** exigir las seis casillas de AB6 de golpe. Los targets tienen 75 casos
abiertos (SCRUM-786, en tu mesa) y el foco tendría 9: meter las dos a la vez deja el tablero en
rojo permanente, que es la forma más rápida de que nadie mire ninguna.

**Y una advertencia sobre el alcance:** este censo cubre **18 de 26** vistas. Las 8 que faltan no
están limpias — están **sin medir**, y necesitan datos de muestra que hoy el banco no da.

## 7 · No tocado

Ni una línea de CSS · ni un token · `.btn-sm` ni ningún objetivo táctil (SCRUM-786) · ningún guard
construido · ningún literal nuevo · ningún árbol ajeno. Los tres scripts de medición viven en el
scratchpad: esta entrega es **la medición y el documento**.
