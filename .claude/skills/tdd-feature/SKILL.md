---
name: tdd-feature
description: Implementa una funcionalidad o cambio de principio a fin siguiendo TDD dentro de un git worktree aislado. Genera un plan, avisa por Slack al terminarlo, escribe tests primero (red → green → refactor), implementa el código y vuelve a avisar por Slack al terminar. Usar cuando el usuario pida "implementa X con TDD", "planifica e implementa X", o invoque /tdd-feature.
argument-hint: "<descripción del cambio> [--channel #canal]"
allowed-tools: Bash, PowerShell, Read, Write, Edit, Glob, Grep, mcp__slack__slack_post_message, mcp__slack__slack_list_channels
---

# TDD Feature: plan → Slack → TDD → implementación → Slack

Petición del usuario: `$ARGUMENTS`

Sigue las fases **en orden**. No te saltes ninguna. Habla con el usuario y escribe los documentos en español; el código, los nombres de tests y los mensajes de commit en inglés.

## Reglas obligatorias

1. **Todos los cambios se hacen en un git worktree**, nunca en el directorio de trabajo principal. Antes de crear, editar o borrar cualquier archivo del proyecto, el worktree debe existir y todas las rutas que uses deben apuntar a él.
2. **TDD estricto**: ningún código de producción se escribe sin un test que falle antes.
3. **Dos avisos por Slack**: uno al terminar el plan y otro al terminar la implementación. Si el envío falla, informa al usuario del error y continúa; no lo ocultes.

## Fase 0 — Preparación

1. Extrae de `$ARGUMENTS` la descripción del cambio y, si existe, el canal de Slack (`--channel`).
   - Si no se indica canal, usa `mcp__slack__slack_list_channels` y pregunta al usuario a qué canal avisar (o usa el que ya haya indicado antes en la conversación).
   - Si la descripción del cambio está vacía o es ambigua, pregunta antes de seguir.
2. Genera un `slug` corto en kebab-case e inglés a partir de la descripción (p. ej. `add-user-login`).
3. Comprueba el repositorio:
   ```bash
   git rev-parse --show-toplevel
   git rev-parse --verify HEAD
   git status --short
   ```
   - Si `HEAD` no existe (repo sin commits), **no se puede crear un worktree**: detente y pide al usuario permiso para hacer un commit inicial (o que lo haga él).
   - Si hay cambios sin commitear en el directorio principal, avisa al usuario de que no estarán en el worktree.

## Fase 1 — Crear el worktree

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
REPO_NAME=$(basename "$REPO_ROOT")
WT_PATH="$REPO_ROOT/../${REPO_NAME}-worktrees/<slug>"
git worktree add -b "feature/<slug>" "$WT_PATH" HEAD
```

- Si la rama o la ruta ya existen, añade un sufijo numérico (`<slug>-2`) en lugar de sobrescribir nada.
- Guarda la ruta absoluta del worktree y úsala en **todas** las operaciones siguientes (`git -C "$WT_PATH" ...`, rutas absolutas en Read/Write/Edit, `cd "$WT_PATH" && <comando de tests>`).
- Si el proyecto necesita instalar dependencias (`npm install`, `pip install -r ...`, `mvn`, etc.), hazlo dentro del worktree.

## Fase 2 — Plan

1. Explora el código del worktree para entender la estructura, el lenguaje, el framework de tests y las convenciones (busca `package.json`, `pyproject.toml`, `pom.xml`, carpetas `test/`, `tests/`, `__tests__`, etc.).
2. Identifica el comando para ejecutar los tests. Si no existe framework de tests, propón el estándar del lenguaje y añádelo como primer paso del plan.
3. Escribe el plan en `"$WT_PATH/docs/plans/<slug>.md"` con esta estructura:

   ```markdown
   # Plan: <título>

   ## Objetivo
   ## Contexto y archivos afectados
   ## Comando de tests
   ## Ciclos TDD
   1. **Test:** <comportamiento a probar> → **Implementación:** <cambio mínimo>
   2. ...
   ## Riesgos y casos límite
   ## Criterios de aceptación
   ```

   Cada ciclo TDD debe ser pequeño: un comportamiento observable por ciclo.
4. Haz commit del plan en el worktree:
   ```bash
   git -C "$WT_PATH" add docs/plans/<slug>.md
   git -C "$WT_PATH" commit -m "docs: add plan for <slug>"
   ```

### Aviso Slack nº 1 — plan terminado

Envía con `mcp__slack__slack_post_message` al canal elegido:

```
:memo: *Plan listo* — <título>
• Rama: `feature/<slug>`
• Worktree: `<WT_PATH>`
• Ciclos TDD previstos: <N>
• Resumen: <2-3 líneas del objetivo>
```

Muestra también el plan al usuario en el chat y continúa con la implementación.

## Fase 3 — Implementación con TDD

Para **cada** ciclo del plan:

1. **RED** — Escribe el test (en inglés, nombre descriptivo del comportamiento). Ejecuta los tests y **confirma que falla por el motivo esperado** (no por un error de sintaxis o de import). Si pasa sin cambios, el test no aporta: revísalo.
2. **GREEN** — Escribe el código mínimo de producción para que pase. Ejecuta toda la suite y confirma que todo está en verde.
3. **REFACTOR** — Mejora nombres, elimina duplicación, respeta el estilo del código existente. Vuelve a ejecutar la suite: debe seguir en verde.
4. **Commit** del ciclo en el worktree:
   ```bash
   git -C "$WT_PATH" add -A
   git -C "$WT_PATH" commit -m "<feat|fix|test|refactor>: <descripción en inglés>"
   ```

Reglas durante la implementación:
- Si un test falla de forma inesperada 3 veces seguidas, para, analiza la causa y, si es necesario, ajusta el plan (actualiza el archivo del plan y explícalo al usuario).
- No desactives, borres ni marques como `skip` tests existentes para que la suite pase.
- Si descubres trabajo fuera del alcance, anótalo en el plan como "Pendiente" en vez de implementarlo.

## Fase 4 — Verificación final

1. Ejecuta la suite completa en el worktree y, si existen, el linter y el type-checker.
2. Repasa los criterios de aceptación del plan y márcalos como cumplidos o no.
3. Obtén el resumen de cambios:
   ```bash
   git -C "$WT_PATH" log --oneline HEAD@{upstream}..HEAD 2>/dev/null || git -C "$WT_PATH" log --oneline -n 20
   git -C "$WT_PATH" diff --stat <commit-base>..HEAD
   ```

### Aviso Slack nº 2 — implementación terminada

```
:white_check_mark: *Implementación terminada* — <título>
• Rama: `feature/<slug>`
• Worktree: `<WT_PATH>`
• Tests: <N pasan / M en total>
• Commits: <número>
• Archivos modificados: <número>
• Pendientes: <lista o "ninguno">
```

Si la suite no está en verde, usa `:warning: *Implementación terminada con fallos*` y lista los tests que fallan. Nunca anuncies éxito si hay fallos.

## Fase 5 — Cierre

Informa al usuario en el chat de:
- Ruta del worktree y nombre de la rama.
- Resultado de los tests (con la salida relevante si algo falla).
- Si se enviaron correctamente los dos avisos de Slack.
- Siguientes pasos sugeridos: revisar el diff, hacer merge de `feature/<slug>`, y eliminar el worktree con `git worktree remove "<WT_PATH>"`.

**No** hagas merge, push ni elimines el worktree salvo que el usuario lo pida explícitamente.
