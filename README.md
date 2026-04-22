# Wallbit Lab

Monorepo de experimentos sobre la API pública de [Wallbit](https://developer.wallbit.io/docs/quickstart).

Cinco productos independientes construidos sobre una capa compartida de SDK, ingest, clasificación, detección de recurrencias y notificaciones.

## Apps

| App | Qué hace |
| --- | --- |
| `guita-dormida` | Detector de capital dormido: cruza balances, stocks y cripto contra el gasto real para detectar plata ociosa. |
| `cazador-zombies` | Detector de suscripciones zombies, duplicadas y con aumentos silenciosos; genera guías de cancelación. |
| `nomina-autopilot` | Motor declarativo que dispara splits configurados (checking / inversión / cripto / pesos) al recibir un ingreso. |
| `coach-dolares` | DCA semanal con gamificación (rachas, niveles, misiones); backend consumido por un cliente mobile. |
| `afip-copilot` | Motor fiscal argentino: Bienes Personales proyectado, Ganancias por dividendos, simulaciones y PDF para el contador. |

## Packages

| Package | Rol |
| --- | --- |
| `@wallbit-lab/sdk` | Cliente tipado de la API de Wallbit (fetch + retry + zod). |
| `@wallbit-lab/shared-types` | Tipos de dominio compartidos entre apps (monetario, notificaciones, config de usuario). |
| `@wallbit-lab/wallbit-ingest` | Polling de transactions con dedup y cursor persistido; emisor de eventos. |
| `@wallbit-lab/merchant-classifier` | Clasificación de descriptores de merchants via Claude Haiku, con cache. |
| `@wallbit-lab/recurrence-engine` | Detección de patrones recurrentes (cadencia + monto con tolerancia). |
| `@wallbit-lab/notify` | Adapters para Telegram, email (Resend) y console sobre una interfaz común. |

## Requisitos

- Node.js `>= 20` (ver [`.nvmrc`](./.nvmrc))
- pnpm `>= 9`
- Una API key de Wallbit (ver [docs](https://developer.wallbit.io/docs/quickstart))

## Setup

```bash
# 1. Clonar e instalar
git clone <url-del-repo> wallbit-lab
cd wallbit-lab
pnpm install

# 2. Variables de entorno
cp .env.example .env
# editar .env con la API key y demás secretos

# 3. Build inicial (compila packages en orden topológico)
pnpm build
```

## Scripts

Todos los scripts raíz son delegados a Turborepo y corren en todos los workspaces.

| Script | Qué hace |
| --- | --- |
| `pnpm build` | Compila cada package/app (respeta dependencias con `^build`). |
| `pnpm dev` | Corre `dev` en todo el monorepo (watchers en paralelo). |
| `pnpm lint` | Corre ESLint en todo el monorepo. |
| `pnpm typecheck` | `tsc --noEmit` en todos los packages/apps. |
| `pnpm test` | Corre los tests (Vitest) de los packages que tengan. |
| `pnpm clean` | Borra `dist/`, `.turbo/` y `node_modules/` raíz. |
| `pnpm format` | Prettier sobre todos los archivos soportados. |

## Desarrollo

### Correr una app específica

```bash
# Desde la raíz
pnpm --filter @wallbit-lab/app-guita-dormida dev

# O entrando al workspace
cd apps/guita-dormida
pnpm dev
```

### Agregar una dependencia interna a un workspace

```bash
# Ejemplo: que `cazador-zombies` use `notify`
pnpm --filter @wallbit-lab/app-cazador-zombies add @wallbit-lab/notify@workspace:*
```

### Agregar una dependencia externa

```bash
# A un package específico
pnpm --filter @wallbit-lab/sdk add zod

# A la raíz (solo devDependencies del monorepo)
pnpm add -D -w <paquete>
```

### Tests del SDK

```bash
pnpm --filter @wallbit-lab/sdk test
```

## Licencia

MIT.
