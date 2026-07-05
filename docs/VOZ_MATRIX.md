# VOZ_MATRIX — Compatibilidad del dictado por voz (VZ-1, master U1.5)

> Componente: `public/dashboard/js/voiceInput.js`. Estrategia: **allowlist conservadora
> + prueba de humo real en el primer tap**. Si cualquier check falla, el micro NO se
> pinta (o se retira con un toast humano) y queda el textarea — jamás un botón roto.
> El micro solo existe con el flag `VOICE_QUOTE_ENABLED` activo (OFF por defecto;
> activación = fundador, PENDIENTES_FUNDADOR).

## Cadena de decisión (implementada)

1. **Gate estático** (no se pinta el micro si falla): flag activo · existe
   `SpeechRecognition`/`webkitSpeechRecognition` · `isSecureContext` (https) ·
   NO (iOS && PWA standalone) · no falló el humo antes en esta sesión.
2. **Prueba de humo en el 1er tap**: `start()` con watchdog de 3 s. Sin `onstart`,
   o `error ∈ {not-allowed, service-not-allowed, audio-capture}` → toast
   ("El dictado no está disponible…" / "Sin permiso de micrófono…"), se retiran
   TODOS los micros y `sessionStorage.voiceUnsupported=1` (no se reintenta en la sesión).
3. **Errores en caliente**: `no-speech` → "No te he oído — prueba otra vez";
   `network/aborted` → cierre limpio. Lo ya dictado NUNCA se pierde (queda en el textarea).
4. Interim en gris bajo el textarea; confirmado se APPENDEA (editable siempre);
   `lang = es-ES` (del locale). Puntos de montaje: modal "Sugerir con IA" (formulario)
   y botón "🎤 Dictar el trabajo" en la Cotización rápida.

## Matriz de dispositivos

| Entorno | Micro visible | Permisos | https | Ruido | Resultado |
|---|---|---|---|---|---|
| **Chrome Android (gama media)** | ⏳ HUMANO | ⏳ | ⏳ | ⏳ | ⏳ pendiente de prueba real (fundador, tipo V0-5) |
| **Chrome Android (gama alta)** | ⏳ HUMANO | ⏳ | ⏳ | ⏳ | ⏳ pendiente de prueba real (fundador) |
| **Chrome/Edge desktop (Windows)** | ✅ se pinta (API + https OK) | prompt del navegador | ✅ yaqu.app | n/a | ⚠️ Verificado el CAMINO DE DEGRADACIÓN en headless (sin micro físico): watchdog + retirada + toast funcionan. El camino positivo con micro real: pendiente humano |
| **Safari iOS (pestaña)** | ✅ se pinta → humo decide | iOS pide permiso | ✅ | ⏳ | ⏳ HUMANO — errático conocido: si falla, el humo lo retira con toast (verificar que la degradación se siente bien) |
| **iOS PWA (añadida a inicio)** | ❌ NO se pinta (gate estático) | n/a | n/a | n/a | ✅ por diseño: API declarada pero rota en iOS standalone → fuera |
| **Firefox (cualquiera)** | ❌ NO se pinta (sin API) | n/a | n/a | n/a | ✅ por diseño: degradación silenciosa |

**Notas de la verificación headless (5-jul-2026):** en Edge/Chrome headless
`webkitSpeechRecognition` existe pero el servicio de audio no arranca → exactamente el
caso que cubre el humo (watchdog 3 s → toast → micro fuera). Es la validación del peor
caso; el caso feliz exige micrófono físico (matriz humana de arriba).

**Qué probar en los móviles reales (guion de 2 min por dispositivo):**
1. Abrir Cotización rápida → ¿se ve "🎤 Dictar el trabajo"? → tap → ¿pide permiso?
2. Conceder → dictar "cambio de termo de 80 litros y desplazamiento" → ¿aparece el
   interim en gris y el texto final en el cuadro? → ¿editable?
3. Denegar permiso (otro dispositivo/reset) → ¿toast humano y el micro desaparece?
4. Con ruido de calle/radio → ¿el resultado sigue siendo usable?
