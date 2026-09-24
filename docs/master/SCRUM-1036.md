# SCRUM-1036 · Notas del cliente con fecha y autor (hoy es un único texto)

**Medido contra:** `origin/main` = `e2f715939d0e27ca2661821e1b57292d4ec1c3cc` · 2026-09-22T09:03:27Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`)
**Rama:** `scrum-1036-notas-del-cliente`

## Confirmado antes de construir (regla 3/A5)

El ticket exige confirmar el diseño propuesto (una nota = `CustomerEvent` de `type: 'nota'`) antes
de tocar código, y PARAR si hiciera falta ALTER. Confirmado: el modelo `CustomerEvent`
(`schema.prisma`) ya tiene `type`/`title`/`detail`/`meta`/`createdAt`. **Cero ALTER.**

## D1 · Ficheros de J2

El ticket marca `customerAdmin.ts` y `customerDetailView.js` como J2. Se tocó
`customersAdmin.routes.ts` (hermano de `customerAdmin.ts`, misma carpeta) y
`customerEvents.service.ts` — avisado en un comentario del ticket antes de empezar. No se tocó
`customerDetailView.js` (front, S2).

## Lo que hace

- `src/modules/system/domain/notasDelCliente.ts` (nuevo):
  - **El texto va en `title`**, no en `detail`: la ficha (`customerDetailView.js`) ya pinta `title`
    en negrita como contenido principal de un evento, y la nota ES el contenido — no la
    descripción de un hecho del sistema.
  - **`crearNota`**: rechaza texto vacío/solo espacios (`nota_vacia`); comprueba tenencia
    (`customer_not_found` si el cliente no es de este merchant); guarda `meta: {authorName,
    teamMemberId}`. **Sin tope de largo** — el ticket lo deja explícito: «el tope lo decide J2:
    preguntar, no inventarlo» (regla 27).
  - **`resolverAutor`**: `teamMemberId: null` → nombre del NEGOCIO (misma convención que
    `desglosarPorEmpleado`, SCRUM-228); si no, el nombre del `TeamMember`; si no se encuentra
    (borrado a mitad, o de otro merchant), `'Desconocido'` — nunca se inventa un nombre.
  - **El autor se CONGELA como texto** en el momento de escribir, nunca se resuelve en vivo: un
    técnico borrado después no deja sus notas antiguas sin autor (caso límite explícito del
    ticket). Mismo patrón que el cliente/emisor congelados de las facturas (SCRUM-665/729).
  - **`listarNotas`**: de la más nueva a la más antigua (`createdAt desc, id desc` — orden
    estable si dos notas caen en el mismo segundo); añade la **«Nota fija»** (el literal que el
    propio ticket ya escribió entre comillas — regla 39, propuesto por el fundador, no inventado
    aquí) al FINAL, sintetizada desde `Customer.notes` **SOLO si tiene contenido** — un `notes`
    vacío no crea Nota fija (caso límite explícito). `fecha: null` y `autor: null` en la Nota fija:
    ausente ≠ vacío, no se inventa una fecha ni un autor que el texto viejo nunca tuvo.
  - **`Customer.notes` NO se borra ni se copia a `CustomerEvent`**: copiarlo sería un backfill, y
    esta casa ya aprendió con SCRUM-729 que un backfill fabrica datos que nadie declaró.
- `customerEvents.service.ts` (`listCustomerEvents`, la lista de «Actividad reciente»): ahora
  excluye `type: 'nota'` — una nota es una anotación PRIVADA del profesional, no un hecho que le
  pasó al cliente, y tiene su propia sección. Mezclarlas la duplicaría en las dos listas.
- Rutas nuevas en `customersAdmin.routes.ts`: `GET /admin/customers/:id/notes` y
  `POST /admin/customers/:id/notes` (`{ texto }`; el autor sale de la SESIÓN, nunca del cuerpo).
  `requireRole('admin')` en las dos (SCRUM-55): sin motivo de campo declarado, default admin-only
  — mismo criterio que `/whatsapp` (SCRUM-1062).

## El juez: `tests/scrum1036-notas-del-cliente.test.mjs`

Gateado (banco desechable o staging), declarado en `GATEADOS_DECLARADOS` de `scrum419`. Cubre:
`resolverAutor` (propietario, técnico, id fantasma) · texto vacío rechazado · tenencia en
`crearNota` y en `listarNotas` · orden (más nueva primero) · autor correcto por nota · Nota fija al
final con fecha/autor ausentes · un `notes` vacío no sintetiza nada · `Customer.notes` sigue en la
base tras crear notas · **el autor de una nota se conserva tras BORRAR al técnico que la escribió**
(el caso límite más importante del ticket).

No se pudo correr en esta sesión: no hay un Postgres desechable montado en esta máquina/turno.

`npm run build` limpio. `guards:entrada` 95/95. `scrum55` (fail-closed) y `scrum411`
(huérfanos) en verde: las dos rutas nuevas declaran rol y los tres exports nuevos tienen
consumidor real (la ruta), nada huérfano.

## Declarado, sin arreglar aquí

- La pantalla de notas en la ficha (S2) y su microcopy propio (botón «Añadir nota», etc. — el
  literal «Nota fija» ya viene firmado por el ticket; lo demás lo propone S2).
- Ningún cambio al resto de tipos de `CustomerEvent`.
