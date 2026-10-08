---
name: new-feature
description: Recibe el número de una issue de GitHub, la lee con gh, crea una rama de trabajo a partir de development (o main si no existe), redacta un plan por tareas pequeñas en docs/plans y lo publica como comentario en la issue. Úsala cuando se pida planificar una issue (nueva funcionalidad, corrección o refactor).
argument-hint: <número-de-issue>
---

# new-feature

Número de la issue a planificar: $ARGUMENTS

## 0. Leer la issue

1. Comprueba que `$ARGUMENTS` es un número de issue (se acepta también con `#` delante, por ejemplo `#42`; quítalo antes de usarlo). Si está vacío o no es un número, pide al usuario el número de la issue y no continúes hasta tenerlo.
2. Comprueba que `gh` está disponible y autenticado (`gh auth status`). Si no lo está, pide al usuario que ejecute `! gh auth login` y detente.
3. Lee la issue con sus comentarios:

   ```bash
   gh issue view <numero> --json number,title,body,author,labels,state,url,comments
   ```

   - Si la issue no existe, avisa al usuario y detente.
   - Si la issue está cerrada (`state: CLOSED`), avisa al usuario y pregunta si quiere continuar igualmente.
4. Usa el título, la descripción, las etiquetas y **todos los comentarios** como fuente de requisitos. Los comentarios pueden matizar o cambiar lo pedido en la descripción.
5. Si la issue es ambigua o le falta información imprescindible para planificar, pregunta al usuario antes de continuar.

## 1. Crear la rama

1. Deduce el `<tipo>` de la tarea a partir de la issue (etiquetas y contenido): `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, etc. (mismos tipos que Conventional Commits).
2. Deduce una `<descripcion>` corta en kebab-case a partir del título de la issue (por ejemplo `anadir-filtro-por-canal`), sin tildes ni espacios.
3. El nombre de la rama es `<tipo>/<numero>-<descripcion>` (por ejemplo `feat/42-anadir-filtro-por-canal`).
4. Elige la rama base:
   - Si existe `development` (`git rev-parse --verify --quiet development`, o `origin/development`), úsala como base.
   - Si no existe, usa `main` (o `master` si tampoco existe `main`).
5. Crea la rama desde la base: `git switch -c <tipo>/<numero>-<descripcion> <base>`.
   - Si hay cambios sin commitear que puedan interferir, avisa al usuario antes de cambiar de rama; no los descartes.
   - Si la rama ya existe, avisa al usuario en lugar de sobrescribirla.

## 2. Crear el plan

Guarda el plan en `docs/plans/<numero>-<tipo>-<descripcion>.md` (crea la carpeta si no existe). El plan se escribe en español y tiene la estructura definida en `assets/TEMPLATE.md`.

Rellena la cabecera con los datos reales de la issue:

- **Issue**: `[#<numero>](<url>)`.
- **Autor de la issue**: `@<author.login>`.
- **Etiquetas**: las etiquetas de la issue (o `—` si no tiene).
- **Fecha**: la fecha de hoy.

Reglas para las tareas:

- Cada tarea debe poder implementarse en **5-10 minutos como máximo**. Si es más grande, divídela.
- Cada tarea describe un único cambio verificable, indicando el test que lo cubre y los ficheros que toca.
- Ordénalas para que el proyecto funcione tras cada una.
- Respeta la arquitectura y las convenciones de `CLAUDE.md`. En la API conviven dos estilos: hexagonal + DDD en `src/contexts/employee/` y por capas (`models` → `repositories` → `services` → `controllers` → `routes`) para restaurant, dish, ingredient y order. Sigue el estilo del dominio que toques.
- Los tests de la API usan vitest y van junto al código (`*.test.ts`). Los frontends no tienen tests: si una tarea solo toca un frontend, indica que se verifica con su build (`npm run build -w <paquete>`).
- Antes de escribir el plan, explora el código relevante para que las tareas sean realistas.
- Los criterios de aceptación deben cubrir todo lo que pide la issue (incluidos sus comentarios).

Muestra el plan al usuario y espera su confirmación. Si pide cambios, aplícalos al fichero y vuelve a mostrarlo.

## 3. Publicar el plan en la issue

Cuando el usuario confirme el plan, publícalo como comentario en la issue usando el propio fichero como cuerpo (así se evitan problemas de escapado):

```bash
gh issue comment <numero> --body-file docs/plans/<numero>-<tipo>-<descripcion>.md
```

- Muestra al usuario la URL del comentario que devuelve `gh`.
- Si el comando falla (permisos, red, etc.), muestra el error al usuario y pregúntale cómo quiere seguir. Sin el comentario publicado, `implement-issue` no podrá encontrar el plan.
- Si más adelante el plan cambia de forma relevante, publica un nuevo comentario con el plan completo, precedido de un breve resumen de qué ha cambiado. No edites comentarios antiguos. `implement-issue` usa siempre el comentario más reciente que contenga el plan.

## 4. Cierre

Resume al usuario:

- La rama creada.
- La ruta del plan.
- La URL del comentario publicado.
- El número de tareas del plan.

Indícale que puede implementarlo con `/implement-issue <numero>`. No implementes nada, no hagas commit ni push y no cierres la issue salvo que el usuario lo pida (para commits está la skill `commit`).