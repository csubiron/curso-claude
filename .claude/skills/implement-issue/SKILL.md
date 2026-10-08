---
name: implement-issue
description: Implementa el plan publicado como comentario en una issue de GitHub (indicada por su número) dentro de un git worktree, con TDD estricto y un commit por cada tarea completada. Si el plan afecta a varias áreas del monorepo, reparte el trabajo entre varios agentes, cada uno en su propio worktree, e integra después sus ramas. Úsala cuando se pida "implementa la issue N", "ejecuta el plan de la issue N" o se invoque /implement-issue.
argument-hint: <número-de-issue>
allowed-tools: Bash, PowerShell, Read, Write, Edit, Glob, Grep, Agent
---

# implement-issue

Issue a implementar: #$ARGUMENTS

Sigue las fases **en orden** y no te saltes ninguna. Habla con el usuario y escribe los documentos en español; el código, los nombres de los tests y los mensajes de commit, en inglés.

## Reglas obligatorias

1. **Nunca se toca el directorio de trabajo principal.** Antes de crear, editar o borrar cualquier fichero del proyecto, el worktree tiene que existir, y todas las rutas que uses deben apuntar a él (rutas absolutas en Read/Write/Edit, `git -C "<worktree>" ...` y `cd "<worktree>" && <comando>` para los tests).
2. **TDD estricto**: no se escribe código de producción sin un test que falle antes por el motivo correcto.
3. **Un commit por tarea del plan**: cuando una tarea queda en verde, se hace su commit antes de empezar la siguiente. Nunca se juntan varias tareas en un commit ni se deja una tarea a medias commiteada.
4. **Un worktree por agente**: si el trabajo se reparte entre varios agentes, cada uno trabaja en su propio worktree y en su propia rama. Ningún agente escribe en el worktree de otro.
5. **Nada hacia fuera sin permiso**: no hagas `push`, no abras PRs, no hagas merge en la rama base y no edites ni comentes la issue salvo que el usuario lo pida.

## Fase 0 — Leer la issue y localizar el plan

1. `$ARGUMENTS` debe ser el número de una issue (`42` o `#42`; quita el `#`). Si está vacío o no es un número, pide el número al usuario y no continúes hasta tenerlo.
2. Lee la issue desde la raíz del repositorio:

   ```bash
   gh issue view <numero> --json number,title,body,author,labels,state,url,comments
   ```

   - Si `gh` falla por autenticación, pide al usuario que ejecute `! gh auth login` y detente.
   - Si la issue no existe, avisa y detente.
   - Si está cerrada (`state: CLOSED`), avisa y pregunta si quiere continuar.
3. Busca el plan en los **comentarios** de la issue. Es el comentario que contiene la sección `## 6. Plan de implementación` (formato de la skill `new-feature`).
   - Si hay varios, usa el **más reciente** y díselo al usuario.
   - Si no hay ninguno, detente y sugiere generarlo primero con `/new-feature <numero>`.
4. Extrae del plan:
   - El título (primer `# ...`) y el tipo de cambio (`feat`, `fix`, `refactor`…), deducido del título y las etiquetas.
   - La lista de tareas de la sección 6 (`N. [ ] ...`). Las que ya estén marcadas con `[x]` se consideran hechas y se saltan.
   - Los archivos afectados (sección 4), los criterios de aceptación (sección 7) y las preguntas abiertas (sección 9).
5. Si en la sección 9 quedan **preguntas abiertas** que bloquean alguna tarea, pregúntaselas al usuario antes de seguir.

## Fase 1 — Decidir el reparto de trabajo

Asigna cada tarea a un **área** según los ficheros que toca:

| Área | Carpeta | Cómo se verifica |
|---|---|---|
| `api` | `packages/api` | `npm test` (vitest) |
| `web-shared` | `packages/web-shared` | build de las apps que la consumen |
| `web-admin` | `packages/web-admin` | `npm run build -w @resttek/web-admin` |
| `web-empleados` | `packages/web-empleados` | `npm run build -w @resttek/web-empleados` |
| `web-clientes` | `packages/web-clientes` | `npm run build -w @resttek/web-clientes` |
| `docs` | `docs/`, `CLAUDE.md`, `README.md` | — |

- Las tareas de `docs` se asignan al área cuyo comportamiento documentan.
- **Un solo agente** si todas las tareas caen en una misma área, o si son tan pocas (3 o menos) que repartirlas no compensa.
- **Varios agentes** (uno por área) en cualquier otro caso.
- Calcula las **dependencias entre áreas**. Por ejemplo, `web-admin` depende de `web-shared` si usa algo nuevo de ella. Un frontend que solo consume un endpoint nuevo **no** depende del área `api` si el contrato (ruta, payload, respuesta) está definido en el plan: puede trabajar en paralelo contra ese contrato.
- Agrupa las áreas en **oleadas**: en cada oleada van las áreas cuyas dependencias ya se han integrado.

Muestra al usuario un resumen antes de crear nada:

- Las tareas pendientes, con su área.
- Los agentes y las oleadas.
- Las ramas y rutas de los worktrees que vas a crear (ver Fase 2).

Espera su confirmación.

## Fase 2 — Crear los worktrees

1. Comprueba el repositorio:

   ```bash
   git rev-parse --show-toplevel
   git status --short
   ```

2. Elige la **rama base**:
   - `development` si existe (en local o como `origin/development`).
   - Si no, `main`.
   - Si no, `master`.

   Compruébalo con `git rev-parse --verify --quiet <rama>^{commit}`: la rama tiene que tener al menos un commit, porque sin commits no se puede crear un worktree. Si ninguna rama sirve, detente y pregunta al usuario.
3. Si hay cambios sin commitear en el directorio principal, avisa de que **no** estarán en el worktree.
4. Define los nombres. `<slug>` es una descripción corta en kebab-case, en inglés y sin tildes, sacada del título del plan:

   ```bash
   REPO_ROOT=$(git rev-parse --show-toplevel)
   WT_BASE="$REPO_ROOT/../$(basename "$REPO_ROOT")-worktrees"
   ```

   - **Worktree de integración** (siempre existe):
     - Rama: `<tipo>/<numero>-<slug>`.
     - Ruta: `$WT_BASE/<numero>-<slug>`.
   - **Worktree de cada agente** (solo en modo multiagente):
     - Rama: `<tipo>/<numero>-<slug>-<area>`.
     - Ruta: `$WT_BASE/<numero>-<slug>-<area>`.
     - Se usa `-<area>` y no `/<area>` porque git no permite que una rama sea a la vez rama y "carpeta" de otras.
5. Crea el worktree de integración desde la rama base:

   ```bash
   git worktree add -b "<tipo>/<numero>-<slug>" "$WT_BASE/<numero>-<slug>" <rama-base>
   ```

   Si la rama o la ruta ya existen, **no las sobrescribas**: pregunta al usuario si quiere retomar ese worktree (útil si una ejecución anterior se quedó a medias) o usar un sufijo (`-2`).
6. En el worktree de integración, guarda una copia del plan en `docs/plans/<numero>-<tipo>-<slug>.md` usando el cuerpo del comentario. Si ya existe, compárala con el comentario y avisa de las diferencias. Haz el primer commit:

   ```
   docs(plans): add implementation plan for #<numero>
   ```

7. Instala las dependencias **dentro** del worktree: `npm install` (los `node_modules` no se comparten entre worktrees). Si `sqlite3` falla con `Could not locate the bindings file`, aplica el arreglo descrito en `CLAUDE.md`.
8. Ejecuta `npm test` y comprueba que la suite **parte de verde**. Si ya falla antes de tocar nada, informa al usuario y pregunta cómo seguir.
9. En modo multiagente, los worktrees de los agentes de cada oleada se crean **desde la rama de integración** justo antes de lanzar esa oleada (así incluyen lo integrado en las oleadas anteriores). En cada uno hay que repetir `npm install`.

## Fase 3 — Implementar con TDD

### Ciclo por tarea

Para **cada** tarea pendiente, en orden:

1. **Red.** Escribe primero el test que describe el comportamiento esperado, junto al código (`*.test.ts`) y reutilizando los dobles existentes (`repositories/mocks/`, `contexts/employee/application/mocks/`). Ejecútalo y confirma que **falla por el motivo esperado**: una aserción, no un error de sintaxis o de import. Si pasa sin código nuevo, el test no aporta: corrígelo.
2. **Green.** Escribe el código mínimo de producción para que pase, y nada más.
3. **Refactor.** Mejora nombres y elimina duplicación respetando el estilo de la zona (hexagonal en `contexts/employee/`, por capas en el resto; alias de import con extensión `.js`). La suite tiene que seguir en verde.
4. **Verificación.** Ejecuta la suite completa (`npm test`). Si la tarea toca un frontend, ejecuta también su build.
5. **Plan.** Marca la tarea en la copia local del plan (`[ ]` → `[x]`). Esto solo se hace en modo de un agente (ver más abajo).
6. **Commit** de la tarea. Incluye el test, el código y, si aplica, el plan:

   ```bash
   git -C "<worktree>" add <ficheros de la tarea>
   git -C "<worktree>" commit -F - <<'EOF'
   <tipo>(<scope>): <descripción en imperativo, en inglés>

   Task <N> of the plan for #<numero>: <título de la tarea>

   Refs: #<numero>
   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
   EOF
   ```

   - Sigue Conventional Commits (como en la skill `commit`). El `scope` es el área o el dominio (`order`, `dish`, `web-admin`…).
   - Añade solo los ficheros de la tarea. Nunca añadas `.env`, `*.db` ni `settings.local.json`.
   - No uses `--no-verify` ni `--amend`. Si un hook falla, arregla la causa y crea el commit de nuevo.

### Tareas sin tests posibles

Hay tareas que no admiten test (por ejemplo, actualizar documentación) y frontends que no tienen runner de tests:

- **Tareas de documentación:** no necesitan Red. Se verifican releyendo el texto y se commitean con tipo `docs`.
- **Tareas de frontend sin runner:**
  - Si el plan ya incluye montar la infraestructura de tests de ese paquete, esa es la primera tarea del área.
  - Si no la incluye, **pregunta al usuario** antes de añadir dependencias. Si prefiere no añadirlas, la verificación de la tarea será el build del paquete, y lo indicas en el cuerpo del commit (`Verified with build; no test runner in <paquete>`).

### Reglas durante la implementación

- No avances a la siguiente tarea si la suite no está en verde.
- No desactives, borres ni marques como `skip` tests existentes para que la suite pase.
- Si un test falla de forma inesperada 3 veces seguidas, para, analiza la causa y, si hace falta cambiar el plan, explícaselo al usuario antes de continuar.
- Si aparece trabajo fuera del alcance, anótalo como pendiente para el resumen final; no lo implementes.

### Modo de un agente

Ejecuta tú mismo el ciclo anterior en el worktree de integración, tarea por tarea.

### Modo multiagente

Para cada oleada:

1. Crea los worktrees de los agentes de esa oleada (Fase 2, paso 9).
2. Lanza **en el mismo mensaje** un `Agent` (`subagent_type: general-purpose`) por área, para que trabajen en paralelo. Usa el prompt de `assets/AGENT_PROMPT.md` rellenado con:
   - Sus tareas, copiadas literalmente del plan.
   - Su worktree y su rama.
   - El contrato que necesite de otras áreas.
3. Espera a que terminen todos los agentes de la oleada. Revisa el informe de cada uno y comprueba con `git -C "<worktree-agente>" log --oneline <rama-integracion>..HEAD` que hay **un commit por tarea**.
4. Integra las ramas de la oleada en la de integración, una por una:

   ```bash
   git -C "<worktree-integracion>" merge --no-ff "<rama-agente>" -m "merge: integrate <area> work for #<numero>"
   ```

   - Si hay conflictos, resuélvelos en el worktree de integración respetando la intención de ambas ramas, y explícaselos al usuario.
   - Si un agente no terminó todas sus tareas, no integres su rama a ciegas: informa al usuario y decide con él.
5. Tras integrar la oleada, ejecuta `npm test` y los builds de los frontends afectados en el worktree de integración. Todo tiene que estar en verde antes de pasar a la siguiente oleada.
6. Marca en la copia local del plan las tareas integradas y haz commit (`docs(plans): mark tasks <N..M> as done for #<numero>`). En este modo los agentes **no** tocan el fichero del plan, para que no haya conflictos al integrar.
7. Elimina los worktrees de los agentes ya integrados con `git worktree remove "<ruta>"`. Las ramas se conservan.

## Fase 4 — Verificación final

En el worktree de integración:

1. Ejecuta `npm test` y el build de cada frontend afectado.
2. Repasa los criterios de aceptación (sección 7 del plan) y marca cuáles se cumplen. Si alguno no se cumple, dilo claramente.
3. Si ha cambiado algún comportamiento descrito en `docs/` y el plan no lo cubría, avisa al usuario. Según `CLAUDE.md`, la documentación debe actualizarse, y eso se hace como una tarea más, con su propio commit.
4. Obtén el resumen:

   ```bash
   git -C "<worktree-integracion>" log --oneline <rama-base>..HEAD
   git -C "<worktree-integracion>" diff --stat <rama-base>..HEAD
   ```

## Fase 5 — Cierre

Informa al usuario de:

- **Dónde está el trabajo:** la ruta del worktree de integración y su rama. Si hubo varios agentes, también sus ramas.
- **Resultado:** cuántos tests pasan y cuántos hay en total, y el estado de los builds. Si algo falla, incluye la salida relevante; nunca anuncies éxito si hay fallos.
- **Avance:** las tareas completadas con su commit, las pendientes y el trabajo fuera de alcance que se haya detectado.
- **Siguientes pasos que puede pedirte:**
  - Revisar el diff.
  - Hacer `push` y abrir una PR que cierre la issue (`Closes #<numero>`).
  - Actualizar el comentario del plan en la issue con las casillas marcadas.
  - Eliminar el worktree con `git worktree remove "<ruta>"`.

**No** hagas ninguna de esas acciones sin que el usuario lo pida explícitamente.
