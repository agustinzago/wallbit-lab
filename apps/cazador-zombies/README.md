# cazador-zombies

Detector de suscripciones recurrentes zombies sobre los cobros de la tarjeta
Wallbit. Corre manualmente o como cron semanal y manda un reporte por
Telegram con el listado y el ahorro potencial anual.

## Qué hace

1. Lee las transacciones recientes de la cuenta de Wallbit (por defecto 90
   días).
2. Detecta patrones recurrentes (mismo merchant, cobros mensuales o anuales).
3. Clasifica cada merchant vía un diccionario local y, cuando no hay match,
   vía Claude Haiku (`claude-haiku-4-5-20251001`).
4. Marca como zombies:
   - **Aumentos silenciosos**: cargos cuyo último monto es > umbral (default
     8%) respecto al primero.
   - **Duplicados funcionales**: dos o más suscripciones activas del mismo
     `functionalGroup` (ej. Notion + Obsidian Sync).
   - **Posibles no usados**: cargos mensuales cuyo último cobro es hace más
     de 45 días.
5. Manda el reporte por Telegram con el ahorro potencial anual.

No cancela nada. La acción la tomás vos, manualmente.

## Setup

Necesitás 3 keys:

- `WALLBIT_API_KEY` — generada desde el dashboard de Wallbit (scope `read`
  alcanza).
- `ANTHROPIC_API_KEY` — consola de Anthropic. Sólo se usa para clasificar
  merchants no cubiertos por el diccionario hardcodeado.
- `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` — lo creás con @BotFather y el
  chat ID lo obtenés desde cualquier mensaje que le mandes al bot.

Copiá `.env.example` a `.env` y completá.

## Cómo correr

```bash
# Dry run: muestra el reporte por consola, no manda Telegram.
pnpm hunt:dry

# Producción: manda Telegram.
pnpm hunt
```

El flag `DRY_RUN` viene en `true` por default en `.env.example` a propósito:
primer paso es ver el reporte antes de conectarlo al canal.

## Cómo interpretar el reporte

El reporte lista los zombies en 3 categorías:

- **🔇 Aumentos silenciosos** (alta confianza): el precio subió sin aviso
  visible. Decidí si seguís pagando al nuevo precio.
- **👯 Duplicados funcionales** (media confianza): pagás dos servicios que
  hacen lo mismo. Cancelá el que uses menos.
- **👻 Posibles no usados** (baja confianza): saltó un ciclo de cobro. Puede
  ser que el servicio cambió de precio/moneda, o que de verdad lo cancelaste
  y no te acordás. Verificá.

## Cron sugerido

Semanal, los lunes a la mañana:

```cron
0 10 * * 1
```

## Costo de tokens

El diccionario hardcodeado en
[dictionary.ts](../../packages/merchant-classifier/src/dictionary.ts) cubre
los SaaS comunes (Netflix, Spotify, OpenAI, GitHub, Vercel, 1Password,
etc.). Sólo merchants desconocidos consumen tokens de Claude Haiku, y cada
descriptor único se clasifica una sola vez por sesión (cache en memoria).

Para un análisis típico de 90 días con ~15 suscripciones donde ~12 están en
el diccionario, se hacen ~3 llamadas a Claude Haiku. A los precios actuales
de Haiku es costo despreciable (fracción de centavo).
