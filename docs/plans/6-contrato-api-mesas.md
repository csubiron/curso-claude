# Contrato HTTP de mesas (issue #6)

| | |
|---|---|
| **Estado** | Cerrado (vinculante para api, web-admin, web-empleados y web-clientes) |
| **Plan** | `docs/plans/6-feat-table-management.md` |
| **Base URL** | `/api/v1` (el proxy de cada app la reenvía a `localhost:3000`) |

Acordado entre los agentes de las cuatro áreas: cada frontend propuso las peticiones que necesitaba y el agente de la API cerró el contrato.

## 1. Recurso `Table`

```ts
type TableStatus = 'libre' | 'ocupada' | 'reservada'

interface Table {
  id: string               // uuid (ids fijos en el seed: table-1-1…table-1-6, table-2-1…table-2-4)
  number: number           // entero >= 1, único dentro del restaurante
  description: string | null
  capacity: number         // entero >= 1
  status: TableStatus
  restaurantId: string
  createdAt: string        // ISO 8601
  updatedAt: string        // ISO 8601
}
```

Todos los números viajan como `number` de JSON. Todas las respuestas que devuelven una mesa la devuelven completa.

## 2. Formato de errores

**Errores de dominio:** los devuelve el `errorHandler`.

```json
{ "error": "TableNotFoundError", "message": "Table not found" }
```

- Códigos HTTP: 404 si el error es de tipo "no encontrado"; 400 para cualquier otro error de dominio; 500 con `{ "error": "InternalServerError", "message": "Something went wrong" }`.
- El `message` está en inglés y no hay que mostrarlo tal cual. Los frontends deben decidir por el nombre que viene en `error`.

**Nota importante sobre los 401 y 403:** los middlewares `authenticate` y `authorize` responden con otra forma, **sin `message`**:

```json
401 { "error": "Unauthorized: No token provided" }   // también "Unauthorized: Malformed token" / "Unauthorized: Invalid token"
403 { "error": "Forbidden: Insufficient permissions" }
```

Para leer los errores, los frontends deben usar siempre `err.error?.error` y `err.error?.message`, con un texto por defecto si faltan. Hay que decidir por `err.status` cuando sea 401 o 403. El 401 ya lo gestiona el `errorInterceptor` de `web-shared`, que limpia la sesión y redirige a `/login`.

## 3. Reglas comunes

- **Enteros estrictos:**
  - `number`, `capacity` y `people` en el body tienen que ser `number` de JSON con `Number.isInteger(x) && x >= 1`.
  - Si llega un string (`"5"`), un decimal, `null` o nada, la respuesta es 400 con el error correspondiente, nunca 500.
- **`people` en la query:** se convierte con `Number()` y tiene que ser un entero ≥ 1. Los valores ausentes, `""`, `"abc"` o `"3.5"` dan `400 InvalidPeopleCountError`.
- **`description`:** se recorta (trim). Si es `''`, solo espacios, `null` o falta, se guarda `null`.
- **`status`:** se normaliza a minúsculas y sin espacios (`" LIBRE "` → `libre`). Cualquier otro valor da `400 InvalidTableStatusError`.
- **Pertenencia al restaurante:** en **todos** los endpoints con `:id`, si la mesa no existe o su `restaurantId` no coincide con el `:restaurantId` de la URL, la respuesta es `404 TableNotFoundError`.
- **Número duplicado:**
  - El servicio lo comprueba con `findByNumber(restaurantId, number)` antes de guardar. Al editar no cuenta la propia mesa.
  - Si está repetido, la respuesta es `400 DuplicatedTableNumberError`.
  - El mismo número en otro restaurante sí se permite.
- **Sin reglas de transición de estado:** se puede pasar de cualquier estado a cualquier otro. Poner el mismo estado devuelve 200 y actualiza `updatedAt`.
- **Liberación:** siempre es manual, por parte de los empleados (o del admin). **No existe endpoint para que un cliente libere una mesa.**

## 4. Endpoints

### 4.1 Listar mesas de un restaurante

`GET /restaurants/:restaurantId/tables`

- **Roles:** admin, manager, camarero, cocinero.
- **Respuesta `200`:** `Table[]`, ordenadas por `number` ASC. Si el restaurante no tiene mesas o no existe, devuelve `[]`.
- **Errores:** 401, 403.

### 4.2 Obtener una mesa

`GET /restaurants/:restaurantId/tables/:id`

- **Roles:** admin, manager, camarero, cocinero.
- **Respuesta `200`:** `Table`.
- **Errores:** `404 TableNotFoundError`, 401, 403.

### 4.3 Crear mesa

`POST /restaurants/:restaurantId/tables`

- **Roles:** admin.
- **Body:**

  ```ts
  { number: number; capacity: number; description?: string | null; status?: TableStatus }
  ```

- **Respuesta `201`:** `Table`. Si no se envía `status`, vale `libre`.
- **Errores:** `400 InvalidTableNumberError`, `400 InvalidCapacityError`, `400 InvalidTableStatusError`, `400 DuplicatedTableNumberError`, 401, 403.

### 4.4 Editar mesa

`PUT /restaurants/:restaurantId/tables/:id`

- **Roles:** admin.
- **Body:**

  ```ts
  { number: number; capacity: number; description?: string | null; status?: TableStatus }
  ```

- **Reemplazo completo de `number`, `capacity` y `description`.** Si falta `description`, se guarda `null`.
- **`status` es opcional:** si falta, se mantiene el actual. Admite los tres estados, `ocupada` incluido. web-admin envía siempre el body completo.
- **Respuesta `200`:** `Table`, con `updatedAt` actualizado.
- **Errores:** los de 4.3, más `404 TableNotFoundError`, 401 y 403.

### 4.5 Borrar mesa

`DELETE /restaurants/:restaurantId/tables/:id`

- **Roles:** admin.
- **Respuesta `204`:** sin cuerpo.
- **Errores:**
  - `404 TableNotFoundError`.
  - `400 TableOccupiedError` si la mesa está `ocupada`. Las mesas `libre` y `reservada` sí se pueden borrar.
  - 401, 403.

### 4.6 Cambiar estado

`PATCH /restaurants/:restaurantId/tables/:id/status`

- **Roles:** admin, manager, camarero, cocinero.
- **Body:** `{ status: TableStatus }`.
- **Respuesta `200`:** `Table` completa, con `updatedAt` actualizado. Es idempotente si se envía el mismo estado.
- **Errores:** `400 InvalidTableStatusError` (también si falta `status`), `404 TableNotFoundError`, 401, 403.

### 4.7 Ocupar mesa (cliente)

`POST /restaurants/:restaurantId/tables/:id/occupy`

- **Roles:** solo `cliente`. Cualquier otro rol, admin incluido, recibe 403.
- **Body:** `{ people: number }`.
- **Funcionamiento:** se hace con un único `UPDATE ... WHERE id = ? AND restaurant_id = ? AND status = 'libre' AND capacity >= ?`, que es atómico. Si no se actualiza ninguna fila, el servicio vuelve a leer la mesa para elegir el error.
- **Respuesta `200`:** `Table` con `status: "ocupada"` (la mesa se lee de nuevo después del UPDATE).
- **Errores:**
  - `400 InvalidPeopleCountError`.
  - `404 TableNotFoundError`: la mesa no existe o es de otro restaurante.
  - `400 TableNotAvailableError`: no está `libre` o `capacity < people`, por ejemplo porque otro cliente la acaba de ocupar.
  - 401, 403.

### 4.8 Mesas disponibles (público)

`GET /public/restaurants/:restaurantId/tables?people=N`

- **Roles:** público, sin token.
- **Respuesta `200`:** `Table[]`, solo con `status = 'libre'` y `capacity >= N`, ordenadas por `capacity` ASC y luego por `number` ASC. Si el restaurante no tiene mesas disponibles o no existe, devuelve `[]`.
- **Errores:** `400 InvalidPeopleCountError`.

## 5. Endpoints existentes que no cambian

### `POST /orders`

- Acepta `{ restaurantId, tableId, items }`, igual que hoy.
- No valida que `tableId` exista ni que pertenezca al restaurante: es un riesgo conocido y queda fuera del alcance.
- Sus errores tienen la forma antigua `{ error: <message> }`.

### `GET /orders/active?restaurantId=X`

- Solo pide `authenticate`, sin filtrar por rol.
- Filtra por el `restaurantId` de la query, no por el usuario. Si falta, devuelve `400 { error: 'restaurantId is required' }`.
- Devuelve los pedidos con al menos un ítem distinto de `entregado`, ordenados por `createdAt` ASC. **Incluye todos sus ítems, también los `entregado`.**
- Forma de la respuesta:

  ```ts
  { id: string; restaurantId: string; tableId: string | null; clientId: string | null;
    createdAt: string; items: {
      id: string; dishId: string; quantity: number /* siempre 1 */; notes: string | null;
      status: 'pendiente'|'preparando'|'listo'|'entregado';
      dishName: string; dishPrice: number; dishCategory: string }[] }[]
  ```

- `tableId` es el `id` (uuid) de la mesa, no su número. web-empleados cruza los pedidos con las mesas en el cliente usando `order.tableId === table.id`.

## 6. Catálogo de errores nuevos

| `error` | HTTP | Cuándo |
|---|---|---|
| `InvalidTableNumberError` | 400 | `number` ausente, no entero o < 1 |
| `InvalidCapacityError` | 400 | `capacity` ausente, no entero o < 1 |
| `InvalidTableStatusError` | 400 | estado fuera de `libre`/`ocupada`/`reservada` |
| `InvalidPeopleCountError` | 400 | `people` ausente, no entero o < 1 (en la ruta pública y en occupy) |
| `DuplicatedTableNumberError` | 400 | número repetido en el restaurante |
| `TableOccupiedError` | 400 | borrar una mesa `ocupada` |
| `TableNotAvailableError` | 400 | ocupar una mesa que no está libre o es demasiado pequeña |
| `TableNotFoundError` | 404 | la mesa no existe o no es de ese `:restaurantId` |

## 7. Decisiones cerradas

- La liberación es manual y la hacen los empleados. No hay liberación automática ni endpoint de liberación para clientes.
- Los `cocinero` pueden cambiar el estado de las mesas.
- Si el cliente ya tiene en `CartStore` una mesa para ese restaurante, la reutiliza sin volver a llamar a `occupy`.
- web-clientes guarda la mesa en `CartStore` como `{ id, number, restaurantId }`, para que la redirección de la carta no dependa del restaurante del carrito, que se borra al vaciarlo.
- web-clientes define sus componentes con template y estilos inline, como el resto de la app, aunque la tabla de ficheros del plan cite `.html` y `.css`.
