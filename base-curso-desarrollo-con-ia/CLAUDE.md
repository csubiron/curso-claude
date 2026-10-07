# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Resttek: plataforma de gestión de restaurantes. Monorepo con npm workspaces (`packages/*`):

- `api`: Express 5 + TypeScript (ESM) + SQLite, puerto 3000.
- `web-admin` (:4200), `web-empleados` (:4201) y `web-clientes` (:4202): Angular 21 (standalone, signals, zoneless).
- `web-shared`: librería Angular con auth, interceptores y login/registro. Se consume desde el fuente (`main: src/index.ts`, más un alias en el `tsconfig.json` de cada app) y no se compila. Si cambia algo en ella, hay que reiniciar el dev server del frontend.

Hay documentación detallada en `docs/`: `arquitectura/` (general, API y frontend), `dominio/` (glosario y modelo de datos) y `revisiones/` (inconsistencias entre la doc y el código). Si cambia el comportamiento descrito ahí, actualiza la doc.

## Comandos

Todos se lanzan desde la raíz del monorepo (esta carpeta, no `Proyecto_inicial/`):

```bash
npm install
npm run seed            # datos de prueba (INSERT OR IGNORE, idempotente)
npm run dev:api         # tsx watch src/server.ts
npm run dev:admin       # / dev:empleados / dev:clientes (necesitan la API arrancada)
npm test                # vitest run en packages/api

# Un solo test o filtrar por nombre (desde packages/api)
npx vitest run src/services/order.service.test.ts
npx vitest run -t "nombre del test"
npm run test:watch -w @resttek/api

# Build de un frontend
npm run build -w @resttek/web-admin
```

- No hay linter ni tests en los frontends. Solo `web-clientes` tiene `.prettierrc`.
- Los usuarios de prueba que crea el seed usan como contraseña su propio email (por ejemplo `admin@resttek.com` / `admin@resttek.com`).
- **sqlite3 en Windows:** si aparece `Could not locate the bindings file`, el script de instalación de `sqlite3` no se ejecutó. Se arregla con `cd node_modules/sqlite3 && npx prebuild-install -r napi`.

## Arquitectura de la API

En la API conviven **dos estilos**. Antes de tocar código, mira qué estilo aplica al dominio:

- **Hexagonal + DDD, solo en `src/contexts/employee/`** (empleados, login y registro):
  - Capas `domain/` → `application/` → `infrastructure/`.
  - `Employee` es la única entidad del proyecto: constructor privado, factory `create()` con las validaciones y getters.
  - Value objects: `Email` (en `contexts/shared`) y `Role`.
  - Casos de uso con un único `execute()`.
  - Las interfaces llevan prefijo `I`.
  - El cableado de dependencias está en `infrastructure/http/dependencies.ts`.
- **Por capas para restaurant, dish, ingredient y order:**
  - Carpetas `models/` → `repositories/` → `services/` → `controllers/` → `routes/`, con un fichero por dominio.
  - Los modelos son `interface` planas. La validación está en los servicios y en funciones `normalizeX()` de `models/` (categoría, unidad, estado).
  - Cada interfaz de repositorio (sin prefijo `I`) va en el mismo fichero que su implementación SQLite.
  - **Las dependencias se componen dentro del propio fichero de rutas.**

Otros detalles de la API:

- **Imports:**
  - Usa siempre los alias de `tsconfig.json` (`@config/`, `@errors/`, `@shared/`, `@employee/`, `@models/`, `@repositories/`, `@services/`, `@controllers/`, `@routes/`).
  - Escribe la extensión `.js` en los imports, porque el paquete es ESM con `nodenext`.
  - En los tests, los alias los resuelve `vite-tsconfig-paths`.
- **Routers anidados:** los que se montan bajo `/restaurants/:restaurantId/...` necesitan `Router({ mergeParams: true })`.
- **Rutas:** se registran en `src/app.ts` bajo `/api/v1`. Las rutas `public/*` no piden autenticación.
- **Seguridad:**
  - `authenticate` comprueba el JWT y deja el payload en `req.user`.
  - `authorize([...roles])` filtra por rol.
  - Ambos están en `contexts/shared/infrastructure/http/middlewares.ts` y responden 401/403 directamente.
  - Los roles válidos son `admin`, `manager` (en la interfaz se muestra como "gerente"), `cocinero`, `camarero` y `cliente`.
- **Errores:**
  - Lanza subclases de `AppError`, definidas en `errors/DomainErrors.ts`.
  - El `errorHandler` asigna el código HTTP según `err.name`, usando las listas `NOT_FOUND_ERRORS` (404) y `UNAUTHORIZED_ERRORS` (401). Cualquier otro `AppError` da 400 y el resto 500.
  - Si creas un error nuevo de tipo "no encontrado", añádelo a esa lista.
  - Excepción: `OrderController` hace su propio `try/catch` y no llama a `next(error)`.
- **Base de datos:**
  - `config/database.ts` exporta la instancia `dbConfig`, que envuelve `sqlite3` en promesas.
  - El esquema se crea en `runInitialMigrations()` con `CREATE TABLE IF NOT EXISTS`. No hay sistema de migraciones: los cambios de esquema en tablas que ya existen no se aplican a un `resttek.db` existente.
  - Con `NODE_ENV=test` la base de datos vive en memoria (`:memory:`).
  - Las columnas en `snake_case` se pasan a `camelCase` con alias en el propio SQL.
- **Modelo de dominio:**
  - Los clientes son filas de `employees` con `role='cliente'` y `restaurant_id=null`.
  - Al crear un pedido, cada unidad se guarda como un `order_item` aparte con `quantity: 1`.
  - Estados de un ítem: `pendiente` → `preparando` → `listo` → `entregado`.
- **Tests:**
  - Son unitarios y están junto al código (`*.test.ts`).
  - Los dobles están en `contexts/employee/application/mocks/` y `repositories/mocks/`.
  - `supertest` está instalado pero no se usa: no hay tests HTTP.

## Arquitectura del frontend

- **`web-admin` y `web-empleados`:**
  - Cada feature está en `features/<feature>/` con subcarpetas `models/`, `pages/`, `services/` y `store/`.
  - Patrón Store: un servicio `providedIn: 'root'` con signals privadas que expone en solo lectura, más el trío `loading`/`error`/datos.
  - El store llama al service con `firstValueFrom`, y los componentes solo hablan con el store.
  - `OrderStore` de `web-empleados` consulta la API cada 30 s (polling).
- **`web-clientes`:**
  - Los modelos y servicios están centralizados en `core/`.
  - Los componentes se suscriben directamente a los services con `.subscribe()`.
  - El único store es `CartStore`, que es local y no hace llamadas HTTP.
  - "Mis pedidos" y el detalle de pedido hacen polling con `setInterval` dentro del componente.
- **Auth (`web-shared`):**
  - `AuthStore` guarda la sesión en signals y en `localStorage` (`auth_token`, `auth_user`).
  - `authInterceptor` añade el Bearer token a cada petición.
  - `errorInterceptor` limpia la sesión y redirige a `/login` cuando recibe un 401.
  - `authGuard` es funcional.
- **URL de la API:**
  - `environment.apiUrl` vale `/api/v1` y el `proxy.conf.json` de cada app la reenvía a `localhost:3000`.
  - `web-clientes` y `web-shared` inyectan el token `API_URL`, mientras que `web-admin` y `web-empleados` importan `environment` directamente.
- **Roles en `web-empleados`:** el filtrado por rol solo afecta a la navegación (`computed()` en `ShellComponent`). Quien autoriza de verdad es la API.
