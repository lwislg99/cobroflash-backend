# SCRUM-1126 · fusionar dos clientes duplicados desde la ficha

**Medido contra:** `origin/main` = `3700de42ef552b5da5689f375084d8be8ff47157` · 2026-09-29T16:56:38Z (J2, equipo de Javier)

## Qué pasaba

`GET /admin/customers/:id/fusion-preview` y `POST /admin/customers/:id/fusionar` (SCRUM-1057)
estaban construidos y la sonda de SCRUM-1185 los daba SIN consumidor: `customerDetailView.js` tenía
0 referencias a «fusion» y nadie en `public/` llamaba a `fusion-preview`. Fusionar sólo se podía
llamando a la API a mano.

## El permiso, citado

Fusionar reasigna nueve tablas y **borra** al cliente fusionado: operación destructiva sobre datos
de cliente (STOP de CLAUDE.md). El GO de SCRUM-1057 cubría el servidor, no la pantalla.

**SCRUM-1126, comentario 17572 — transcrito por el orquestador, no leído por J2** (esta sesión no
pudo abrir Jira: el conector de Atlassian pedía autenticación y una sesión de fondo no la completa;
por eso J2 paró y lo pidió transcrito en vez de darlo por bueno de palabra):

> Se le preguntó expresamente, planteándolo así: fusionar mueve 9 tablas y el cliente fusionado
> desaparece; el GO de SCRUM-1057 se dio para el servidor; y hoy sólo se llega llamando a la API a
> mano con rol admin, mientras que con pantalla cualquier admin lo hace con dos clics.
>
> **Javier, 29-sep-2026, literal: «Go».**
>
> Queda autorizada la UI de fusión. **NO cubre:** inventar textos · tocar el servidor · otras
> acciones destructivas sobre datos de cliente.

El criterio de bloqueo (Luis, 28-sep): **con una factura emitida no se fusiona**, porque una factura
emitida no se edita ni se reasigna (regla 29). El servidor ya lo rechaza; la pantalla lo enseña.

## Qué cambia (sólo front; el servidor no se toca)

- `public/dashboard/js/customerDetailView.js`:
  - `FUSION_CLIENTE` (sin DOM, publicado en `window.fusionCliente`): textos firmados y las
    decisiones puras — `candidatos` (todos menos el de la ficha, por nombre o NIF, con la comparación
    de `buscadorDeClientes.js`), `motivo` (código del 409 → texto firmado o `null`) y `textoDelError`.
  - Botón «Fusionar con otro cliente» en la cabecera de la ficha, **sólo para admin**.
  - `abrirFusionDeClientes`: modal con buscador → elegir → `GET fusion-preview` → previsualización
    (qué se queda, qué desaparece, qué se mueve, lo contado, contactos sin empresa, etiquetas unidas,
    aviso de NIF, «no se puede deshacer») → «Fusionar» → `POST fusionar { con }` → cierra, aviso de
    éxito y la ficha del que se queda se recarga.
  - Si la previsualización ya trae `bloqueada`, se avisa ANTES y «Fusionar» queda desactivado. El
    409 del POST se maneja igual (entre mirar y pulsar alguien puede emitir una factura): se enseña
    su motivo, el modal no se cierra y no se puede reintentar.
  - La lista de candidatos se pide al servidor cada vez que se abre: nada queda guardado en el panel,
    así que el fusionado deja de ofrecerse. La lista de Clientes y la búsqueda global ya piden al
    servidor en cada pintado.
- `public/dashboard/css/styles.css`: clases `fusion-*` (nada de `style.cssText` desde JS; el foco lo
  da el `:focus-visible` global). Candidatos con `min-height: 44px`.
- `scripts/_sin-consumir-declarados.json`: las dos rutas pasan de `declaradas` a `retiradas`.
- `docs/BUGS.md`: **P2-CONT-1126b** (ver abajo).

## Textos

Firmados por el orquestador por delegación del fundador en SCRUM-1126 comentario 17575, que corrige
al 17574 (registro `docs/microcopy/2026-09-29-SCRUM-1126-fusion-de-clientes.md`). Dos correcciones
por medición, las dos hacia decir la verdad entera:

1. La línea propuesta «Pasan a {principal}: {n} presupuestos · {n} trabajos · {n} notas» contaba 3
   de lo que se mueve. Se partió en «Todo lo de… pasa a…» (lo que se mueve, sin número) y «Contados:»
   (lo que el servidor sí cuenta).
2. La primera firma de esa línea nombraba 7 de 9: faltaban solicitudes de presupuesto y correos. Los
   correos se mueven desde OTRO fichero (`registroDeEnvios.ts::reasignarClienteEnFusion`), así que un
   `grep` sobre `fusionClientes.ts` no los ve. Y se añadió «Las personas de contacto de {fusionado}
   se quedan sin empresa.», porque `desvincularYBorrar` las desvincula y no las re-enlaza.

Reusados byte a byte, con el reuso aprobado: el genérico de `patronDetalleAcciones.js` (SCRUM-1124),
el «Sin resultados para tu búsqueda» del buscador y «Cancelar». El `error` crudo del 409 y el «Failed
to fetch» del navegador **no se pintan**.

## Cómo se prueba

`tests/scrum1126-fusion-de-clientes.test.mjs` — 9 casos sobre la ficha REAL en el banco de vistas,
pulsando:

- botón sólo para admin;
- elegir pide la previsualización y **no** hace el POST; «Cancelar» tampoco;
- «Fusionar» manda UN POST con `{ con }` del elegido, cierra, avisa y recarga la ficha; al reabrir se
  vuelve a pedir la lista y el fusionado ya no sale, ni en la lista de Clientes;
- **409 `factura_emitida`: no se fusiona, se ve el motivo firmado, no se cierra, no se reintenta y el
  código crudo no sale** (con su positivo: el código sí venía en la respuesta);
- previsualización bloqueada: aviso antes, botón desactivado, el clic no llama;
- `mismo_cliente` y `cliente_no_encontrado` con su texto; un 409 desconocido, un 500 y sin red → genérico;
- `nifDistintos` avisa con los dos NIF, y sin él no avisa;
- buscar por nombre o NIF, sin acentos; el de la ficha nunca se ofrece;
- cada texto consta firmado en SCRUM-1126, la línea rechazada no consta (control negativo), los
  reusados son los de su origen, y los tres motivos son exactamente los de `MotivoRechazoFusion`.

**Mutaciones (todas CAEN), con el código quieto, fichero restaurado por sha256:** sin bloquear el
reintento tras un 409 → cae · pintar `err.code` crudo → cae · ignorar `bloqueada` → cae · avisar NIF
siempre → cae · cerrar antes de saber si fue bien → cae (2) · POST al elegir → cae (4) · lista
guardada entre aperturas → cae. Y `scrum1185-trinquete-sin-consumir` cae con el JSON viejo (las dos
rutas salen como «conectadas sin retirar») y pasa con el nuevo.

## Lo que queda fuera, y dónde vive

- **P2-CONT-1126b** (`docs/BUGS.md`): `customer_sites` no se mueve en la fusión y su FK es RESTRICT →
  un fusionado con direcciones de obra da 500. Razonado desde el esquema, NO ejecutado contra una
  base. Carril de servidor (S1); el orquestador se lo pasa a Luis.
- El singular de «Contados» no está firmado: con uno, dice «1 presupuestos».
- **Visual sin comprobar en navegador** (pide sesión de admin): la pantalla se ha medido en el banco
  de vistas, no pintada a 390 px.

---

# Tramo 30-sep-2026 · los dos textos firmados después de la entrega

**Medido contra:** `origin/main` = `8084f273fe0bc30bfe5b7e893605eb34b56d9bae` · 2026-09-30T22:35:01+01:00 (J2, equipo de Javier)

A9: comprobación → `tests/scrum1126-fusion-de-clientes.test.mjs`

**Rama:** `scrum-1126-textos-fusion`. Sólo front y textos; ni el servidor ni ninguna otra ranura.
J2 leyó los dos comentarios en Jira con sus ojos (esta vez el conector sí abría).

## Qué se aplica

| Ranura | Firma | Antes | Ahora |
| --- | --- | --- | --- |
| `todoPasa` | **fundador**, c.17647 («1-Sí lo firmo») | la lista sin direcciones de obra | añade «direcciones de obra» después de «trabajos» |
| `contados` | orquestador por delegación, c.17580 | «1 presupuestos» | singular **por elemento** con `{n}` = 1; plural con 0 y con 2+ |

Por qué hacía falta `todoPasa`: SCRUM-1291 (PR #2008, merge `8084f273`) hizo que la fusión moviera
también `customer_sites`, y la frase firmada quedó incompleta. **Posición elegida por el
orquestador**, no por el fundador (declarado en el 17647 y en el registro de aprobación).

Registros de aprobación, fechados el día de la firma: `docs/microcopy/2026-09-30-SCRUM-1126-fusion-direcciones-de-obra.md`
y `docs/microcopy/2026-09-29-SCRUM-1126-fusion-singular-contados.md`. El del 29-sep NO se toca: un
registro que nombrara a otros sería un índice a mano (`scrum709` lo cazó en la primera tanda).

## La prueba

Dos casos nuevos en `tests/scrum1126-fusion-de-clientes.test.mjs`, que **leen los literales del
registro de aprobación** en lugar de llevarlos tecleados:

- `todoPasa` es carácter a carácter el literal de 17647, en la función y en la previsualización
  montada. CONTROL: el detector ve «Se queda», que sí está. Y el literal de 17575 ya no se pinta.
- `contados`: (1,1,1) singular · (2,2,2) plural · (0,0,0) plural · (1,4,0) y (3,1,1) por elemento, y
  pintado con 1 presupuesto, 4 trabajos y 1 nota. El molde «Contados: … · …» sale del registro de 17575.

El caso antiguo «elegir pide la previsualización» tenía los dos textos viejos tecleados, «1 trabajos»
incluido. Se actualizan esas dos líneas a lo firmado: es la consecuencia directa de la firma nueva,
no un guard que se relaja.

**Mutaciones** sobre `customerDetailView.js`, restauradas con sha256. Caen las siete: siempre
singular · siempre plural (lo de antes) · singular decidido por el primer elemento · sin
«direcciones de obra» · «direcciones de obra» al final · una coma de más · 0 en singular.

⚠️ **Hallazgo del instrumento:** con la mutación «sin direcciones de obra», el caso antiguo de
textos NO cae, porque el registro del 29-sep sigue contando el `todoPasa` viejo como aprobado
(`constaAprobado` no sabe que una firma posterior lo sustituye). Esa mutación solo la caza el caso
nuevo, que lee el literal del registro concreto. No se ha cambiado el lector compartido: queda dicho.
