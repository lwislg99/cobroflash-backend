# La descarga del libro de facturas recibidas · SCRUM-1249

**Aprobado por el orquestador por delegación del fundador** el 28-sep-2026 — SCRUM-1249 comentario 17432.

La delegación está en `docs/equipo/limites-del-fundador.md` §«Delegación permanente».

## Texto aprobado, literal

| Ranura | Texto aprobado |
|---|---|
| `descargar` | Descargar CSV |
| `preparando` | Preparando la descarga… |
| `descargaVacia` | No hay facturas recibidas en este periodo. |
| `descargaLista` | Descarga lista. |
| `descargaFallida` | No hemos podido preparar la descarga. Inténtalo otra vez. |

## Dónde y cuándo se pinta

`public/dashboard/js/facturasRecibidasView.js`, `FACTURAS_RECIBIDAS_COPY`, pantalla «Facturas recibidas»:

- `descargar`: el botón junto a «Consultar». Pide `GET /admin/libros/recibidas.csv` con el año y el
  trimestre del selector.
- `preparando`: el mismo botón mientras dura la descarga.
- `descargaVacia`: aviso cuando el fichero llega con `X-Yaqu-Filas: 0`.
- `descargaLista`: aviso cuando llega con filas.
- `descargaFallida`: aviso si la descarga falla por cualquier motivo que no sea el tipo de fichero.
  Ese caso lo cubre `mensajeDescargaFallida` de `api.js`, que ya existía y no es de este ticket.

## Por qué «Inténtalo otra vez» es seguro aquí

Una descarga que falla no deja nada a medias: es una lectura. Repetirla es inofensivo. Es lo
contrario del alta de clientes de SCRUM-1239.

## ⚠️ La dependencia de `descargaVacia`

El texto **afirma un hecho sobre los datos del profesional** («no hay facturas recibidas») a partir
de que el fichero salga vacío. Hoy es cierto por dos motivos, medidos:

1. El fichero (`recibidas.csv`) y la tabla (`recibidas.json`) salen del mismo motor,
   `leerLibroRecibidasDelTrimestre`.
2. Pulsar «Descargar CSV» recarga la tabla con el mismo periodo que el fichero.

Si alguien desacopla el fichero de la tabla, este texto miente: tres facturas en pantalla y un aviso
diciendo que no hay ninguna. **Entonces vuelve a firma.** Lo vigila
`tests/scrum1249-descarga-recibidas-alcanzable.test.mjs` («pulsar SOLO la descarga recarga la tabla
con el MISMO periodo que el fichero»).

## Qué queda sin firmar en esta pantalla

Lo que ya estaba marcado con `[PENDIENTE microcopy oficial]` desde SCRUM-1040 sigue igual: título,
error, vacío y descuadre. Este ticket no lo toca.
