# [Título de la funcionalidad]

| | |
|---|---|
| **Issue** | [#123](https://github.com/org/repo/issues/123) |
| **Estado** | Borrador |
| **Autor de la issue** | @usuario |
| **Fecha** | AAAA-MM-DD |
| **Etiquetas** | `bug`, `backend` |

## 1. Contexto

Explica qué problema hay hoy y por qué hay que resolverlo. Máximo 3 párrafos.

Incluye lo que se sepa del origen: quién lo reportó, cuántas veces pasa, qué apaño se usa ahora. Si los comentarios de la issue cambiaron algo del planteamiento inicial, dilo aquí.

## 2. Alcance

**Incluido**
- Lo que sí se va a resolver.

**Excluido**
- Lo que alguien podría dar por hecho que entra pero no entra, con el motivo.

## 3. Comportamiento esperado

Describe qué ve o recibe quien lo usa. Un apartado por escenario.

### 3.1 [Nombre del escenario]

**Dado** [estado inicial]
**Cuando** [acción]
**Entonces** [resultado observable]

Concreta códigos de estado, textos de mensajes, forma de la respuesta y estados de la UI.

## 4. Diseño técnico

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `ruta/al/archivo.ts` | Qué se modifica |
| `ruta/nueva/archivo.ts` | Nuevo — qué hace |

### Enfoque

Di qué patrón del repositorio hay que seguir y nombra el precedente: "igual que `X` en `ruta/y.ts`". Si descartaste otra opción razonable, explica por qué en una línea.

### Modelo de datos / contratos

Tipos, esquemas, columnas, payloads y migraciones nuevos o modificados.

## 5. Casos borde y errores

| Situación | Comportamiento esperado |
|---|---|
| | |

Rellena con las situaciones reales de esta issue. Borra las que no apliquen.

## 6. Plan de implementación

Pasos en orden. Cada paso debe poder revisarse por separado.

1. [ ] Paso — archivos implicados
2. [ ] Paso — archivos implicados
3. [ ] Tests
4. [ ] Documentación / changelog

## 7. Criterios de aceptación

Condiciones que cierran la issue. Cada una debe poder comprobarse sin discusión.

- [ ] …
- [ ] …

### Tests

- **Unitarios:** qué se cubre y dónde van.
- **Integración / E2E:** qué flujos hay que cubrir.

## 8. Impacto y riesgos

- **Retrocompatibilidad:** ¿rompe algo? ¿hace falta migración o feature flag?
- **Rendimiento:** consultas nuevas, bucles grandes, llamadas externas añadidas.
- **Seguridad:** datos sensibles, permisos, validación de entrada.
- **Operación:** configuración, variables de entorno, logs o métricas nuevas.

## 9. Suposiciones y preguntas abiertas

**Suposiciones** — lo que decidiste sin confirmar. Revísalo antes de implementar.
- …

**Preguntas abiertas** — qué falta por decidir y quién debe decidirlo.
- …