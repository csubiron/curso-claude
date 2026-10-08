# Gestión de mesas

| | |
|---|---|
| **Issue** | [#6](https://github.com/csubiron/curso-claude/issues/6) |
| **Estado** | Borrador |
| **Autor de la issue** | @csubiron |
| **Fecha** | 2026-10-08 |
| **Etiquetas** | `feature`, `proyecto:api`, `proyecto:web-admin`, `proyecto:web-empleados`, `proyecto:web-clientes` |

## 1. Contexto

Hoy Resttek no tiene mesas. La tabla `orders` tiene una columna `table_id`, pero no apunta a nada, y `web-clientes` la envía siempre a `null` (`core/services/order.service.ts`). Los empleados ven `Mesa {{ order.tableId }}` en cocina, barra y salón, pero ese valor nunca llega relleno.

La issue pide tres cosas:

- **Clientes:** al entrar en un restaurante, indican cuántas personas son, eligen una mesa libre con capacidad suficiente y, al pulsar "Continuar", la mesa pasa a ocupada. Después van a la carta y envían el pedido, que queda asociado a esa mesa.
- **Administrador:** gestiona las mesas de cada restaurante (CRUD). Cada mesa tiene id, número, descripción, capacidad y estado (`libre`, `ocupada` o `reservada`).
- **Empleados:** ven el estado de las mesas, pueden cambiarlo y ven el estado de los pedidos de las mesas ocupadas.

La issue no tiene comentarios. El plan se divide por aplicación (API, web-admin, web-empleados y web-clientes), según ha pedido el usuario al planificar.

## 2. Alcance

**Incluido**
- Nuevo dominio `table` en la API, por capas, igual que `ingredient`:
  - Tabla `tables`.
  - CRUD para admin y cambio de estado para empleados.
  - Consulta pública de mesas disponibles y ocupación de una mesa por parte de un cliente.
- Datos de prueba de mesas en el seed.
- web-admin: CRUD de mesas dentro de cada restaurante.
- web-empleados: nueva página "Mesas" con el estado de cada mesa, el cambio de estado y los pedidos de las mesas ocupadas.
- web-clientes: paso de selección de mesa entre la lista de restaurantes y la carta, y envío del `tableId` con el pedido.
- Actualización de `docs/` (modelo de datos, glosario, endpoints y frontend).

**Excluido**
- **Liberar la mesa automáticamente al terminar el pedido o al pagar.** La liberan los empleados cambiando el estado a mano, porque la issue no define cuándo termina una ocupación.
- **Reservas con fecha y hora.** `reservada` es solo un estado manual.
- **Comprobar que el empleado pertenece al restaurante de la mesa.** Ningún endpoint del proyecto lo comprueba hoy (`ingredients`, `dishes`…). Se deja para una issue transversal.
- **Validar en `POST /orders` que el `tableId` existe y pertenece al restaurante.** Hoy `OrderController` no valida nada de eso. Se anota como riesgo.
- **Mostrar el número de mesa en lugar del id en cocina, barra y salón.** La issue no lo pide.
- **Tests en los frontends.** No tienen runner de tests: las tareas de frontend se verifican con su build.

## 3. Comportamiento esperado

### 3.1 El administrador crea una mesa

**Dado** un admin autenticado en web-admin
**Cuando** entra en *Restaurante → Mesas → Nueva mesa*, rellena número `5`, descripción `Terraza`, capacidad `4` y guarda
**Entonces** la API responde `201` con la mesa en estado `libre` y la mesa aparece en el listado.

Si ya existe una mesa con el número `5` en ese restaurante, la API responde `400` con `DuplicatedTableNumberError` y el formulario muestra el error.

### 3.2 El administrador edita o borra una mesa

**Dado** una mesa existente
**Cuando** el admin la edita, o la borra después de confirmar
**Entonces** el listado se actualiza.

No se puede borrar una mesa ocupada: la API responde `400` con `TableOccupiedError`.

### 3.3 El cliente elige mesa

**Dado** un cliente autenticado en web-clientes
**Cuando** pulsa un restaurante
**Entonces** va a `/restaurants/:id/table`, donde se le pide el número de personas (entero de 1 o más).

**Cuando** indica `3` personas
**Entonces** ve las mesas `libre` con capacidad de 3 o más, ordenadas por capacidad y por número. Si no hay ninguna, ve el mensaje "No hay mesas disponibles para 3 personas".

**Cuando** elige una mesa y pulsa "Continuar"
**Entonces**:
- La API marca la mesa como `ocupada` (`200` con la mesa).
- El cliente va a la carta (`/restaurants/:id`), que muestra "Mesa N".
- Al confirmar el pedido en el carrito, el pedido se envía con ese `tableId`.

**Cuando** otro cliente ha ocupado esa mesa justo antes
**Entonces** la API responde `400` con `TableNotAvailableError`, se muestra "Esa mesa ya no está disponible" y se recarga la lista.

### 3.4 El cliente entra en la carta sin mesa

**Dado** un cliente que abre `/restaurants/:id` sin haber elegido mesa en ese restaurante
**Entonces** se le redirige a `/restaurants/:id/table`.

### 3.5 Los empleados gestionan las mesas

**Dado** un empleado (`manager`, `camarero` o `cocinero`) en web-empleados
**Cuando** abre "Mesas"
**Entonces** ve todas las mesas de su restaurante con número, descripción, capacidad y estado. La lista se refresca cada 30 s.

**Cuando** cambia el estado de una mesa
**Entonces** la API responde `200` con la mesa actualizada y la vista lo refleja.

**Y** en cada mesa `ocupada` ve sus pedidos activos (los que salen de `GET /orders/active` con ese `tableId`), con cada plato y su estado (`pendiente`, `preparando`, `listo` o `entregado`).

## 4. Diseño técnico

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `packages/api/src/models/table.model.ts` | Nuevo: `Table`, `TableStatusType` y `normalizeTableStatus()` |
| `packages/api/src/errors/DomainErrors.ts` | Errores nuevos: `InvalidTableStatusError`, `InvalidTableNumberError`, `InvalidCapacityError`, `InvalidPeopleCountError`, `DuplicatedTableNumberError`, `TableNotFoundError`, `TableNotAvailableError` y `TableOccupiedError` |
| `packages/api/src/contexts/shared/infrastructure/http/errorHandler.ts` | Añadir `TableNotFoundError` a `NOT_FOUND_ERRORS` |
| `packages/api/src/config/database.ts` | `CREATE TABLE IF NOT EXISTS tables` |
| `packages/api/src/repositories/table.repository.ts` | Nuevo: interfaz `TableRepository` + `SqliteTableRepository` |
| `packages/api/src/repositories/table.repository.test.ts` | Nuevo: tests de integración con SQLite en memoria |
| `packages/api/src/repositories/mocks/MockTableRepository.ts` | Nuevo: doble en memoria |
| `packages/api/src/services/table.service.ts` (+ `.test.ts`) | Nuevo: validaciones y reglas |
| `packages/api/src/controllers/table.controller.ts` | Nuevo |
| `packages/api/src/routes/table.routes.ts` | Nuevo: `Router({ mergeParams: true })` |
| `packages/api/src/routes/table.public.routes.ts` | Nuevo: mesas disponibles |
| `packages/api/src/app.ts` | Registrar las rutas nuevas |
| `packages/api/src/scripts/seed.ts` | Mesas de prueba para `rest-1` y `rest-2` |
| `packages/web-admin/src/app/features/tables/**` | Nuevo: `models/`, `services/`, `store/`, `pages/table-list`, `pages/table-form` y `tables.routes.ts` |
| `packages/web-admin/src/app/app.routes.ts` | Ruta hija `tables` bajo `restaurants/:restaurantId` |
| `packages/web-admin/src/app/core/layout/shell.component.html` | Enlace "Mesas" en el submenú del restaurante |
| `packages/web-admin/src/app/features/restaurants/pages/restaurant-dashboard/restaurant-dashboard.component.html` | Tarjeta "Mesas" |
| `packages/web-admin/src/app/app.config.ts` | Registrar el icono lucide nuevo |
| `packages/web-empleados/src/app/features/tables/**` | Nuevo: `models/`, `services/`, `store/` (con polling) y `pages/tables` |
| `packages/web-empleados/src/app/app.routes.ts` | Ruta `mesas` |
| `packages/web-empleados/src/app/core/layout/shell.component.{ts,html}` | `canSeeMesas` y enlace de navegación |
| `packages/web-empleados/src/app/app.config.ts` | Registrar el icono lucide nuevo |
| `packages/web-clientes/src/app/core/models/table.model.ts` | Nuevo |
| `packages/web-clientes/src/app/core/services/table.service.ts` | Nuevo: `getAvailable()` y `occupy()` |
| `packages/web-clientes/src/app/core/store/cart.store.ts` | Estado de la mesa elegida |
| `packages/web-clientes/src/app/core/services/order.service.ts` | `createOrder` recibe `tableId` |
| `packages/web-clientes/src/app/features/cart/cart.component.ts` | Envía el `tableId` del `CartStore` |
| `packages/web-clientes/src/app/features/tables/table-selection.component.{ts,html,css}` | Nuevo: selección de personas y mesa |
| `packages/web-clientes/src/app/app.routes.ts` | Ruta `restaurants/:id/table` |
| `packages/web-clientes/src/app/features/restaurants/restaurant-list.component.html` | Las tarjetas enlazan a la selección de mesa |
| `packages/web-clientes/src/app/features/menu/restaurant-menu.component.{ts,html}` | Redirección si no hay mesa y etiqueta "Mesa N" |
| `docs/dominio/modelo-datos.md`, `docs/dominio/glosario.md`, `docs/arquitectura/arquitectura-api.md`, `docs/arquitectura/arquitectura-frontend.md` | Documentar mesas |

### Enfoque

- **API:** estilo por capas, igual que `ingredient`:
  - Modelo plano con `normalizeTableStatus()` en `models/`, como `normalizeIngredientUnit()`.
  - Validaciones en `TableService`, en un `buildTable()` privado como `buildIngredient()`.
  - Interfaz y repositorio SQLite en el mismo fichero.
  - Dependencias compuestas en `table.routes.ts`.
  - El controlador usa `next(error)` (no el estilo de `OrderController`).
- **Ocupación atómica:** se hace con un único `UPDATE tables SET status = 'ocupada' WHERE id = ? AND restaurant_id = ? AND status = 'libre' AND capacity >= ?`, comprobando `changes`. Así dos clientes no pueden ocupar la misma mesa. Se descarta leer y luego escribir desde el servicio porque deja abierta esa carrera.
- **web-admin:** se copia `features/ingredients` (lista y formulario como páginas enrutadas, store con signals y `firstValueFrom`).
- **web-empleados:**
  - Feature nueva `features/tables` con un `TableStore` que hace polling cada 30 s, igual que `OrderStore`.
  - La página reutiliza `OrderStore` para cruzar los pedidos con las mesas por `tableId`.
- **web-clientes:**
  - Servicio en `core/`, igual que el resto.
  - La mesa elegida se guarda en `CartStore`, que ya es el estado local del pedido en curso.
  - La página nueva se suscribe directamente al servicio, como los demás componentes de esta app.

### Modelo de datos / contratos

**Tabla nueva:**

```sql
CREATE TABLE IF NOT EXISTS tables (
    id TEXT PRIMARY KEY,
    number INTEGER NOT NULL,
    description TEXT,
    capacity INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'libre',
    restaurant_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(restaurant_id, number),
    FOREIGN KEY(restaurant_id) REFERENCES restaurants(id)
)
```

Es una tabla nueva, así que `CREATE TABLE IF NOT EXISTS` también se aplica a un `resttek.db` existente.

**Modelo:**

```ts
type TableStatusType = 'libre' | 'ocupada' | 'reservada'

interface Table {
    id: string
    number: number
    description: string | null
    capacity: number
    status: TableStatusType
    restaurantId: string
    createdAt: string
    updatedAt: string
}
```

**Endpoints** (todos cuelgan de `/api/v1`):

| Método | Ruta | Roles | Body | Respuesta |
|---|---|---|---|---|
| `GET` | `/restaurants/:restaurantId/tables` | admin, manager, camarero, cocinero | — | `200 Table[]`, ordenadas por `number` |
| `GET` | `/restaurants/:restaurantId/tables/:id` | admin, manager, camarero, cocinero | — | `200 Table` / `404` |
| `POST` | `/restaurants/:restaurantId/tables` | admin | `{ number, description?, capacity, status? }` | `201 Table` |
| `PUT` | `/restaurants/:restaurantId/tables/:id` | admin | `{ number, description?, capacity, status }` | `200 Table` |
| `DELETE` | `/restaurants/:restaurantId/tables/:id` | admin | — | `204` |
| `PATCH` | `/restaurants/:restaurantId/tables/:id/status` | admin, manager, camarero, cocinero | `{ status }` | `200 Table` |
| `POST` | `/restaurants/:restaurantId/tables/:id/occupy` | cliente | `{ people }` | `200 Table` / `400 TableNotAvailableError` |
| `GET` | `/public/restaurants/:restaurantId/tables?people=N` | público | — | `200 Table[]` (solo `libre` y `capacity >= N`) |

`POST /orders` no cambia: ya acepta `tableId`.

## 5. Casos borde y errores

| Situación | Comportamiento esperado |
|---|---|
| `number` ausente, no entero o menor que 1 | `400 InvalidTableNumberError` |
| `capacity` ausente, no entero o menor que 1 | `400 InvalidCapacityError` |
| `status` distinto de `libre`, `ocupada` o `reservada` | `400 InvalidTableStatusError`. Se normaliza a minúsculas y sin espacios, como las unidades |
| Número de mesa repetido en el mismo restaurante (al crear o al editar) | `400 DuplicatedTableNumberError`. El mismo número en otro restaurante sí se permite |
| Mesa inexistente (consultar, editar, borrar, cambiar estado u ocupar) | `404 TableNotFoundError` |
| Borrar una mesa `ocupada` | `400 TableOccupiedError` |
| `people` ausente, no entero o menor que 1 (al consultar o al ocupar) | `400 InvalidPeopleCountError` |
| Ocupar una mesa que no está `libre` o con `capacity < people` | `400 TableNotAvailableError` |
| Dos clientes ocupan la misma mesa a la vez | Solo uno lo consigue gracias al `UPDATE` condicional. El otro recibe `TableNotAvailableError` |
| Ocupar una mesa de otro restaurante (el `restaurantId` de la URL no coincide) | `404 TableNotFoundError` |
| El cliente recarga la página de la carta (`CartStore` no se persiste) | Se pierde la mesa elegida y se le redirige a la selección. La mesa anterior sigue `ocupada` hasta que un empleado la libere |
| El cliente cambia de restaurante | `CartStore` borra el carrito y la mesa, igual que hoy borra el carrito |

## 6. Plan de implementación

Las tareas se agrupan por aplicación. La numeración es continua para poder referenciarlas en los commits. Las tareas de la API llevan test (vitest). Las de los frontends se verifican con `npm run build -w <paquete>`, porque no tienen runner de tests.

Las tareas de frontend dependen solo del contrato de la sección 4, así que se pueden hacer en paralelo con las de la API.

### 6.1 API (`packages/api`)

1. [x] Modelo `Table` y `normalizeTableStatus()`, con `InvalidTableStatusError`. Test: describe `normalizeTableStatus` en `services/table.service.test.ts` (valores válidos, mayúsculas y valor inválido). Ficheros: `models/table.model.ts`, `errors/DomainErrors.ts`.
2. [x] Tabla `tables` en `runInitialMigrations()` y `SqliteTableRepository` con `save`, `findById` y `delete`. Test: `repositories/table.repository.test.ts` (guardar, buscar y borrar en memoria). Ficheros: `config/database.ts`, `repositories/table.repository.ts`.
3. [x] Repositorio: `findByRestaurantId` (ordenado por `number`) y `findByNumber(restaurantId, number)`. Test: integración en `table.repository.test.ts`.
4. [x] Repositorio: `findAvailable(restaurantId, people)`, que devuelve las mesas `libre` con `capacity >= people` ordenadas por capacidad y número. Test: integración con mesas libres, ocupadas, pequeñas y de otro restaurante.
5. [x] Repositorio: `occupyIfAvailable(id, restaurantId, people): Promise<boolean>`, con un `UPDATE` condicional y `changes`. Test: integración (ocupa una libre; devuelve `false` si ya está ocupada, si es pequeña o si es de otro restaurante).
6. [x] `MockTableRepository` y `TableService.create`, con las validaciones de número y capacidad, el estado `libre` por defecto y el número duplicado. Errores nuevos: `InvalidTableNumberError`, `InvalidCapacityError` y `DuplicatedTableNumberError`. Test: `table.service.test.ts`. Ficheros: `repositories/mocks/MockTableRepository.ts`, `services/table.service.ts`, `errors/DomainErrors.ts`.
7. [x] `TableService.update`, `delete`, `findById` y `findByRestaurantId`. Incluye el número duplicado al editar, `TableNotFoundError` (añadido a `NOT_FOUND_ERRORS`) y `TableOccupiedError` al borrar una mesa ocupada. Test: `table.service.test.ts`. Ficheros: `services/table.service.ts`, `errors/DomainErrors.ts`, `errorHandler.ts`.
8. [x] `TableService.changeStatus(id, status)`. Test: cambia el estado y actualiza `updatedAt`; error si el estado no es válido o la mesa no existe.
9. [x] `TableService.findAvailable(restaurantId, people)` y `occupy(restaurantId, id, people)`, con `InvalidPeopleCountError`, `TableNotFoundError` y `TableNotAvailableError`. Test: `table.service.test.ts` (el mock implementa `occupyIfAvailable` con la misma regla).
10. [x] `TableController` y `routes/table.routes.ts` (CRUD, `PATCH /:id/status` y `POST /:id/occupy`, con los roles de la sección 4), registrados en `app.ts`. No hay tests HTTP en el proyecto, así que se verifica con `npx tsc --noEmit -p packages/api`, la suite en verde y una prueba manual con `curl` (crear, listar, cambiar estado y ocupar).
11. [x] `routes/table.public.routes.ts` (`GET /?people=N`) registrado en `app.ts` bajo `/api/v1/public/restaurants/:restaurantId/tables`. Se verifica con `tsc`, la suite y `curl`.
12. [x] Seed: 6 mesas para `rest-1` y 4 para `rest-2` (capacidades de 2 a 8), con `INSERT OR IGNORE` e ids fijos para que sea idempotente. Se verifica ejecutando `npm run seed` dos veces y la suite.
13. [x] Documentación: tabla `tables` y relación en `docs/dominio/modelo-datos.md`; "Mesa" y sus estados en `docs/dominio/glosario.md`; endpoints y dominio en `docs/arquitectura/arquitectura-api.md`.

### 6.2 web-admin (`packages/web-admin`)

14. [x] `features/tables/models/table.model.ts` (`Table`, `TableStatus`, `CreateTableDto` y `UpdateTableDto`) y `services/table.service.ts` (`getAll`, `create`, `update` y `delete`, igual que `IngredientService`). Se verifica con `npm run build -w @resttek/web-admin`.
15. [x] `features/tables/store/table.store.ts`, con las signals `tables`, `loading` y `error`, y los métodos `loadByRestaurant`, `create`, `update` y `delete`. Se verifica con el build.
16. [x] Página `pages/table-list`: tabla con número, descripción, capacidad y estado (con una etiqueta de color por estado), botones de editar y borrar (`confirm()`), y el error de `TableOccupiedError` mostrado. Se verifica con el build.
17. [x] Página `pages/table-form`: alta y edición con `FormsModule`. Campos: número, descripción, capacidad y un select de estado (solo al editar). Muestra los errores de la API. Se verifica con el build.
18. [x] `tables.routes.ts` (`''`, `new` y `:id/edit`), ruta `tables` en `app.routes.ts`, enlace "Mesas" en el submenú de `shell.component.html`, tarjeta en `restaurant-dashboard` e icono en `app.config.ts`. Se verifica con el build y comprobando a mano la navegación con `npm run dev:admin`.
19. [x] Documentación: feature `tables` de web-admin en `docs/arquitectura/arquitectura-frontend.md`.

### 6.3 web-empleados (`packages/web-empleados`)

20. [x] `features/tables/models/table.model.ts` y `services/table.service.ts` (`getAll(restaurantId)` y `updateStatus(restaurantId, id, status)`). Se verifica con `npm run build -w @resttek/web-empleados`.
21. [x] `features/tables/store/table.store.ts`, con las signals `tables`, `loading` y `error`, `loadTables`, `changeStatus` (que actualiza el estado local con la respuesta) y `startPolling`/`stopPolling` cada 30 s, igual que `OrderStore`. Se verifica con el build.
22. [x] Página `pages/tables`: rejilla de mesas con número, descripción, capacidad y estado, y un selector para cambiar el estado. El `restaurantId` sale de `authStore.user()`. Arranca y para el polling en `ngOnInit`/`ngOnDestroy`. Se verifica con el build.
23. [x] En la página de mesas, para cada mesa `ocupada`, lista de sus pedidos activos (`OrderStore.orders()` filtrado por `tableId` en un `computed`), con cada plato y su estado. Arranca también el polling de `OrderStore`. Se verifica con el build.
24. [x] Ruta `mesas` en `app.routes.ts`, `canSeeMesas` (manager, camarero y cocinero) y enlace "Mesas" en el `ShellComponent`, e icono en `app.config.ts`. Se verifica con el build y comprobando a mano con `npm run dev:empleados`.
25. [x] Documentación: feature `tables` de web-empleados en `docs/arquitectura/arquitectura-frontend.md`.

### 6.4 web-clientes (`packages/web-clientes`)

26. [x] `core/models/table.model.ts` y `core/services/table.service.ts`:
    - `getAvailable(restaurantId, people)` → `GET /public/restaurants/:id/tables?people=`.
    - `occupy(restaurantId, tableId, people)` → `POST /restaurants/:id/tables/:tableId/occupy`.

    Se verifica con `npm run build -w @resttek/web-clientes`.
27. [x] `CartStore`: signal `table` (`{ id, number } | null`) y `setTable(restaurantId, table)`. Se limpia con `clear()` y al cambiar de restaurante. Se verifica con el build.
28. [x] `OrderService.createOrder(restaurantId, tableId, items)` y `CartComponent.confirmOrder()`, que envía `cartStore.table()?.id`. Se verifica con el build.
29. [x] Página `features/tables/table-selection.component`:
    - Campo de personas y botón "Buscar mesas".
    - Lista de mesas disponibles con un mensaje si no hay ninguna.
    - Selección de mesa y botón "Continuar", que llama a `occupy`, guarda la mesa en `CartStore` y navega a `/restaurants/:id`.
    - Si recibe `TableNotAvailableError`, muestra el mensaje y recarga la lista.

    Se verifica con el build.
30. [x] Ruta `restaurants/:id/table` en `app.routes.ts`. Las tarjetas de `restaurant-list` enlazan a ella. `restaurant-menu` redirige a la selección si no hay mesa para ese restaurante y muestra "Mesa N". Se verifica con el build y con el flujo completo a mano usando `npm run dev:clientes`.
31. [x] Documentación: flujo de selección de mesa y `CartStore.table` en `docs/arquitectura/arquitectura-frontend.md`.

## 7. Criterios de aceptación

- [ ] El admin puede crear, listar, editar y borrar mesas de un restaurante desde web-admin, con número, descripción, capacidad y estado.
- [ ] No se pueden repetir números de mesa dentro de un restaurante, ni borrar una mesa ocupada.
- [ ] Un cliente, al elegir restaurante, indica el número de personas y solo ve las mesas libres con capacidad suficiente.
- [ ] Al pulsar "Continuar", la mesa queda `ocupada` y el cliente llega a la carta.
- [ ] El pedido enviado desde el carrito lleva el `tableId` de la mesa elegida.
- [ ] Dos clientes no pueden ocupar la misma mesa.
- [ ] Un cliente no puede abrir la carta sin haber elegido mesa en ese restaurante.
- [ ] Los empleados (manager, camarero y cocinero) ven las mesas de su restaurante con su estado y pueden cambiarlo.
- [ ] Los empleados ven, para cada mesa ocupada, sus pedidos activos con el estado de cada plato.
- [ ] Solo el admin puede crear, editar y borrar mesas (`403` para el resto), y solo un cliente puede ocupar una mesa.
- [ ] `npm test` pasa y los tres frontends compilan.
- [ ] La documentación de `docs/` refleja las mesas.

### Tests

- **Unitarios:**
  - `services/table.service.test.ts`: `normalizeTableStatus`, la creación, la edición, el borrado, el cambio de estado, las mesas disponibles y la ocupación, con `MockTableRepository`.
  - `repositories/table.repository.test.ts`: integración con SQLite en memoria, incluida la ocupación condicional.
- **Integración / E2E:** el proyecto no tiene tests HTTP ni E2E. Los endpoints se prueban a mano con `curl`. Los flujos de admin, empleados y clientes se prueban a mano con los dev servers y los usuarios del seed (`admin@resttek.com`, `camarero1@resttek.com` y `cliente1@resttek.com`).

## 8. Impacto y riesgos

- **Retrocompatibilidad:** la tabla nueva se crea también en bases existentes. `POST /orders` no cambia. Cambia el flujo de web-clientes: ya no se puede ir directamente a la carta sin elegir mesa.
- **Rendimiento:** web-empleados añade una consulta de mesas cada 30 s por empleado, además de la de pedidos. Es despreciable con SQLite y pocos empleados.
- **Seguridad:**
  - `GET /public/.../tables` expone el número, la capacidad y la descripción de las mesas libres sin autenticación, igual que la carta. No hay datos sensibles.
  - No se comprueba que el empleado pertenezca al restaurante de la mesa (problema que ya existe en todo el proyecto).
  - Un cliente podría ocupar mesas sin llegar a pedir. Se mitiga porque los empleados pueden liberarlas.
- **Operación:** no hay variables de entorno nuevas. Hay que ejecutar `npm run seed` para tener mesas de prueba.

## 9. Suposiciones y preguntas abiertas

**Suposiciones**
- Se considera "empleados" a `manager`, `camarero` y `cocinero`, y todos pueden cambiar el estado. El admin también puede hacerlo desde la API.
- La mesa la liberan siempre los empleados a mano: no hay liberación automática.
- Una mesa `reservada` no aparece como disponible para los clientes.
- El número de personas solo sirve para filtrar y validar la capacidad: no se guarda en la base de datos.
- La mesa elegida no se persiste en `localStorage`: si el cliente recarga, vuelve a la selección.

**Preguntas abiertas**
- ¿Cuándo debe liberarse una mesa automáticamente (al entregar todos los platos, al pagar…)? Lo decide el responsable de producto (@csubiron). Por ahora, liberación manual.
- ¿Deben los `cocinero` poder cambiar el estado de las mesas, o solo `manager` y `camarero`? Lo decide @csubiron. Por ahora, sí pueden.
