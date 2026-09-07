# PR · SCRUM-805 · Qué firmó el cliente — la evidencia de firma del presupuesto

> Compare: https://github.com/lwislg99/cobroflash-backend/compare/main...scrum-805-que-firmo-el-cliente

## ⛔ ESTE PR NO SE PUEDE MERGEAR TODAVÍA

Toca `prisma/schema.prisma`, y `assertSchemaSinDeriva` corre en `src/index.ts` **antes de
escuchar**: una columna que el cliente Prisma nombra y la base no tiene **no es un aviso, es un
`throw` que impide arrancar**. Mergear sin el `ALTER` aplicado **tumba producción en el siguiente
despliegue**.

Y aquí el código y el esquema **no se pueden separar** como en SCRUM-758: el camino de firma
escribe la columna, así que sin ella el cliente final no puede aceptar su presupuesto.

```sql
ALTER TABLE "quotes" ADD COLUMN     "evidencia_firma" JSONB;
```

**Secuencia:** ① dev → ② staging → ③ producción (lo aplicas tú) → ④ merge.
**Esta sesión no ha aplicado nada en ninguna base.** El preview se hizo **offline** (schema viejo →
schema actual): *«✔ control positivo: la herramienta responde (27 tablas)»* · **«✔ aditiva: ni DROP,
ni RENAME, ni TRUNCATE, ni DELETE, ni SET NOT NULL.»**

## El defecto, medido corriendo

`dev = acela/yaqu_dev_javier`, 7-sep-2026 07:12 UTC:

```
① TRAS FIRMAR · columnas que identifiquen QUÉ documento se firmó: 🔴 NINGUNA
② SE ALTERA EL CONTENIDO DESPUÉS (85 € → 385 €):
   total: 148.34 → 511.34 · firma intacta · acceptedAt intacta
   → nada en la fila puede desmentirlo
✅ CONTROL POSITIVO (albarán): detecta la alteración · no da falsos positivos
```

Limpieza verificada a 0.

## Tres correcciones al enunciado

1. 🔴 **«ningún `quote.update` escribe `lines` ni `total`» es falso**: el propio camino de firma
   los escribe al elegir tramo. **Cambia el diseño**: se sella el contenido FINAL.
2. ⚠️ **«cero menciones de pdf en 803 líneas» caducó**: SCRUM-806 entró en `main`; son 854 líneas
   y 11 menciones. Lo sustancial aguanta: la landing de firma sigue sin enlazar el PDF al firmante.
3. ⚠️ `Quote.evidence` existe, pero es del camino de admin. No se toca.

## Lo construido

- **`presupuestoSello.ts`** · canónico **propio** v:1 (decisión tuya tras la medida), que sella lo
  que **el papel enseña**: total, líneas con precio, validez, condiciones de pago, cláusulas,
  textos libres y dirección de obra. Bloque congelado de entrada. Versión **dentro** del sobre.
- **`Quote.evidenciaFirma Json?`** · aditiva, nullable, sobre de nueve claves.
- **El sellado** va en el **mismo `update`** que la firma, con el contenido final y `firmadoAt` del
  **servidor**.
- **El PDF** · certificado de evidencias con los literales del albarán **byte a byte**.
  `ip`/`ua` **nunca** se imprimen.

⛔ **Sin tocar**: `computeAlbaranContentHash` ni sus versiones congeladas · el sellador del parte ·
el camino de emisión de la factura y su huella VeriFactu · la regeneración del PDF (SCRUM-762).

## El censo (obligación 3)

271 ficheros `.ts`, 27 modelos del DMMF. Tres documentos firmables: `albaran` ✅, `parteTrabajo` ✅
(SCRUM-652), `quote` 🔴 → este ticket. **No hay un tercero sin evidencia.** Mi primer censo dijo
que sí porque preguntaba por **nombres** de columna; el criterio final se ancla en
`crypto.createHash`.

## Seis guards de la casa dispararon, atendidos uno a uno

655b (el campo **no se hereda** en una revisión) · 411 (4 exports huérfanos declarados) · 461
(censo SQL regenerado) · 601 (reparto 151→152 **con** el motivo) · 758 (mi entrada pasó de prosa
muda a casillas; **el tope no se subió**) · 222/733/765 por arrastre. **Ninguno silenciado.**

## Entrega

**Mutaciones: 3 vivas · 0 mudas · 0 ciegas**, árbol restaurado byte a byte.
**Guards de entrada:** 4 en verde.

⚠️ **Incumplimiento propio, declarado:** ejecuté una vez `npx --no-install prisma generate`. La
regla dice **nunca** `npx` para el CLI de Prisma. Sin red y sin tocar base, pero incumplí la letra.
Rehecho con `npm run prisma:generate`.

📌 **Hallazgo reportado, no arreglado (regla 9):** `tokenId` guarda el token de firma entero en la
evidencia, siguiendo el precedente del albarán. Ese token es una credencial pública viva.
Cambiarlo sólo aquí dejaría dos criterios, y cambiar el del albarán es tocar su sellado (STOP
AA1.4). Queda para el ticket de seguridad que corresponda.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
