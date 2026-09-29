# El alta de cliente cuando se cae la conexión · SCRUM-1239

**Aprobado por el orquestador por delegación del fundador** el 28-sep-2026 — SCRUM-1239 comentario 17386.

La delegación está en `docs/equipo/limites-del-fundador.md` §«Delegación permanente», línea
«Javier, 25-sep-2026» (referencia SCRUM-1121), verificada hoy en `origin/main`.

## Textos aprobados, literales

| Ranura | Texto aprobado |
|---|---|
| `altaCliente.sinConexion` | Sin conexión. Vuelve a intentarlo cuando tengas cobertura, y mira la lista antes de crearlo otra vez. |
| `altaCliente.sinConfirmar` | Se cortó la conexión y no sabemos si el cliente se ha guardado. Mira la lista antes de crearlo otra vez. |
| `altaCliente.falloServidor` | No hemos podido completar el guardado. Inténtalo de nuevo en un rato, y mira la lista antes de crearlo otra vez. |

## Dónde y cuándo se pintan

`public/dashboard/js/customersView.js`, en el aviso del modal de alta/edición de cliente, cuando el
guardado falla:

- `sinConexion` — `err.sinRed` (el `fetch` rechazó).
- `sinConfirmar` — `err.incierto` (el POST venció el plazo: pudo guardarse, SCRUM-459).
- `falloServidor` — `err.status >= 500` sin `message` del servidor.

Sustituyen, en esos tres casos, al genérico de SCRUM-1199 («Revisa los datos…»), que mandaba a
revisar unos datos que estaban bien.

## Por qué los tres mandan a mirar la lista

En ninguno se puede saber si el cliente se guardó: `fetch` puede rechazar después de que el servidor
recibiera el POST. Afirmar «no se ha guardado» haría que el profesional lo creara otra vez, y los
duplicados ya tienen dos tickets abiertos para limpiarlos (SCRUM-1126 y SCRUM-1137).

⚠️ Los tres dependen de que `api.js` siga distinguiendo `sinRed` de `incierto`. Si esa distinción se
pierde, vuelven a firma.
