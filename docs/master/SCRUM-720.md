# SCRUM-720 · la pantalla del parte no tenía UNA SOLA regla de CSS

**Medido contra:** `origin/main` = `d9f60f7e89cc600e4d518af50ad2a977ed1876ba` · 2026-09-04T14:10:00+02:00

---

## 0 · PASO 0 · el diagnóstico, y era el SEGUNDO de los tres

**La hoja SÍ se carga.** El índice la trae en `index.html:10-11` (`tokens.css` y `css/styles.css`),
la app es un SPA de un solo índice, y en la captura se ve aplicada: **la tipografía Inter y los
colores `--muted`/`--ink` de las etiquetas están puestos**. No es «no se carga».

**El defecto es que las clases no existen.** Medido, enumerado:

| vista | clases que pinta | existen en la hoja | **no existen** |
|---|---|---|---|
| **el parte** | 4 | **0** | 🔴 `parte-bloque`, `parte-tipo`, `parte-anadir`, `parte-quitar-linea` |
| Trabajos (sí se ve) | 15 | 13 | `job-actions`, `job-cierre` |
| albarán (sí se ve) | 12 | 11 | `alb-status` |

**Cero de cuatro.** Y encima la hoja sólo declara `button { font-family: inherit; cursor: pointer }`
—sin apariencia—, así que **todo botón sin clase sale como el nativo del navegador**. La pantalla
del parte pinta **tres botones sin clase** (`[data-parte-firmar]`, `[data-dictado-ordenar]`,
`[data-propuesta-confirmar]`) más dos con clase inexistente. Eso es exactamente lo que se vio en
producción.

> ⚠️ **Un matiz sobre lo reportado:** en el papel medido, «Firmar aquí mismo» sale como **botón
> nativo**, no como enlace azul subrayado — la hoja neutraliza los enlaces (`a { color: inherit;
> text-decoration: none }`) y esa pantalla no pinta ningún `<a>`. Lo digo por si el enlace azul
> venía de otra vista, porque el arreglo es el mismo pero la coordenada no.

---

## 1 · El arreglo: **la hoja, y sólo la hoja**

147 líneas en `public/dashboard/css/styles.css`. **Ni una línea en el JS** — la sesión 4 está
firmando los rótulos en ese fichero y chocaríamos por un `class=`.

Por eso se estiliza por `data-*` donde el marcado no lleva clase: **no es un atajo**, son los mismos
ganchos que ya usan los tests, y son estables.

**No se estrena vocabulario.** Se reutiliza el que existe: la tarjeta copia `.customers-card`, el
botón principal copia `.btn-primary`, el secundario `.btn-secondary`, y los tokens son los de la
casa. Un componente nuevo iría al inventario AB3 y esta pantalla no necesita ninguno.

---

## 2 · LA CAPTURA — campo por campo

| elemento | **antes** | **después** |
|---|---|---|
| los dos bloques (mano de obra / materiales) | texto suelto sobre blanco, sin contorno | **tarjeta** blanca con borde, radio y sombra, como el resto de la app |
| filas de línea | pegadas, sin separación | separador sutil, y la última sin línea colgando |
| cabecera de la tabla | texto plano | etiqueta gris, peso 600, con su regla debajo |
| **«Firmar aquí mismo»** | **botón gris nativo del navegador** | **botón verde de marca**, píldora, ancho completo |
| «Ordenar en líneas» | botón nativo | botón secundario de la casa |
| «Añadir línea» (×2) | botón nativo | botón secundario, dentro de su tarjeta |
| **«×» de quitar línea** | botoncito nativo con borde de sistema | fantasma discreto, y en rojo al pasar por encima |
| las 3 casillas de tipo | radios desnudos en fila | **píldoras**; la marcada, con borde de marca y fondo tinte |
| textarea del dictado | caja del sistema | campo con el borde de la casa y anillo de foco |
| cabecera y datos (obra, REF, horas…) | ya iban bien | **sin cambios** — su estilo en línea ya los resolvía |

---

## 3 · Los controles

**CONTROL POSITIVO — y ejecutado, no afirmado.** Se renderizó un banco con los componentes que usan
Trabajos, Clientes y el albarán (`customers-card`, `btn-primary`, `btn-secondary`, `btn-ghost`,
`status-pill`, `empty-state`, `alert`, `input`, una tabla suelta y un `<button>` sin clase **fuera**
del parte) con la hoja de **antes** y la de **ahora**:

```
casa-antes.png  sha256 51855557a535ae08…
casa-ahora.png  sha256 51855557a535ae08…
✅ IDÉNTICAS al byte: el bloque nuevo no toca ningún componente de la casa

CONTROL POSITIVO DEL MÉTODO: el parte antes/después SÍ difiere → el método discrimina
```

**CONTROL NEGATIVO — cero estilos en línea.** `git diff` sobre `public/` añade **0** líneas con
`style=`. El diff entero es **un fichero**: la hoja.

**Y los guards de navegador**: 9/9 verdes, exit 0.

---

## 4 · 🔴 Lo que sigue mal y NO es de esta tanda (regla 9)

**La cabecera «UNDS» se parte en cuatro líneas.** No es el CSS: es que el rótulo lleva delante
`[PENDIENTE microcopy oficial] `, y ese texto no cabe en una columna de 64 px. Se ve igual en las
dos capturas. **Lo cierra la sesión 4 al firmar los rótulos**, y por eso no lo toco: taparlo con CSS
sería maquillar un texto que está a punto de desaparecer.

**Y la razón de fondo, que es SCRUM-666:** ninguno de los 5.059 tests podía haber cazado esto. El
banco de vistas no aplica CSS externo, así que un test puede afirmar que la pantalla «se pinta»
mientras el usuario ve texto crudo. **La confirmación de este ticket es la captura, no la suite** —
y esa es la lección, no el CSS.
