# SCRUM-1227 — Guardar Configuración borraba las cláusulas, la Home, el criterio de caja y la retención IRPF

**Medido contra:** `origin/main` = `d2c8903c5e75c9defc732bf8f7a7eebf20e79561` · 2026-09-28T15:10:16Z

Carril S1 · sesión s1-28b · rama `scrum-1227-perfil-devuelve-lo-que-guarda` · GO del orquestador (28-sep). Hallazgo al medir SCRUM-1180.

## El defecto (pérdida de datos silenciosa)

`getMerchantProfile` (`src/modules/system/merchantAdmin.ts`) tiene un `select` EXPLÍCITO. Cinco campos que el PUT escribe **no salían en el GET**. Configuración los recibía vacíos, y como el formulario los manda SIEMPRE al guardar (`settingsView.js`, `const payload = {…}`), **cualquier guardado** los machacaba con el vacío:

| Campo | Qué perdía el profesional |
|---|---|
| `clausulasPresupuesto` | las condiciones que imprime cada PDF de presupuesto (nunca estuvo en el `select`: nació así en `6064c1cc`, SCRUM-656 fase B) |
| `homePrefs` | los bloques visibles de la Home (la «fusión» de SCRUM-1042 fusionaba contra `{}`) |
| `criterioCaja` | el criterio de caja → volvía a «no consta» |
| `retencionIrpfDeclarada` / `retencionIrpfTipo` | la retención IRPF → volvía a «no consta» |

El orquestador pidió cláusulas y `homePrefs`, y que se recorriera el `select` entero contra lo que la pantalla guarda. **Ese recorrido, derivado del código, sacó los otros tres**, con el mismo defecto y con peso fiscal.

## 🔴 Por qué no lo vio nadie (la lección)

`tests/scrum656b-clausulas-configuracion.test.mjs` probaba que el PUT **ACEPTA** las cláusulas, no que el GET las **DEVUELVA**. Media vuelta probada es lo mismo que ninguna cuando el defecto está en la otra media.

## Arreglo (servidor, sin ALTER, sin texto, sin pantalla nueva)

- Los cinco campos entran en el `select` de `getMerchantProfile`.
- El perfil reducido del técnico (`app.ts`) recibe también `clausulasPresupuesto`, por decisión del orquestador: son las condiciones comerciales del negocio, no un dato fiscal ni bancario, y el técnico ya las manda impresas en cada PDF. El editor de SCRUM-1180 las necesita. Los datos fiscales (`criterioCaja`, retención) siguen siendo solo del admin.

## Pruebas

`tests/scrum1227-perfil-ida-y-vuelta.test.mjs`: una **ida y vuelta** real, PUT (`updateMerchantProfile`) → base doblada que respeta el `select` → GET (`getMerchantProfile`). Las claves se leen del `payload` de `settingsView.js`, así que un campo nuevo en el formulario sin su línea en el `select` pone el test en rojo. **Rojo medido contra el `dist` anterior:** faltaban exactamente los cinco. Verde después.

Guard de SCRUM-633: su regex exige que `timezone` sea el último campo de la desestructuración del técnico, así que `clausulasPresupuesto` va antes. El guard no se ha tocado.

---

## SCRUM-1227b · El gesto que faltaba: pulsar «Guardar cambios» en yaqu.app

**Medido contra:** `origin/main` = `5f48829e38ec4319793bcb87c66f36236b480637` · 2026-10-06T20:12:27Z

Carril S1 · sesión `s1-6octi` · rama `scrum-1227b-el-gesto-de-guardar`. Sólo documentación y evidencia: ni `src/` ni `public/`.

A9: comprobación → `tests/scrum1227-perfil-ida-y-vuelta.test.mjs`

El ticket seguía abierto por una sola cosa (comentarios 17522 y 17913 de Jira): nadie había pulsado el botón. En la cuenta QA no se podía, porque su perfil tiene vacíos los cuatro campos obligatorios y el navegador corta el envío; rellenarlos es cambiar el fixture (SCRUM-1367).

### Cómo se ha pulsado sin tocar el fixture

`docs/master/evidencias/SCRUM-1227/sonda-1227-guardar.mjs`: el panel REAL de yaqu.app (build `5f48829e…`, leído de su `<meta name="yaqu-build">`), a 390 px, con la sesión QA.

- Los cuatro obligatorios se ponen **sólo en el navegador**, parcheando la respuesta del `GET /admin/merchant`. Las cláusulas son las que manda producción, sin tocar.
- `homePrefs` vale `null` en la cuenta QA y su «no cambió» no probaría nada (límite 1 del comentario 17522): la sonda le siembra, también sólo en el navegador, un valor con una clave que la pantalla no conoce.
- El `PUT` **no llega a producción**: lo contesta la sonda. El interceptor lleva su control positivo antes de pulsar (un POST de mentira tiene que salir cortado, o la sonda lanza).

### Medido — población: 1 pantalla, 1 botón, 2 pasadas

| | cláusulas que manda el servidor | filas en la caja | sale el `PUT` | `clausulasPresupuesto` del `PUT` | `homePrefs` del `PUT` |
|---|---|---|---|---|---|
| **HOY** (`salida-hoy.json`) | 2 | 2 | sí | las 2, con su `id` | conserva la clave sembrada |
| **CONTROL: el `GET` de antes de #1894**, sin las dos claves (`salida-viejo.json`) | 2 | **0** | sí | **`[]`** | **sólo `showTechPhotoToClient`** |

La segunda fila es el defecto del ticket, reproducido con la misma sonda: sin ella, la primera no diría nada.

### Lo que esta sonda NO mide

- **Que el servidor guarde ese `PUT`.** Lo contestó la sonda. Esa mitad está en `tests/scrum1227-perfil-ida-y-vuelta.test.mjs` (ida y vuelta por `updateMerchantProfile` → `getMerchantProfile`) y la midió S2 en producción el 29-sep por API (comentario 17522).
- **`criterioCaja` y la retención.** Siguen a `null` en la cuenta QA; la sonda no los siembra. Su ida y vuelta está en el mismo test.
- **Un profesional con un obligatorio vacío no puede guardar nada en Configuración** (comentario 17913). Es de la pantalla (J3) y no es este defecto.
- La sonda importa `comun.mjs` de una carpeta de la máquina (`D:/MILLONARIO/cobroFlash/sondas-s2/`), que no está en el repo: para repetirla hace falta esa carpeta y la sesión QA viva.
