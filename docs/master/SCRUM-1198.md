# SCRUM-1198 · Presupuesto rápido sin teléfono — parte (a): con cliente nuevo, lo tecleado no se pierde

**Medido contra:** `origin/main` = `643e9a65a5756b9729c9f8d4b911ea0c536988b3` · 2026-10-02T13:10:21Z
A9: comprobación → `tests/scrum1198-cliente-nuevo-sin-telefono.test.mjs`

Carril S2 (`public/dashboard/js/homeView.js`) · rama `scrum-1198-cliente-nuevo-sin-telefono` · sesión `s2-2octa`.

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y antes de editar). Cambio de lógica en un fichero de `public/dashboard/js/`: sin marcado, sin estilos y **sin texto**.

## Qué es esta parte y qué no

**(a) quita la pérdida de datos; el código crudo sigue a la vista y lo quita (b), que espera firma.**

El ticket tiene cuatro partes, decididas por el orquestador el 2-oct-2026 («guardar sin enviar»):

- **(a) — este PR:** con cliente nuevo y sin teléfono, se crean el cliente y el presupuesto.
- (b) no pintar el código interno · (c) cerrar el modal y avisar fuera · (d) el literal. **No están aquí**: esperan el texto firmado en el ticket.

## El defecto, medido en yaqu.app

Presupuesto rápido, cliente NUEVO, teléfono vacío, un clic en «Enviar». Cuenta QA, build `643e9a65`.

La única petición que salía:

- `POST /admin/customers` con `{"name":"…","phone":null}` → **400** `{"error":"validation_error","details":[{"path":["phone"],"message":"Invalid input: expected string, received null"}]}`

No había alta de presupuesto ni envío. Después del error: 0 clientes nuevos y 0 presupuestos nuevos. En pantalla, «API 400: validation_error», y lo tecleado, perdido.

**La causa estaba en el panel.** El esquema del alta admite que `phone` no venga; lo que rechaza es `null`. Y `homeView.js` mandaba `phone: phone || null`. El servidor no se niega a guardar un cliente sin teléfono.

Dos lecturas anteriores parecían contradecirse y las dos eran ciertas: el `phone` es opcional en el esquema (leído por S1) y el alta sin teléfono daba 400 (medido por s2-1octb).

## El arreglo

Una línea: sin teléfono, `phone` no viaja. Con teléfono, viaja igual que antes.

## Verificado, ejecutando

**En el banco** — `tests/scrum1198-cliente-nuevo-sin-telefono.test.mjs`, modal real y una red de mentira con el contrato medido (rechaza `phone: null` con el cuerpo de producción, acepta que no venga):

- **Rojo antes** (con el `homeView.js` de `main`): 3 de 5 caen (sin teléfono, teléfono de sólo espacios, y el reintento). Pasan el suelo y el control con teléfono.
- **Verde después:** 5 de 5.
- **Corrección del propio test (s2-2octc):** el caso CONTROL escribía un teléfono de rango móvil real (`346…`) y el guard de SCRUM-262 lo cazó en el obligatorio (1 rojo de 10258). Estaba en el test, no en nada que mande la pantalla. Ahora lleva uno del rango imposible (`340…`); el guard no se ha tocado.

**Contra yaqu.app**, con el `homeView.js` de esta rama servido por la sonda en lugar del de producción (todo lo demás, producción). Service worker bloqueado; control positivo del interceptor antes de pulsar. Tres clics seguidos en «Enviar»:

| Petición | Veces | Respuesta de producción |
| --- | --- | --- |
| `POST /admin/customers` con `{"name":"…"}` | 1 | **201**, cliente #84, `phone: null` |
| `POST /quote/create` | 1 | **201**, presupuesto #205, borrador |
| `POST /admin/quotes/205/send-whatsapp` | 3 | **400** `customer_missing_phone` las tres |

- El alta sin `phone` da 201: ejecutado, no deducido del esquema.
- Los reintentos no duplican (SCRUM-1371 sigue valiendo con el `phone` omitido): un cliente, un presupuesto.
- No salió ningún WhatsApp: el cliente no tiene teléfono y el servidor corta antes de intentarlo.
- Con esto, cliente nuevo y cliente existente hacen lo mismo: todo queda guardado y falla sólo el envío.

**Datos de prueba que quedan en la cuenta QA** por esta medición y la anterior: cliente #84 «QA 1198 cliente de prueba sin teléfono», presupuestos #204 y #205 (borradores de 1 €).

## Límites

- **Se sigue leyendo un código interno:** antes «API 400: validation_error», ahora «API 400: customer_missing_phone». Y el modal se queda abierto con el botón encendido. Es (b) y (c).
- Medido en Chromium sin cabeza a 1280 px; no en un móvil.
- El fichero medido contra producción es el de la rama servido por la sonda, no uno desplegado.
- `providersView.js` también manda `phone: phone || null` (dos sitios). No se ha mirado si su alta lo rechaza igual: es otra pantalla y no se toca aquí.

# APÉNDICE · 2-oct-2026 · partes (b), (c) y (d): el modal se cierra y se dice fuera, con su texto

**Medido contra:** `origin/main` = `eca8566d130fc35e455b27508b1f3c199dc6263b` · 2026-10-02T16:57:37Z
A9: comprobación → `tests/scrum1198-cliente-nuevo-sin-telefono.test.mjs`

Carril S2 (`public/dashboard/js/homeView.js`) · rama `scrum-1198-sin-telefono-se-guarda-y-se-dice` · sesión `s2-2octe`.

**Skill UI:** cargada (`yaqu-premium-ui`) en esta sesión, antes de editar. Sin marcado ni estilos nuevos: el aviso sale por `showToast`, el mismo que ya usa esta pantalla cuando el envío queda pendiente.

## La firma, dicha como es

El literal está aprobado **por el orquestador, por delegación del fundador**: Jira SCRUM-1198, comentario 18206 (2-oct-2026). No lo escribió el fundador; el comentario relata su «decide tu». Cuando se construyó, ese comentario aún no estaba publicado: se construyó en local, se avisó, y se empujó cuando estuvo en el ticket.

> «No hemos podido enviarlo porque este cliente no tiene teléfono. El presupuesto se ha guardado.»

## Lo construido

Cuando el envío contesta `customer_missing_phone` (se decide por el CÓDIGO, no por el texto):

- **(b)** no se pinta «API 400: customer_missing_phone».
- **(c)** el modal se cierra, el aviso sale fuera y se abre el presupuesto guardado, igual que cuando el envío queda pendiente. Antes se quedaba abierto con el botón encendido: pulsar otra vez daba el mismo no.
- **(d)** el literal de arriba. Uno solo: vale para cliente nuevo y para existente, porque en los dos el presupuesto ya está creado cuando el envío falla.

Cualquier otro fallo del envío sigue como estaba: modal abierto y botón encendido para reintentar.

## Verificado, ejecutando

- **Banco:** rojo con el `homeView.js` de `main` 2 de 8 (los dos caminos de «el modal se cierra»), verde 8 de 8. Con `scrum1371`: 14 de 14.
- **Navegador, en yaqu.app** (Chromium de escritorio, cuenta QA, build `eca8566d`). Antes, con el fichero de producción: tres clics, el modal abierto y «API 400: customer_missing_phone» las tres veces, en los dos caminos. Después, con el `homeView.js` de la rama servido por la sonda: un clic, el modal cerrado, el aviso literal, y la pantalla en `#quotes-detail/205`; no hay segundo clic posible. Cliente nuevo y cliente existente (#84).
- Nada se escribió en producción: el alta de cliente, la del presupuesto y el envío los contestó la sonda (201, 201 y 400 `customer_missing_phone`), con control positivo del corte antes de pulsar.

## Dos tests que cambian, y por qué

**La regla (orquestador, 2-oct): se puede cambiar el MONTAJE de un test cuando la conducta firmada cambia. NO se puede cambiar lo que AFIRMA para que tu código pase.**

- El último caso de `scrum1198` medía tres reintentos tras el fallo de teléfono. Ese reintento ya no existe (el modal se cierra). El «no duplica» se mide ahora en el control negativo, con un fallo que sí deja reintentar.
- `scrum1371` usaba `customer_missing_phone` como «el envío falla» en cinco casos. Ahora usa un 500. Lo que guarda —reintentar no vuelve a crear— no cambia, ni sus asertos.

## Límites

- El 400 del envío lo dio la sonda. Que producción contesta ese código está medido arriba, en la parte (a).
- El modo «3 opciones» pasa por la misma función; no se ha pulsado aparte.
- No medido en un móvil. Tras desplegar falta repetir la sonda sin servir el fichero de la rama.
- La persona sigue sin poder enviar ese presupuesto hasta que el cliente tenga teléfono: el aviso no ofrece añadirlo. Decidido así en el c.18206.

## Errores propios de esta tanda

- Fui a leer la firma al ticket después de medir, no antes: no estaba. Se cazó antes de escribir el literal.
- Escribí los dos casos nuevos en un bucle con el nombre compuesto, y lo paró el guard de SCRUM-1415 (nombres de test construidos). Reescritos con el nombre entero.
- El primer intento de añadir este apéndice, desde PowerShell, no escribió nada y no dio error: lo dijo el guard de la skill (`scrum811c`), no yo.
- **El primer empujón salió ROJO en el obligatorio (1 de 10.368): `scrum128-frontend-census`.** Ese guard exige que, tras llamar a una ruta de envío, el resultado se mire en las 20 líneas siguientes. El resultado SE miraba (`sendResult.sent`), pero metí el camino de «sin teléfono» con su comentario entre la llamada y la comprobación, y la empujé fuera de la ventana. Arreglado en el código: ese camino va a una función (`avisarGuardadoSinTelefono`) y la comprobación vuelve a estar pegada a la llamada. El guard no se ha tocado. No lo corrí en local antes de empujar: no estaba entre los vecinos que elegí a mano.
- Lo que NO era: el aviso no se pintaba para cualquier fallo. Sólo `customer_missing_phone` cierra y avisa; con otro fallo el modal sigue abierto y ese texto no sale (caso «CONTROL NEGATIVO» del test, verde desde el primer empujón). Con otro fallo se sigue leyendo lo de antes, «API 500: …»: es un defecto anterior, su texto sería nuevo y no se ha escrito.
