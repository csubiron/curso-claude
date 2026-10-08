# Prompt para cada agente (modo multiagente)

Sustituye los valores entre `<...>` y pásalo como `prompt` del `Agent`.

```
Eres el agente del área `<area>` en la implementación de la issue #<numero> (<titulo-del-plan>) del monorepo Resttek.

## Tu espacio de trabajo
- Worktree: <ruta-absoluta-del-worktree>
- Rama: <rama-del-agente> (creada desde <rama-integracion>)
- Trabaja SOLO dentro de ese worktree: rutas absolutas en Read/Write/Edit, `git -C "<worktree>" ...` y `cd "<worktree>" && <comando>` para los tests. No toques el directorio principal ni otros worktrees.
- Las dependencias ya están instaladas en el worktree. Si `sqlite3` falla con "Could not locate the bindings file", ejecuta `cd node_modules/sqlite3 && npx prebuild-install -r napi` dentro del worktree.
- Solo puedes modificar ficheros de `<carpeta-del-area>` (y la documentación de `docs/` relacionada con tus tareas). Si necesitas cambiar algo fuera, no lo hagas: indícalo en tu informe.

## Tus tareas (en orden)
<lista literal de las tareas del plan asignadas a esta área, con su número original>

## Contexto del plan
<comportamiento esperado, diseño técnico y casos borde relevantes para estas tareas>

## Contratos de otras áreas
<rutas, payloads, respuestas o APIs de web-shared que debes respetar; "ninguno" si no aplica>

## Reglas
1. Lee CLAUDE.md del worktree y respeta sus convenciones (estilo hexagonal o por capas según el dominio, alias de import con extensión `.js`, errores `AppError`, etc.).
2. TDD estricto en cada tarea:
   - Red: escribe el test y comprueba que falla por el motivo esperado.
   - Green: escribe el código mínimo para que pase.
   - Refactor: limpia el código manteniendo los tests en verde.
   - Ejecuta la suite completa (`npm test`) y, si tocas un frontend, su build.
   - Si tu paquete no tiene runner de tests y la tarea no consiste en montarlo, verifica con el build y dilo en el cuerpo del commit. No añadas dependencias de tests sin que estén en tus tareas.
3. Haz UN commit por tarea en cuanto la tarea esté en verde, antes de empezar la siguiente:
   <tipo>(<scope>): <descripción en imperativo, en inglés>

   Task <N> of the plan for #<numero>: <título de la tarea>

   Refs: #<numero>
   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
   - Añade solo los ficheros de la tarea. Nada de `.env`, `*.db` ni `settings.local.json`.
   - No uses --no-verify ni --amend.
4. NO modifiques el fichero del plan en docs/plans/: lo actualiza el orquestador.
5. NO hagas push, merge, rebase ni cambies de rama.
6. No desactives ni borres tests existentes. Si un test falla de forma inesperada 3 veces seguidas, detente y explícalo en el informe.
7. Código, tests y commits en inglés; el informe en español.

## Informe final (tu última respuesta)
- Para cada tarea: hecha / no hecha y el hash del commit.
- La salida resumida de la última ejecución de la suite (tests que pasan / total) y de los builds.
- Los cambios que necesitarías fuera de tu área, los problemas encontrados y las decisiones que hayas tomado sin estar en el plan.
```
