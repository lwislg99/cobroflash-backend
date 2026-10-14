# SCRUM-1536 · Forales y Canarias en la lista de provincias: ya estaba decidido, y qué pasa hoy

**Medido contra:** `origin/main` = `254a697924c99bdf85eb06c95ee439a4a013aa67` · 2026-10-13T12:09:48Z (hora de GitHub)

A9: sin fallo que generalice — mis cuatro tropiezos (abajo, «Lo que me salió mal») son casos de frases que A10 ya tiene: «Contar texto no es contar cosas» en su forma «Un prefijo no es un nombre, y una subcadena tampoco», y «Un instrumento declara su población, no sólo su resultado»; ninguno llegó a una cifra entregada.

13-oct-2026 · sesión `jv-j5j` (equipo de Javier), por encargo del orquestador (`cobroflash-backend-2e`).
[Escrito por la sesión, no por Javier. Leídos en Jira: SCRUM-1536 entero (sin comentarios al empezar);
SCRUM-1522 `c.19294` y `c.19338`; SCRUM-997, SCRUM-998 y SCRUM-1497 enteros, con sus comentarios.]
La entrega completa está en Jira, **SCRUM-1536 `c.19355`**. Este registro es su resumen y el sitio de
las evidencias.

**Carril a mano.** El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); se siguió, como manda la ficha
del día. Sólo se escribe en `docs/master/`. No se ha tocado `src/`, `public/`, `tests/`, el esquema ni
ningún texto de usuario. Ninguna base mirada.

Al escribir esto `main` era ya `eebc104d9e955cdd67b31ad2d24a50cc9b849a7b`: lo entrado en medio son 11
ficheros de SCRUM-1339 en `docs/master/`, ninguno de los medidos aquí.

## ① Estaba decidido

El ticket pedía medir primero si el alcance territorial ya estaba fijado. Lo estaba:

| dónde | qué fija |
|---|---|
| `docs/YAQU_MASTER.md:248`, Parte I, regla 33 | «Onboarding bloquea facturación ES a domicilios forales (PV/Navarra) con aviso digno; TicketBAI = cajón F3.» |
| `docs/YAQU_MASTER.md:105`, B2.6 | «Gate foral: domicilio fiscal en País Vasco/Navarra → facturación ES off + aviso TicketBAI (regla 33).» |
| `docs/YAQU_MASTER.md:416`, Parte M | «Foral (PV/Navarra) → facturación off + aviso TicketBAI (regla 33).» |
| `docs/YAQU_MASTER.md:1735`, Parte Z | «TicketBAI foral · Cajón F3 · ≥25 solicitudes forales» |
| `docs/YAQU_MASTER.md:1104`, U3 | TicketBAI en la lista de F3 |
| SCRUM-997 | Javier, 21-sep-2026: «Sí, de momento no vendemos para estas regiones, déjalo por escrito» (País Vasco y Navarra) |
| SCRUM-998 `c.16609` | Javier, 23-sep-2026: «NO se hace nada hoy». No se bloquea el alta a los forales |
| SCRUM-1497 | Fundador, 7-oct-2026: «No de momento dejamos Canarias sin hacer, ya lo haremos déjalo reflejado en JIRA junto con las forales» |

Barrido del máster: 14 familias de palabras, 1 fichero, 499.475 caracteres; positivo sembrado 14 de 14
y control de cero a 0 (`barrido.mjs`). **De Canarias el máster no dice nada**: «IGIC» 0 veces; la única
línea que casa con «Canarias» (`:1362`) es la palabra «canario» de un test. Búsqueda en Jira por las
diez palabras del encargo: 26 tickets; con una palabra inventada, 0.

SCRUM-997 pedía escribir la decisión en `docs/equipo/limites-del-fundador.md` y **no se ha hecho**: el
fichero (11.753 B) tiene 0 menciones de vasco, navarra, foral, canari o «regiones», y 13 de «fundador».

Lo único sin decidir es qué hace con esas seis la pantalla de provincia, que el 23-sep no existía. Eso
es del fundador y aquí no se elige.

## ② Qué pasa hoy con un comercio de las seis

Ejecutado con los módulos reales compilados (`tsc --noCheck` a una carpeta temporal) y comercios
fabricados: `sonda.cjs`, salida en `salida-sonda.txt`.

- **Alta.** Las seis están en la tabla (52 de 52). `zonaDeAlta` devuelve `Europe/Madrid` para Álava,
  Bizkaia, Gipuzkoa y Navarra —el mismo valor que para Madrid— y `Atlantic/Canary` para las dos
  canarias. **La provincia no se guarda**: `Merchant` no tiene esa columna (las dos del esquema son de
  `Customer` y `CustomerSite`). Después del alta, un comercio de Bizkaia es indistinguible de uno de
  Madrid.
- **Emisión.** `getEmissionMode`, 14 llamadas (7 comercios × flag OFF y ON) con un espía que apunta
  cada propiedad leída. Con el flag en OFF, los 7 dan `receipt`; con el flag en ON, los 7 dan `fiscal`,
  incluidos los tres que habían contestado «Sí» al domicilio foral y los dos canarios. Propiedades
  leídas: `country`, `email`, `flags`, `id`. No lee `timezone`, `domicilioFiscalForal`, `address` ni
  `nif`. Controles: país MX → `fiscal`; id de la demo → `demo`; el espía sí apunta `timezone` cuando
  algo la lee.
- **Tipos.** `invalidTipoIva` rechaza los cinco tipos propios del IGIC (3, 7, 9,5, 15 y 20 %) y acepta
  21, 10 y 4 % (3 de 3). El registro lleva el impuesto fijo a `01` en
  `src/modules/fiscal/verifactu/registro.builder.ts:358`, única aparición.
- **Pantalla.** El alta pública está cerrada (SCRUM-1515, 409 siempre). La provincia sólo la teclea el
  equipo en su consola: nadie de fuera puede elegir hoy ninguna de las seis.

**El único freno de hoy es `INVOICING_ES_ENABLED` en OFF, y no es territorial.** El día que se encienda,
las seis emiten como Madrid. La regla 33 sigue declarada sin mecanismo: la respuesta al domicilio foral
se guarda y ninguna puerta la lee.

## ③ Dos hechos del ticket que la medición corrige

Texto consolidado del RD 1007/2023 leído hoy de la API del BOE (`BOE-A-2023-24840`, 88.577 B, 36
bloques, 233 párrafos, sha256 `20d704afa2d24e91cf97e8ec83c41038f1eef964a1ba724ff6f0958425a8ca38`):
`boe.mjs`, salida en `salida-boe.txt`. Los tres párrafos de territorio del articulado están en el
art. 1.3 del Reglamento.

1. **Canarias está dentro del Reglamento.** «El Reglamento es aplicable en todo el territorio español,
   sin perjuicio de los regímenes tributarios forales […] y teniendo en cuenta las especialidades
   previstas en su normativa específica para Canarias, Ceuta y Melilla», y las referencias al IVA «se
   considerarán también efectuadas a la normativa del Impuesto General Indirecto Canario». El XSD de
   casa admite `03` = IGIC. El ticket la ponía bajo «por qué no es VeriFactu»: no es eso. Es el mismo
   sistema, y es nuestro producto el que no sabe hacer IGIC.
2. **Lo foral va por domicilio fiscal**, no por la provincia donde se trabaja: el Reglamento se aplica
   «cuando tengan su domicilio fiscal en territorio común». La pantalla pregunta «¿Dónde trabajas?»
   para la hora; el dato que la norma mira es otro y ya tiene su pregunta firmada (SCRUM-1102).

## Lo que NO se ha medido

- Ninguna base: no se sabe si hay hoy algún comercio canario o con «Sí» en el domicilio foral.
- Nada en yaqu.app ni en un navegador; ningún alta ejecutada (`registerMerchant` está leído).
- El rechazo `invoicing_es_disabled` con el flag en OFF: leído en `invoiceNumber.service.ts:448`.
- La normativa foral (TicketBAI, Batuz, Navarra), el Concierto y el Convenio. «Batuz» no aparece en
  ningún fichero del repositorio.
- Si la búsqueda de Jira ve las tildes: se buscó «Alava».
- La tanda de tests: no hay código tocado.

## Lo que me salió mal

- El barrido contó 95 líneas de «Canarias» en el código y la mayoría eran «canario», el nombre de los
  tests de control. Se vio leyendo las 144 líneas, no por el recuento. Ninguna cifra entregada sale de él.
- `salida-sonda.txt` dice «IGIC aceptados 1 de 6»: el 0 % estaba en la lista del IGIC y es un tipo
  compartido con el IVA. Lo correcto es «rechaza los 5 propios». La salida se deja como salió.
- Crucé 200k sin avisar: 129.490 al acabar la lectura, 240.965 en la siguiente medida.
- `arbol:mio` se pasó antes de la primera escritura, no antes de empezar; dio `MIO`.

## Evidencias

`docs/master/evidencias/SCRUM-1536/`: `barrido.mjs`, `sonda.cjs`, `boe.mjs`, `salida-barrido-master.txt`,
`salida-sonda.txt`, `salida-boe.txt`. El XML del BOE no se sube; va su sha256.

| lo pedido | dónde se ve |
|---|---|
| qué dice el máster sobre territorio | ① · `docs/YAQU_MASTER.md` |
| si había ticket previo | ① · SCRUM-997, SCRUM-998, SCRUM-1497 |
| qué pasa hoy con las seis | ② · `docs/master/evidencias/SCRUM-1536/sonda.cjs` |
| si el régimen no es el del ticket | ③ · `docs/master/evidencias/SCRUM-1536/salida-boe.txt` |
| visto en yaqu.app | NO HECHO → no hay pantalla que ver |
