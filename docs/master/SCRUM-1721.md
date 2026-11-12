# SCRUM-1721 (mitad S1) · la ruta de gastos recoge la retención de IRPF practicada, y el borrador 111/115 se monta

**Medido contra:** `origin/main` = `9bf51c10e` (base de la rama; el ancla de `scripts/equipo/ancla.mjs` al cerrar daba `124043f23b4b4ce333fc1ededc7ed4697a1656f2` · 2026-11-12T19:07:37Z, y la rama se une con ese main antes de empujar) · sesión S1, por encargo del orquestador `cobroflash-backend-5f`.

A9: sin fallo que generalice.

**Cero textos** (solo códigos de error: `retencion_tipo_invalido`, `retencion_cuota_invalida`; los textos firmados del ticket son de la pantalla, piezas ⑤⑧ de S2, y aquí no se pinta ninguno), **cero estados, cero flags, cero esquema** (las tres columnas existen desde SCRUM-1103).

## Qué piezas y de dónde

Encargo: descripción de SCRUM-1721 + c.21656 (reparto: S1 ①②③④⑦) + c.21660 (contrato de J1: las 2 líneas de montaje, `TIPOS_RETENCION_PRACTICADA_VALIDOS` congelada, `hayRetencionAnotadaEnElAño`) + SCRUM-1066 c.21634 §2.

| pieza | estado | dónde |
|---|---|---|
| ① POST pasa tipo y cuota | HECHO | `expenses.routes.ts` (POST `/`) |
| ② PUT, `undefined` ≠ `null` | HECHO | `expenses.routes.ts` (PUT `/:id`): solo viajan las claves que llegan |
| ③ validación 15/7/19, cuota ≥ 0 | HECHO | `src/modules/expenses/domain/retencionPracticadaEntrada.ts` (nuevo), con la lista de J1. Cuota: finita, ≥ 0, máx. 2 decimales, ≤ techo de `Decimal(12,2)`. `''` = `null` (campo de formulario vacío); `"15"`/`"70.5"` valen |
| ④ «No» = `declarada=false` | **FUERA DE ESTE PR, a propósito** → SCRUM-1721b | ver abajo |
| ⑦ montaje `GET /admin/retenciones` | HECHO | `src/app.ts`: las dos líneas literales de c.21660, junto al 303, con `requireRole('admin')` |

## ④ fuera: el motivo literal (regla 41)

`tests/scrum1103-retencion-practicada-en-gastos.test.mjs:81` («DECISIÓN: `retencionPracticadaDeclarada` NO es parámetro de alta, igual que `vatDeducible`») cae en cuanto `createExpense` escribe `declarada`. Su motivo registrado: «sin que exista el cubo de tipos válidos por 111/115 (SCRUM-1103.md §6)». Ese cubo ya existe (lo construyó J1 en 1066g/h), pero re-anclar la decisión que fija el guard es cosa de su dueño (J1, `f4be18002`): cambiarlo desde aquí sería relajar el guard. Decisión del orquestador (12-nov, noche): empujar ①②③⑦ ahora, que la petición a J1 la ponga él en SCRUM-1721 y que ④ sea **SCRUM-1721b** cuando J1 mueva su guard. Propuesta: «`declarada` solo entra por `leerRetencionPracticada`». El diseño de ④ ya está medido (rojo→verde en una versión anterior de esta rama, sin empujar): `false` = «No», y borra tipo y cuota; con un tipo o un importe a la vez → `400 retencion_contradictoria`; un tipo escribe `declarada=true`. Hoy el test fija lo contrario: la ruta NO escribe `declarada` (queda `null`).

## Rojo primero, por la ruta real

- **Sonda de J1** (`docs/master/evidencias/scrum1066/sonda-1066g-retencion-por-la-ruta.mjs`, sin tocar): sobre main el POST guarda `null`/`null`, el 111 tiene la casilla 09 a 0 y el 115 a 0, y el PUT que solo lleva la retención da `400 empty_update` → `evidencias/SCRUM-1721/sonda-1066g-antes-main-9bf51c10e.txt`. Con la rama: **111 c.07=1 · c.08=1000 · c.09=150; 115 retenciones=114; PUT 200 con tipo 15** → `…/sonda-1066g-despues.txt`. El control positivo (P) sale en las dos pasadas.
- **Test nuevo** `tests/scrum1721-retencion-practicada-por-la-ruta.test.mjs` (rutas y servicio reales de `dist/`, base doblada con `_envio-doblado.mjs`, `req` con `reqDeSesion`; el ⑦ se lee en el AST de `src/app.ts`): sobre main dio **14 rojos de 16**. Los 2 verdes eran los que tenían que serlo (alta sin campos → `null`; la lista de J1). Con la rama: verde.
- **Mutantes** (`MUTACIONES_QUE_ME_TUMBAN`, 6): los 6 caen.

## Qué guards se mueven al montar la ruta (medido, declarado nuestro en c.21669)

Tanda acoplada: 70 ficheros (los que nombran `mountAdmin`, `src/app.ts`, `expenses.routes/service`, `retencionPracticada`, `retenciones.routes` o `_sin-consumir-declarados`) más el nuevo.

1. **SCRUM-158** (`scrum158-montajes-admin-muestreados`): todo montaje con gate de admin necesita al menos una ruta suya en `ADMIN_ONLY_ROUTES` → añadido `GET /admin/retenciones` en `src/core/http/adminOnlyRoutes.ts` (más cobertura; el test de permisos exige un 403 para el técnico).
2. **SCRUM-1185** (`scrum1185-trinquete-sin-consumir`): ② doce piezas de J1 pasan a tener consumidor y van a `retiradas` (sus motivos decían «se retira en el PR de S1 que monte la ruta» / «el día que se monte»). ① cinco piezas nuevas sin consumidor (eran siete con ④): `ruta · GET /admin/retenciones` y `cuerpo · POST|PUT …::retencionPracticadaTipo|Cuota`. Las consume la pantalla de S2 (⑤⑧, misma tarea), así que se **declaran** con carril S1 y «se retira en el PR de S2». Primero salió `ciega-lector-cuerpo` en POST y PUT, porque pasaba `req.body` entero; se arregló en el CÓDIGO pasando los campos uno a uno.
3. **SCRUM-1344 ⑤** (`scrum1344-arnes-de-prueba-con-rol`): con la ruta montada bajo /admin, el arnés de J1 `tests/scrum1066h-ruta-borrador-retenciones.test.mjs:109` (`req.userRole = 'admin'` a mano) entra en el censo. Se pasa a `reqDeSesion({ rol: 'admin', merchantId })`, el arreglo que indica el propio guard, sin tocar ninguna aserción. Va avisado a J1 por el orquestador.
4. **SCRUM-854**: este registro.

Resultado final de la tanda acoplada: 745 tests · 734 pasan · 10 saltos declarados · 1 fallo antes de escribir este registro (SCRUM-854 ②, que es este fichero).

## Contrato para S2 (⑤⑧)

- Alta/edición: el cuerpo lleva `retencionPracticadaTipo` (15 · 7 · 19) y `retencionPracticadaCuota` (número o texto numérico, ≥ 0, 2 decimales). En la edición, la clave que no se manda no se toca y `null` la borra. Errores: `400 { ok:false, error:'retencion_tipo_invalido' | 'retencion_cuota_invalida' }`.
- La opción «No» todavía no tiene campo en el servidor (④ → 1721b): hasta entonces, no mandar `retencionPracticadaDeclarada` (la ruta la ignora).
- Borrador: `GET /admin/retenciones?año=&trimestre=` (contrato de J1 en c.21660), admin-only.

## Falta

- ④ → SCRUM-1721b (cuando J1 re-ancle `scrum1103:81`).
- Recorrido en **yaqu.app** tras el merge: un gasto con tipo 15 y su importe sale en el 111 (07-09); uno de «Alquiler de local» con 19 sale en el 115. Por API hasta que S2 ponga la pantalla.
