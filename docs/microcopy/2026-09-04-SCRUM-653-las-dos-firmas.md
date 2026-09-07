# Los textos de las DOS firmas del parte

**Aprobado por el fundador** el 4-sep-2026, en **SCRUM-653**.
**Aplicado en el mismo acto** (regla 30).

Son los cinco textos que la rama de las dos firmas trae a la pantalla del parte. Llegaron con
marcador —nadie los había firmado— y se listaron en vez de inventarlos.

## Textos aprobados, literales

| Ranura | Texto aprobado |
|---|---|
| `firmarTecnico` | Firma del técnico |
| `yaFirmoElCliente` | Firmado por el cliente |
| `yaFirmoElTecnico` | Firmado por el técnico |
| `faltaLaFirmaDelCliente` | Falta la firma del cliente para cerrar el parte. |
| `faltaLaFirmaDelTecnico` | Falta la firma del técnico para cerrar el parte. |

Todos en `public/dashboard/js/parteDetailView.js`.

## 🔴 El cuarto no se aprobó como estaba: se partió en DOS

La rama traía **una sola** clave, `faltaUnaFirma`, con el texto «Falta una firma para cerrar el
parte.». **No dice cuál falta**, y el control negativo de SCRUM-653 exige literalmente que se diga:
el técnico está de pie en un cuarto técnico con el móvil en la mano, y un aviso que no nombra lo que
falta le obliga a adivinar.

Así que la clave se **partió en dos** y el aviso pasó a nombrar la que falta — **y si faltan las dos,
se dicen las dos**. Por eso `PARTE_TEXTOS` pasa de 31 a **32**: 27 firmados en SCRUM-720 + 5, no + 4.
Si saliera 31, se habría sustituido en vez de partir.

## La puntuación es deliberada

**Etiquetas de estado sin punto final** —«Firma del técnico», «Firmado por el cliente»— y **frases
con punto** —«Falta la firma del cliente para cerrar el parte.»—. No es un descuido: son dos cosas
distintas, un rótulo y una frase.

Nótese que dos de ellos **cambiaron** respecto a lo que traía la rama: «Firmado por el cliente.» y
«Firmado por el técnico.» llevaban punto y son etiquetas de estado, así que lo pierden.
