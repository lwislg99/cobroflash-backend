# Capturas de Housecall Pro · qué es cada una y qué prueba

**Tomadas el 20 y 21-sep-2026** de su **web pública y su centro de ayuda** (`help.housecallpro.com`),
leídas y fotografiadas en el navegador. **Sin alta, sin dar ningún dato y sin entrar en el
producto.** Las seis primeras son del 20-sep y estaban fuera de git; las dos últimas, del 21-sep.

| fichero | qué enseña | qué propuesta sostiene |
|---|---|---|
| `ficha-del-equipo-campos.png` | La ficha del equipo (*Property Profile*): **tipo y nombre obligatorios**; marca, modelo, nº de serie, fecha de instalación y notas, opcionales | **Equipos v1** (matriz §14.3.3) |
| `alta-del-equipo-desde-el-trabajo.png` | El equipo se da de alta **desde el trabajo** (botón *Property Profile* a la izquierda) | Equipos v1 |
| `alta-del-equipo-desde-la-direccion.png` | …y **desde la dirección del cliente** (⋮ → *New property item*). Cuelga de la dirección, no del cliente | Equipos v1 |
| `equipo-atado-al-plan.png` | El equipo se ata a un plan de servicio y la relación **se ve desde el equipo** | Equipos v1 (`equipmentId` en el plan de mantenimiento) |
| `lista-ultimo-servicio-y-csv.png` | La lista de equipos: filtra por tipo, **fecha de último servicio** e instalación; ordena por cliente o por último servicio; exporta CSV | **Última visita en la lista de clientes** (§14.3.2) y Equipos v1 |
| `equipos-en-el-plan-esencial.png` | Su página de precios: los equipos se desbloquean en **Essentials (229 $/mes)**. ⚠️ El chat y el *tour* de su web tapan parte; se ve la línea *Equipment tracking* | Solo contexto: de pago por escalón |
| `ficha-del-cliente-pestanas.png` | *Customer Profile Tabs*: **Profile · Estimates · Jobs · Invoices · Attachments · Notes**, y en su propia captura la cabecera del cliente con pestañas, mapa y direcciones | **La ficha del cliente con su historial** (§14.3.1) |
| `ficha-del-cliente-fotos-en-linea-de-tiempo.png` | *Customer Attachments Section*: *«a complete aggregation of a customer's attachments across their profile, jobs, estimates, and equipment in a timeline view»*, por fecha descendente | La ficha del cliente con su historial (fase de fotos) |

## Lo que estas capturas NO son

🔴 **Son su marketing y su manual, no su producto funcionando.** Nadie ha entrado en Housecall Pro:
no hay cuenta y no se pidió, porque un alta en un tercero la autoriza el fundador (A19). Sirven para
saber **qué forma le han dado a la ficha del cliente y a la del equipo**, y no para afirmar cómo se
comporta.

El texto literal de cada página se leyó aparte, a `textContent` (nunca con `WebFetch`, por el motivo
que explica «Límites» en [`../../matriz.md`](../../matriz.md)). Ese texto **no está en git** (pesa
decenas de KB por página, casi todo ruido de su web): vive en la máquina de la sesión, y las citas
del §14 vienen de él y no de leer la imagen.
