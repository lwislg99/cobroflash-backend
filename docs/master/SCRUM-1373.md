# SCRUM-1373 · El drenado de la cola dice qué firmas ha confirmado el servidor (mitad S2 del «detalle abierto que no se entera»)

**Medido contra:** `origin/main` = `31688d6b550ea0bbc1b99b381fdf857b821bdec9` · 2026-10-01T13:26:21Z
A9: comprobación → `tests/scrum267-ancla-de-medicion.test.mjs`

(La A9: escribí el ancla de arriba con el SHA corto y mi tanda dirigida, elegida por nombre de fichero, no llevaba el guard que lo mira. Lo cazó porque esta vez lo arrastró el patrón por casualidad. Desde ahora mi tanda dirigida lleva `scrum267` junto a la skill de UI y la A9.)

Carril S2 (`public/dashboard/js/colaDeFirmas.js`) · rama `scrum-1373-drenado-avisa-firmas-confirmadas` · sesión `s2-1octb`.

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y antes de editar). Cambio de lógica en un fichero de `public/dashboard/js/`: sin marcado, sin estilos y **sin texto**.

## El defecto entero, y por qué va en dos mitades

Con el detalle de un albarán abierto y su firma en la cola, vuelve la red, el drenado la sube y la pantalla sigue «emitido», ofreciendo «Firmar aquí mismo». Está declarado en `scripts/_defectos-viaje-firma-declarados.json` (`el-detalle-abierto-no-se-entera-de-que-la-cola-subio`) y lo mide `tests/scrum1351-viaje-firma-sin-red-albaran.test.mjs`.

Va partido por dos motivos, en este orden:

1. **Carril.** Quien tiene que repintarse es `albaranDetailView.js`, que es de S4.
2. **Seguridad.** Quien sabe cuándo es seguro repintar es la propia vista. La alternativa —que `colaDeFirmas.js` repinte por el router— se descartó por peligrosa: al volver la red puede caer con el pad de firma abierto y llevarse lo que alguien estaba haciendo.

(La S2 tiene además denegada la retirada de entradas de esa lista. Eso **no** es el motivo de la partición: si lo fuera, sería repartir para esquivar un permiso.)

Esta mitad **sola no arregla el defecto**: no toca la lista ni el test de S4. La otra mitad es SCRUM-1374 (`area-s4`).

## EL CONTRATO (lo que tiene que saber quien escuche)

- `window.alConfirmarseFirmas(fn)` suscribe y **devuelve la función que desuscribe**.
- `fn` recibe una lista, nunca vacía, de `{ tipo, documentoId }`:
  - `tipo`: `'albaran'`, `'parte'` o `'parte-tecnico'`. Una entrada vieja sin tipo llega como `'albaran'`, igual que al subirla.
  - `documentoId`: el id del documento en la API, tal cual se encoló. Compararlo como texto.
- Entra una firma que el servidor **tiene** y que ha **salido** de la cola: la que acaba de subir y la que ya tenía (409 «ya firmado»).
- **No** entra la rechazada (sale de la cola, pero el servidor no la tiene), la que falló, ni la respuesta que no confirma.
- Un aviso por drenado, al terminar. Un drenado que no confirma nada no avisa.
- Cada oyente recibe su propia copia; uno que lanza no afecta al drenado ni a los demás.
- La firma directa (la que sube en el momento, sin pasar por el drenado) no avisa: quien la hizo ya lo sabe.

Quien escuche tiene que desuscribirse cuando su pantalla deje de estar montada.

## Verificado, ejecutando

`tests/scrum1373-drenado-avisa-firmas-confirmadas.test.mjs`, con cola, almacén y drenado reales: 8 de 8.

Sin el cambio no hay rojo «del defecto» que enseñar: `alConfirmarseFirmas` no existe y el suelo del test cae el primero. Lo que el test fija es el contrato, incluido lo que **no** se avisa (la rechazada, la fallida, el portal cautivo, la red caída, la cola vacía).

Vecinos tras el cambio (`scrum1351`, `scrum1354`, `scrum356`, `scrum358`, `scrum1360`): ver el comentario de entrega; `scrum1351` sigue viendo los cuatro defectos declarados.

## Lo que NO hace

- No repinta nada.
- No cambia lo que devuelve `drenarFirmasPendientes`.
- No está visto en un navegador: es un aviso sin nadie que lo escuche todavía.
