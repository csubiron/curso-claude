---
description: Crea un commit siguiendo la especificación Conventional Commits
argument-hint: "[tipo(scope)] [descripción opcional]"
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*)
---

Crea un commit siguiendo la especificación [Conventional Commits 1.0.0](https://www.conventionalcommits.org/es/v1.0.0/).

## Contexto actual

- Estado del repositorio: !`git status --short`
- Cambios preparados (staged): !`git diff --cached`
- Cambios sin preparar: !`git diff`
- Últimos commits (para seguir el estilo): !`git log --oneline -10 2>/dev/null || echo "(todavía no hay commits)"`

## Indicaciones del usuario

$ARGUMENTS

## Instrucciones

1. Si no hay nada en staging, pregunta antes de hacer `git add`. No añadas archivos sensibles (`.env`, credenciales, `data/*.db`).
2. Analiza los cambios y elige el **tipo** adecuado:
   - `feat`: nueva funcionalidad
   - `fix`: corrección de un bug
   - `docs`: solo documentación (README, CLAUDE.md…)
   - `style`: formato, sin cambios de lógica
   - `refactor`: cambio de código que no añade funcionalidad ni corrige bugs
   - `perf`: mejora de rendimiento
   - `test`: añadir o corregir tests
   - `build`: dependencias o sistema de build (`package.json`…)
   - `ci`: configuración de integración continua
   - `chore`: tareas de mantenimiento que no tocan `src/` ni `test/`
   - `revert`: revierte un commit anterior
3. Elige un **scope** opcional que refleje la zona afectada (p. ej. `vendehumos`, `auth`, `db`, `middleware`, `validators`).
4. Redacta el mensaje con este formato:

   ```
   <tipo>(<scope>): <descripción>

   [cuerpo opcional]

   [footer(s) opcional(es)]
   ```

   - Descripción en imperativo, en minúscula, sin punto final y de 72 caracteres como máximo.
   - El cuerpo explica el *qué* y el *porqué*, no el *cómo*. Sepáralo con una línea en blanco.
   - Si hay un cambio incompatible, añade `!` tras el tipo/scope (`feat(auth)!: ...`) y un footer `BREAKING CHANGE: <explicación>`.
   - Referencias a issues en el footer: `Refs: #123` o `Closes: #123`.
5. Si los cambios mezclan propósitos distintos, propón dividirlos en varios commits.
6. Si el usuario ha indicado tipo, scope o descripción en los argumentos, respétalos.
7. Muestra el mensaje propuesto y haz el commit con `git commit` (usa un heredoc para mensajes multilínea). No uses `--no-verify` ni `--amend` salvo que se pida explícitamente.
8. Termina mostrando `git log --oneline -1` para confirmar el resultado.
