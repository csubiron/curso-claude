---
name: new-feature
description: Crea una rama de trabajo a partir de development (o master si no existe), redacta un plan por tareas pequeñas en docs/plans y lo implementa con TDD estricto. Úsala cuando se pida una nueva funcionalidad, corrección o refactor.
---

# new-feature

Tarea a resolver: $ARGUMENTS

Si `$ARGUMENTS` está vacío o es ambiguo, pregunta al usuario qué quiere hacer antes de continuar.

## 1. Crear la rama

1. Deduce el `<tipo>` de la tarea: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, etc. (mismos tipos que Conventional Commits).
2. Deduce una `<descripcion>` corta en kebab-case (por ejemplo `anadir-filtro-por-canal`), sin tildes ni espacios.
3. El nombre de la rama es `<tipo>/<descripcion>`.
4. Elige la rama base:
   - Si existe `development` (`git rev-parse --verify --quiet development`, o `origin/development`), úsala como base.
   - Si no existe, usa `master`.
5. Crea la rama desde la base: `git switch -c <tipo>/<descripcion> <base>`.
   - Si hay cambios sin commitear que puedan interferir, avisa al usuario antes de cambiar de rama; no los descartes.
   - Si la rama ya existe, avisa al usuario en lugar de sobrescribirla.

## 2. Crear el plan

Guarda el plan en `docs/plans/<tipo>-<descripcion>.md` (crea la carpeta si no existe). El plan se escribe en español y tiene la estructura definida en `assets/TEMPLATE.md`. Rellena los apartados con la información que tengas, aunque sea parcial. No dejes apartados vacíos.

Reglas para las tareas:

- Cada tarea debe poder implementarse en **5-10 minutos como máximo**. Si es más grande, divídela.
- Cada tarea describe un único cambio verificable, indicando el test que lo cubre y los ficheros que toca.
- Ordénalas para que el proyecto funcione tras cada una.
- Respeta la arquitectura del proyecto (`routes` → `controllers` → `services` → `repositories` → `db.js`) y las convenciones de `CLAUDE.md`.
- Antes de escribir el plan, explora el código relevante para que las tareas sean realistas.

Muestra el plan al usuario y espera su confirmación antes de implementar.

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
- El proyecto no tiene test runner configurado. Si aún no hay tests, la primera tarea del plan debe preparar la infraestructura de tests usando el runner integrado de Node (`node --test`, módulo `node:test`), sin añadir dependencias, y añadir el script `npm test`.
- Los tests no deben tocar la base de datos real: usa `DB_PATH` apuntando a una base temporal o `:memory:`.
- El código y los tests se escriben en inglés; el plan y los mensajes al usuario, en español.

## 4. Cierre

Cuando todas las tareas estén marcadas, ejecuta la suite completa una última vez y resume al usuario qué se ha hecho. No hagas commit ni push salvo que el usuario lo pida (para commits está la skill `commit`).