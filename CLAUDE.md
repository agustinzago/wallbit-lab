# CLAUDE.md

Este archivo le da a Claude Code contexto persistente sobre el proyecto. Lo leés al inicio de cada sesión.

## Qué es este proyecto

**Wallbit Lab** es un monorepo de experimentos construidos sobre la API pública de Wallbit (https://developer.wallbit.io/docs/quickstart). Wallbit es una fintech que ofrece cuenta en dólares con inversión directa en US, wallets cripto multi-red, tarjeta Visa Platinum y rieles locales argentinos vía Santander.

El objetivo del monorepo es hostear 5 productos independientes que resuelven distintos dolores del usuario retail argentino que cobra en USD (típicamente freelancers y remotos), con un patrón común: automatizar decisiones financieras repetitivas, detectar eventos ausentes (plata dormida, suscripciones no usadas), y aplicar análisis predictivo.

## Stack

- **Lenguaje:** TypeScript 5.5+, ESM puro.
- **Runtime:** Node 20+.
- **Package manager:** pnpm 9+ con workspaces.
- **Build orchestration:** Turborepo 2.x (sintaxis `tasks`, no `pipeline`).
- **Validación:** zod en el SDK y en todos los límites de entrada/salida.
- **Testing:** vitest.
- **Formato/lint:** Prettier + ESLint flat config + typescript-eslint.

**Regla inquebrantable:** ESM puro. Imports relativos usan `.js` aunque apunten a `.ts` (por `moduleResolution: "Bundler"` + `verbatimModuleSyntax: true`). Nada de `require`, nada de `__dirname` sin polyfill.

## Estructura

```
wallbit-lab/
├── packages/          (código compartido, reutilizable entre apps)
│   ├── wallbit-sdk           # Cliente tipado de la API de Wallbit
│   ├── wallbit-ingest        # Polling de transactions con dedup
│   ├── merchant-classifier   # Clasificación de merchants con Claude
│   ├── recurrence-engine     # Detector de patrones recurrentes
│   ├── notify                # Telegram/email/console adapters
│   └── shared-types          # Tipos y helpers compartidos
└── apps/              (productos independientes, desplegables por separado)
    ├── guita-dormida         # Detector de capital ocioso
    ├── cazador-zombies       # Detector de suscripciones zombies
    ├── nomina-autopilot      # Reglas declarativas sobre ingresos USD
    ├── coach-dolares         # DCA gamificado (backend; mobile app es repo aparte)
    └── afip-copilot          # Motor fiscal argentino
```

Las apps **nunca** importan código de otras apps. Si dos apps necesitan algo, va a `packages/`. Este es el único rule de dependencia que importa.

## Convenciones

- **Nombres de packages:** `@wallbit-lab/<nombre-package>` para packages, `@wallbit-lab/app-<nombre-app>` para apps.
- **Workspace deps:** siempre `"workspace:*"` entre paquetes internos.
- **Naming:** identificadores en inglés, comentarios en español rioplatense. Sí, suena raro, sí, es a propósito.
- **Errores:** nunca `throw new Error("string")` en el SDK ni en packages públicos. Usar las clases custom de `@wallbit-lab/sdk/errors` o crear una propia que extienda una base identificable.
- **Logs:** nada de `console.log` en código de producción. Cada package expone un logger inyectable (pino-style interface: `{ debug, info, warn, error }`). En apps se permite console.log solo en el `src/index.ts` de entry.
- **Config:** toda config por variables de entorno. Cada app tiene su propio `src/config.ts` que valida con zod y falla rápido si falta algo.
- **Zero any:** `any` está prohibido salvo con comentario `// TODO(type): ...` explicando por qué temporalmente.

## Wallbit API

- Base URL: `https://api.wallbit.io` (confirmar al probar).
- Auth: header `X-API-Key`. Keys se generan desde el dashboard del usuario.
- Scopes: `read` y `trade`. Operaciones de escritura (`POST /trades`, `POST /operations/internal`) requieren `trade`.
- Endpoints conocidos: `/api/public/v1/balance/checking`, `/balance/stocks`, `/transactions`, `/trades`, `/operations/internal`, `/assets`, `/assets/{symbol}`, `/wallets`, `/account-details`.
- Errores tipados: 401/403 (auth), 412 (KYC incompleto), 422 (validación), 429 (rate limit), 5xx (server).
- Rate limits: headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- **No hay webhooks públicos documentados al momento**: el patrón actual es polling. Cada app que necesite reaccionar a eventos usa `@wallbit-lab/wallbit-ingest`.

**Importante:** los shapes exactos de los responses no están documentados al 100%. Mantener los schemas zod flexibles (`.passthrough()` donde corresponda) y marcar con `// TODO(verify-api)` cualquier campo asumido que no está 100% confirmado. Al probar contra la API real, ajustar schemas.

## Cómo agregar algo nuevo

**Agregar un package compartido:**
1. Crear carpeta en `packages/<nombre>/`.
2. Copiar `package.json` y `tsconfig.json` de un package existente como template.
3. Ajustar name a `@wallbit-lab/<nombre>`.
4. Si depende de otro package interno, agregar `"@wallbit-lab/<dep>": "workspace:*"`.
5. `pnpm install` en la raíz.
6. Importar desde apps con `import { ... } from "@wallbit-lab/<nombre>"`.

**Agregar una app nueva:**
1. Crear carpeta en `apps/<nombre>/`.
2. Copiar de una app existente. Ajustar name a `@wallbit-lab/app-<nombre>`.
3. Declarar dependencias workspace que necesite.
4. Entry en `src/index.ts`.

**Agregar un endpoint nuevo al SDK:**
1. Archivo en `packages/wallbit-sdk/src/endpoints/<recurso>.ts`.
2. Definir schema zod de request y response.
3. Método en el cliente agrupado por recurso (`client.<recurso>.<accion>`).
4. Test en `<recurso>.test.ts` con mock de fetch.
5. Re-exportar tipos públicos desde `src/index.ts`.

## Qué Claude NO debe hacer en este repo

- **No agregar bibliotecas "por las dudas".** Cada dependencia nueva pasa por justificación.
- **No crear frameworks** dentro del monorepo. Si algo parece un framework, separarlo a su propio repo OSS.
- **No mezclar lenguajes.** Si una idea necesita Python (ej: Polars pesado en afip-copilot), se saca a un repo aparte y se consume el SDK como paquete publicado.
- **No implementar UI dentro de las apps backend.** Si una app necesita UI web, es un package aparte en `apps/<nombre>-web/` (Next.js, sveltekit, lo que sea).
- **No tocar `tsconfig.base.json`** sin justificar muy bien. El strict config es consciente.
- **No cambiar estructura de carpetas** sin preguntar. El layout está pensado.

## Orden de implementación sugerido

1. **Scaffold inicial** (este primer paso).
2. **`packages/wallbit-sdk` v0.1**: cliente tipado con los endpoints básicos funcionando contra la API real.
3. **`packages/notify` con adapter Telegram**: porque todo va a reportar por Telegram.
4. **`apps/cazador-zombies` v0.1**: primera app real. En el proceso decanta qué sale de la app y va a `packages/` (merchant-classifier, recurrence-engine).
5. **`apps/guita-dormida` v0.1**: segunda app, reutiliza ingest + notify.
6. A partir de acá el orden lo define el usuario según prioridades.

## Decisiones cerradas (no reabrir sin razón fuerte)

- TypeScript, no Python, en el monorepo.
- pnpm, no npm/yarn/bun.
- Turborepo, no Nx.
- ESM, no CommonJS, no dual.
- zod para validación, no io-ts, no valibot, no yup.
- vitest, no jest.
- Monorepo con packages compartidos, no repos separados.
