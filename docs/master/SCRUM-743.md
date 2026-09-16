# SCRUM-743 · La tercera forma: agrupar SIN forzar decimales

**Fecha:** 4-sep-2026 · **Carril:** dinero / presentación · **Gate:** todo en `npm test`; sin BD

**Medido contra:** `origin/main` = `cc786ab34df118e6a44ae25ae523709f3cb4e11c` · 2026-09-04T21:15:09Z

**Tanda:** 5318 tests, 5229 pass, **1 fail**, 88 skipped — corrida DESPUES del ultimo cambio,
entrada incluida. El fallo **no es de este ticket**: es `SCRUM-176b`, rojo en cualquier checkout
cuya ruta lleve un espacio y verde en CI. Sigue sin arreglar en `main`; S5 lo tiene.

⚠️ **Esta rama SALE DE `scrum-739-informes-al-sitio-unico`, no de `main`.** El hueco que este
ticket cierra —el rótulo del eje— lo declaró aquél, y el patrón del front (`opcionesDeDinero`,
`fmtImporteEs`) también es suyo. Desde `main` no habría sobre qué construir. Orden de merge:
**739 → 743**.

---

## La víctima

Una cantidad de **1.500 unidades** se imprimía `1500` en un albarán donde todo lo demás lleva el
punto de millar. Y el rótulo del eje de Informes escribía `6050` donde el mismo gráfico, dos líneas
más abajo, escribe `6.050,00`.

---

## PASO 0

### MECANISMO — había DOS formas y la tercera faltaba

| forma | dónde | decimales |
|---|---|---|
| importe **con** símbolo | `formatMoneyEs` · `fmtMoneyEs` | **fija 2** |
| importe **sin** símbolo | `formatImporteEs` · `fmtImporteEs` (SCRUM-739) | **fija 2** |
| **número agrupado** | **no existía** | — |

Las dos que había fijan `minimumFractionDigits: 2`. **Lo que no es dinero no cabe en ninguna**, y
por eso los dos sitios que lo necesitaban se escribieron su propio `toLocaleString('es-ES')` — que
por CLDR no agrupa los enteros de cuatro cifras. Es el mismo hueco que SCRUM-739: **no fue
descuido, no había a quién llamar.**

---

## 🔴 El filo, que es el argumento con el que se pidió el ticket

> **`1,5` sigue siendo `1,5` y NO `1,50`.**

Pasar una cantidad por una forma de dinero **añadiría un decimal que hoy no está**. En un albarán
firmado eso es cambiar lo impreso, que es peor que el defecto. `formatNumeroEs` pone el mínimo en
**0** y el máximo en 2: los decimales que traiga, ni uno más.

El test lo ata **con el contraste al lado**: `formatImporteEs(1.5)` sí da `1,50`. Si alguien
«unifica», cae.

---

## La agrupación, UNA vez por mitad

`AGRUPA_SIEMPRE` en `utils.ts` y en `api.js`. Las tres formas la traen con `...spread`, así que lo
que las separa es sólo lo que **tiene** que separarlas: el símbolo y los decimales.

Estaba escrita **dos veces en cada mitad**, y eso es lo que lleva **cuatro tickets** rompiéndose por
lo mismo —A18.2, SCRUM-436, SCRUM-636, SCRUM-739—: cada copia del formato reintrodujo el mismo
defecto. Un test cuenta que `useGrouping` aparezca **una sola vez** en el código de cada fichero.

---

## La trampa, ejercitada

Un rojo con **117** o con **12.345** no prueba nada: con tres cifras no hay nada que agrupar y con
cinco `es-ES` **ya agrupa**. La forma vieja y la nueva **coinciden** en los dos casos.

El test lleva dentro `COMO_ESTABA` y comprueba las dos mitades: que con **1.500** difieren, y que
con 117, 12.345, 999 y 2,5 **no**. El rojo usa cuatro cifras enteras porque es el único sitio donde
hay defecto.

---

## Lo que se cablea, y lo que NO

### ✅ El rótulo del eje de Informes

Era el hueco que SCRUM-739 dejó **declarado**. El contador de `toLocaleString` de aquel test baja de
**1 a 0**, y el trinquete sólo aprieta.

### 🔴 `fmtQty` del albarán NO se cablea — y no es lo que el encargo pedía, es lo que la medición obliga

El encargo decía «cablearla en los DOS sitios». Al medir el segundo apareció algo que no estaba en
el ticket:

**La pantalla pública de firma escribe la cantidad EN CRUDO** —`${esc(l?.cantidad ?? '')}`, sin
formatear— mientras el PDF la pasa por `fmtQty`. **Ya divergen hoy:**

| cantidad | PDF hoy | pantalla hoy | |
|---|---|---|---|
| 2,5 | `2,5` | `2.5` | 🔴 |
| 1.500 | `1500` | `1500` | coinciden **por casualidad** |
| 12.345 | `12.345` | `12345` | 🔴 |

**4 de 10 casos divergen**, y el guard que existe justamente para eso —SCRUM-468, *«la pantalla de
firma enseña lo mismo que el PDF»*— **no mira esa celda**: deriva del PDF el dinero, los rótulos y
la leyenda, pero no la cantidad. Su propio fixture tiene `cantidad: 2.5`.

De ahí que los dos sitios estén **acoplados**, y que ninguna de las dos salidas sea mía:

- **Tocar sólo el PDF** convierte una coincidencia accidental (`1500` = `1500`) en divergencia
  (`1.500` ≠ `1500`). Sería empeorar a sabiendas.
- **Tocar los dos** cambia lo que ven **cuatro albaranes ya firmados en producción**, cuya pantalla
  el código declara intocable (SCRUM-468 y SCRUM-607). Se probó: el guard cae, y **cae bien** — el
  diff es exactamente `2.5` → `2,5`.

**Se deja intacto y se pregunta.** Los dos ficheros del albarán quedan byte a byte como estaban.

**Medido y relevante para decidir:** el `contentHash` del albarán es *«SHA-256 del CONTENIDO
canónico (NO del PDF)»*, así que **ninguna de las dos opciones afecta a la verificación de la
firma**. Lo que está en juego es lo que se ve, no lo que se puede probar.

**Mi recomendación, si se me pide:** cablear **los dos** y ampliar SCRUM-468 para que compare
también la celda de la cantidad. La pantalla pasaría a decir lo mismo que el papel que el cliente
firmó, que es estrictamente mejor que decir otra cosa — pero es una decisión sobre documentos
firmados y no la tomo yo.

---

## Mutación · seis defectos, seis cazados

Post-condición: cambió el fichero que dice, ningún otro se movió, y para TypeScript, que `dist/`
cambió.

| # | defecto inyectado | quién lo caza |
|---|---|---|
| ① | **el filo**: la tercera forma fuerza dos decimales | 4 tests, entre ellos el del filo |
| ② | la tercera forma deja de agrupar | 9 tests, de tres tickets distintos |
| ③ | una forma se escribe su propia agrupación | el test de «una sola vez» |
| ④ | nace una **cuarta** forma | el trinquete de SCRUM-636 **y** el de «siguen siendo tres» |
| ⑤ | el rótulo del eje vuelve a formatear solo | SCRUM-739 y SCRUM-743 |
| ⑥ | el front y el backend divergen | el test de las dos mitades |

Control negativo: sin mutar, cero rojos. Tras restaurar, cero rojos y las huellas vuelven.

---

## Dos trinquetes ajenos actualizados a mano, con su motivo

- **SCRUM-636** exige que un formateador nuevo en `utils.ts` se declare *«a mano, a propósito»*.
  `formatNumeroEs` entra en la lista. **No es dinero y entra igual**: lo que ese guard vigila no es
  que el nombre sea de dinero, es que **ningún formateador de presentación llegue al XML de la
  AEAT** — un número escrito `1.500` rompe un registro igual que un importe con símbolo.
- **SCRUM-739**: su contador de `toLocaleString` en Informes baja de 1 a 0, porque el hueco que él
  mismo declaró queda cerrado.

Ninguno se relajó: los dos siguen cayendo si aparece uno nuevo.

---

## Microcopy

**Ninguna.** No se estrena ni un texto: cambia cómo se escribe un número que ya se escribía. El
censo de SCRUM-402 no se mueve.

---

## Tests

- `tests/scrum743-tercera-forma.test.mjs` — los 9: suelo, el filo con su contraste, el rojo de
  cuatro cifras con la trampa escrita, la banda entera (220 valores, con suelo), que la cifra no se
  mueve, front == backend, `useGrouping` una sola vez por mitad, las formas siguen siendo tres, y el
  eje cableado.

⚠️ **Este fichero cayó en la trampa del NBSP al escribirse**: `formatMoneyEs` mete U+00A0 antes del
`€`, así que `'1,50 €'` escrito a mano **no es igual** y las dos cadenas se ven idénticas. Es la
misma que `albaranPublicVista.ts` documenta. Se comprueba por el principio de la cadena, y queda
escrito por qué.

---

## Huecos declarados · lo que NO verifiqué

- **No he abierto Informes en un navegador**: compruebo la función y que la vista la llama.
- **No he medido las cantidades reales de los albaranes de producción**: no sé cuántos tienen
  decimales o cuatro cifras, así que no sé a cuántos afectaría la decisión pendiente.
- **`fmtQty` y la pantalla de firma siguen divergiendo** exactamente como hoy: no se ha tocado nada,
  y por eso el defecto que traía el encargo sigue vivo en el albarán.
- **No he corrido `npm run guards:visuales`**: miden la landing, que no comparte estos ficheros,
  pero **no lo he ejecutado**.

---

## Hallazgos fuera de carril

- 🔴 **SCRUM-468 no compara la celda de la cantidad**, aunque su título es «la firma ve lo que
  firma»: deriva del PDF el dinero, los rótulos y la leyenda. Por eso la divergencia de `2.5` contra
  `2,5` lleva ahí desde que existen los dos.
- **Tres sitios convierten el punto en coma a mano** (`exports.routes.ts`, `exportData.ts`,
  `fiscal/evidencias/paquete.ts`), del censo de SCRUM-625. Siguen fuera.
