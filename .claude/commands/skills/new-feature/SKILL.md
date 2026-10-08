---
name: new-feature
description: Lee una issue de GitHub con gh a partir de su número, crea una rama de trabajo a partir de development (o main si no existe), redacta un plan por tareas pequeñas, lo publica como comentario en la issue y lo implementa con TDD estricto. Úsala cuando se pida planificar o implementar una issue.
argument-hint: <número-de-issue>
---

# new-feature

Issue a planificar: #$ARGUMENTS

## 0. Leer la issue

1. `$ARGUMENTS` debe ser el número de una issue (por ejemplo `42` o `#42`; quita el `#` si lo trae). Si está vacío o no es un número, pide al usuario el número de la issue y no continúes hasta tenerlo.
2. Lee la issue con GitHub CLI desde la raíz del repositorio:

   ```bash
   gh issue view <numero> --json number,title,body,author,labels,state,url,createdAt,comments
   ```

   - Si `gh` falla por autenticación, pide al usuario que ejecute `! gh auth login` y detente.
   - Si la issue no existe, avisa al usuario y detente.
   - Si la issue está cerrada (`state: CLOSED`), avisa al usuario y pregunta si quiere continuar.
3. Usa el título, el cuerpo **y los comentarios** como fuente de requisitos: los comentarios pueden matizar o cambiar el planteamiento inicial. Si la issue es ambigua o le falta información para planificar, pregunta al usuario antes de seguir.

## 1. Crear la rama

1. Deduce el `<tipo>` de la tarea a partir de la issue (título, cuerpo y etiquetas): `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, etc. (mismos tipos que Conventional Commits).
2. Deduce una `<descripcion>` corta en kebab-case (por ejemplo `anadir-filtro-por-canal`), sin tildes ni espacios.
3. El nombre de la rama es `<tipo>/<numero>-<descripcion>` (por ejemplo `feat/42-anadir-filtro-por-canal`).
4. Elige la rama base:
   - Si existe `development` (`git rev-parse --verify --quiet development`, o `origin/development`), úsala como base.
   - Si no existe, usa `main` (o `master` si tampoco existe `main`).
5. Crea la rama desde la base: `git switch -c <tipo>/<numero>-<descripcion> <base>`.
   - Si hay cambios sin commitear que puedan interferir, avisa al usuario antes de cambiar de rama; no los descartes.
   - Si la rama ya existe, avisa al usuario en lugar de sobrescribirla.

## 2. Crear el plan

Guarda el plan en `docs/plans/<numero>-<tipo>-<descripcion>.md` (crea la carpeta si no existe). Esta copia local es la que se va actualizando durante la implementación. El plan se escribe en español y tiene la estructura definida en `assets/TEMPLATE.md`. Rellena los apartados con la información que tengas, aunque sea parcial. No dejes apartados vacíos.

La cabecera del plan se rellena con los datos reales de la issue: enlace (`url`) y número, autor (`author.login`), fecha de hoy y etiquetas (`labels`). El apartado de Contexto debe reflejar lo que aporten los comentarios de la issue.

Reglas para las tareas:

- Cada tarea debe poder implementarse en **5-10 minutos como máximo**. Si es más grande, divídela.
- Cada tarea describe un único cambio verificable, indicando el test que lo cubre y los ficheros que toca.
- Ordénalas para que el proyecto funcione tras cada una.
- Respeta la arquitectura y las convenciones de `CLAUDE.md`. En la API conviven dos estilos: hexagonal + DDD en `src/contexts/employee/` y por capas (`models` → `repositories` → `services` → `controllers` → `routes`) para restaurant, dish, ingredient y order. Sigue el estilo del dominio que toques.
- Antes de escribir el plan, explora el código relevante para que las tareas sean realistas.

Muestra el plan al usuario y espera su confirmación. Si pide cambios, aplícalos en el fichero y vuelve a mostrárselo.

## 2.1 Publicar el plan en la issue

Cuando el usuario confirme el plan, publícalo como comentario en la issue usando el fichero como cuerpo (así se evitan problemas de comillas y saltos de línea en la shell):

```bash
gh issue comment <numero> --body-file docs/plans/<numero>-<tipo>-<descripcion>.md
```

- Publica el comentario una sola vez. Si después cambia el plan de forma relevante, pregunta al usuario si quiere actualizar el comentario (`gh issue comment <numero> --edit-last --body-file <fichero>`) en lugar de crear otro.
- Muestra al usuario la URL del comentario que devuelve `gh`.
- Si la publicación falla, informa del error y no empieces a implementar hasta que el usuario decida cómo seguir.

Después, empieza la implementación.

## 3. Implementar con TDD estricto

Para **cada** tarea, en orden, sigue el ciclo completo sin saltarte ningún paso:

1. **Red**: escribe primero el test que describe el comportamiento esperado. Ejecútalo y comprueba que **falla** por el motivo correcto. Si pasa sin código nuevo, el test no sirve: corrígelo.
2. **Green**: escribe el mínimo código de producción necesario para que el test pase. Nada más.
3. **Refactor**: limpia el código y los tests manteniendo todo en verde.
4. Ejecuta la **suite completa** y comprueba que todo pasa.
5. Marca la tarea en el plan (`- [ ]` → `- [x]`) **inmediatamente**, antes de empezar la siguiente.

Notas:

- No escribas código de producción sin un test en rojo que lo justifique.
- No avances a la siguiente tarea si la suite no está en verde.
- Los tests de la API usan vitest y van junto al código (`*.test.ts`). Ejecuta la suite completa con `npm test` desde la raíz del monorepo y un test concreto con `npx vitest run <ruta>` desde `packages/api`. Reutiliza los dobles de `contexts/employee/application/mocks/` y `repositories/mocks/`.
- Los frontends no tienen tests. Si una tarea solo toca el frontend, verifícala con `npm run build -w <paquete>` en lugar del ciclo Red/Green, y dilo en el plan.
- Los tests no deben tocar la base de datos real: con `NODE_ENV=test` la base de datos vive en memoria (`:memory:`).
- El código y los tests se escriben en inglés; el plan y los mensajes al usuario, en español.

## 4. Cierre

Cuando todas las tareas estén marcadas, ejecuta la suite completa una última vez y resume al usuario qué se ha hecho. No hagas commit ni push salvo que el usuario lo pida (para commits está la skill `commit`).