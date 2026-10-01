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
