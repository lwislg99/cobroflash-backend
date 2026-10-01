# SCRUM-1354 · La marca de «hubo cola» tiene un solo dueño: una pérdida real de firmas se avisa gane quien gane el arranque

**Medido contra:** `origin/main` = `7a30dbb0e50e1cc4d54949619f7be8d4aac0193f` · 2026-10-01T11:40:41Z
A9: comprobación → `tests/scrum1294-a9-leccion-en-a10.test.mjs`

Carril S2 (`colaDeFirmas.js`, `resistenciaAlmacen.js`; §11bis: «el resto es de la S2») · rama `scrum-1354-dueno-de-la-marca` · sesión `s2-01a`. Sale de medir el hallazgo 6 de SCRUM-1302.

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y antes de editar). Cambio de lógica en dos ficheros de `public/dashboard/js/`: sin marcado, sin estilos y **sin texto nuevo** (el aviso que se pinta es el que ya existía).

(La A9: mi fallo de esta tanda fue en el PR anterior, #2080 — plegué su registro sin la línea `A9:`. Lo paró ese guard en mi tanda local, antes de empujar.)

## El defecto

`app.js` lanza al arrancar, sin `await` y sin orden entre sí, el drenado de la cola de firmas (`drenarAlAbrir`) y el detector de desalojo (`resistenciaAlArrancar`). La marca `yaqu_hubo_cola` es la única prueba, fuera de IndexedDB, de que hubo cola. `drenarFirmasPendientes` la retiraba siempre que la cola quedara en cero — **también cuando la encontró ya vacía y no drenó nada**. Tras un desalojo real (marca puesta, cola vacía), si el drenado llegaba antes, borraba la prueba y el detector contestaba `SIN_PERDIDA`: el profesional pierde la firma de un cliente y nadie se lo dice.

Una red de seguridad que no caza tiene el mismo aspecto que una que no tuvo nada que cazar.

## Quién gana, medido

| Dónde | Quién gana | Con marca + cola vacía |
| --- | --- | --- |
| Chromium headless contra yaqu.app (build `48babd04`), 10 arranques, service worker activo y bloqueado | el detector, 10/10 | avisa |
| Banco (fake-indexeddb), el drenado entero antes que el detector | el drenado | **callaba** |
| Banco, lanzados como en `app.js`, `persist()` a 0 ms | el detector | avisa |
| Banco, lanzados como en `app.js`, `persist()` a 5 y 40 ms | el drenado | **callaba** |

**NO medido: Safari ni un iPhone**, que es donde ocurre el desalojo (WebKit, 7 días). Por eso el arreglo no intenta ganar la carrera: hace que dé igual.

## El arreglo

1. **El drenado sólo retira la marca si él vació una cola que tenía algo** (`teniaAlgo && quedan === 0`). Si la encontró vacía, no la toca.
2. **El arranque consume la marca al avisar** (`resistenciaAlArrancar`, cuando el veredicto es `POSIBLE_PERDIDA`): el aviso sale una vez, que es lo que ya ocurría de hecho cuando la borraba el drenado. `detectarDesalojo` a solas sigue siendo una pregunta y no consume.
3. **El detector del arranque espera a los drenados en vuelo** (`esperarDrenadosEnVuelo`, nuevo en `colaDeFirmas.js`): entre que el drenado saca la última firma y retira la marca hay una lectura de la cola, y mirar justo ahí sería un aviso falso. El drenado tiene plazo, así que no espera para siempre.

## Verificado, ejecutando

`tests/scrum1354-dueno-de-la-marca.test.mjs`, con el drenado, el detector, la cola y el `apiRequest` reales:

- **Rojo antes del arreglo:** caen los tres del defecto (drenado entero antes; `persist()` a 5 ms; a 40 ms). Los otros diez pasan.
- **Verde después:** 13/13. Desalojo real → `POSIBLE_PERDIDA` con el drenado antes, con el detector antes, y lanzados juntos a 0, 5 y 40 ms. El aviso sale una vez. Cola con firmas y red, a 0, 5 y 40 ms: se suben, sin aviso, y la marca se retira. Cola con firmas y el servidor caído: se quedan, sin aviso, marca intacta. Control: sin marca y sin cola, `SIN_PERDIDA`.
- Vecinos (19 ficheros que nombran cola, drenado, marca o detector): 218/218.

**NO medido:** yaqu.app con este código (se mide al desplegar, repitiendo los 10 arranques con marca + cola vacía), ni Safari. Y el límite de siempre: si la persona cierra la aplicación antes de que la home pinte el aviso, la marca ya se consumió — igual que antes de este cambio.
