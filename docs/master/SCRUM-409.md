# SCRUM-409 · Los fixtures salen del merchant demo

**Fecha:** 9-ago-2026 · **Carril:** guards · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `64c19884a97d240544a203df81a67b33744c1724` · 2026-08-09T20:34:56+02:00

## El defecto

El merchant **1 es el DEMO**, y el producto se comporta distinto con él: `whatsappPolicy` corta por
`DEMO_MERCHANT_ID`, el PDF lleva marca de agua, la pasarela se desvía. Un fixture con ese id
**desactiva comprobaciones sin tocar ningún guard**, y el test sigue verde midiendo otra cosa.

## El censo, derivado

| | |
|---|---|
| ficheros de test con `merchantId: 1` | **24** (57 ocurrencias) |
| de ellos, que PRUEBAN el demo (derivado de importar `isDemoMerchant` / `DEMO_MERCHANT_ID` / `DEMO_SAFE_NUMBERS`) | **2** |
| cambiados a un id inventado | **22** (55 ocurrencias) |

⚠️ El encargo hablaba de 25 ficheros y «11 mencionan el demo». Medido: **10** contienen la palabra
«demo» y `merchantId: 1`, pero solo **2** importan su mecanismo. Los otros 8 la mencionan en prosa
— por eso la lista se deriva de los imports y no de la palabra.

⚠️ **SCRUM-407 ya estaba arreglado** por otra sesión: `scrum399-hambre-del-lote` usa hoy
`merchantId: 7`.

## 🔴 Los tres tests que rompieron — y NINGUNO era el hallazgo que buscábamos

El encargo decía: si cambiar el merchant rompe un test, ese test pasaba por la rama demo del
producto. **Rompieron tres, y los tres eran artefactos de mi sustitución.** Lo digo entero porque
un falso hallazgo aquí habría mandado a alguien a buscar un defecto que no existe:

| test | por qué rompió | veredicto |
|---|---|---|
| `scrum207-conciliacion` · «los seis cubos» | su fila 6 **ES el cubo del demo** (`huecoDemo`), y no importa nada del demo: clasifica con un mapa de merchants | **mi error**: la derivación por import no lo veía. Devuelto al id 1 y **marcado** |
| `scrum302-presupuesto-y-fotos` · multi-tenant | el merchant entra por `handle({ merchantId })`, y la **espera** seguía en 1 | **mi error**: sustitución parcial |
| `scrum312-importador-clientes` · duplicado | el merchant es un **argumento posicional** `importarClientes(1, …)`, invisible para `merchantId: 1` | **mi error**: mismo motivo |

**Cero tests pasaban por la rama demo.** El hallazgo real es sobre el método: el id del demo viaja
en más formas que `merchantId: 1`, y una sustitución mecánica desincroniza el test sin revelar
nada del producto.

## El guard

Un fixture nuevo no puede usar el id del demo, **salvo** en los ficheros derivados como pruebas de
ese comportamiento, o en una línea **marcada a la vista**:

    merchantId: 1,  // MERCHANT DEMO A PROPOSITO (SCRUM-409): <por qué>

Dos señales y no una, **porque una sola falló**: la derivación por import no veía el caso de
`scrum207`. La marca no es una allowlist muda: va pegada al sitio y dice por qué.

* **Suelo:** menos de 100 ficheros de test → falla. Y un control positivo sintético comprueba que
  el detector **ve** un `merchantId: 1` y **no** se deja engañar por uno en un comentario.
* **Se excluye a sí mismo**: nombra `DEMO_MERCHANT_ID` para poder derivar, así que se
  auto-eximiría — la trampa de auto-referencia de siempre.
* **Rojo verificado:** un fixture nuevo con el demo cae nombrando
  `scrum343-cabecera-gastos-unica.test.mjs:2` con su línea.

## Lo que NO cubre

* **Solo ve `merchantId: 1`.** Un merchant demo pasado como argumento posicional o por otra
  variable no lo detecta — es justo lo que me rompió `scrum312`, y queda como hueco declarado.
* No mira `tests/*.ts` (no hay) ni fixtures fuera de `tests/`.
