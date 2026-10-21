# Flujo institucional de documentos

## Regla obligatoria para documentos salientes

> Todo documento saliente generado por INEDUC debe pasar por la **Dirección de Investigación de la Facultad de Ciencias de la Educación** antes de ser remitido al **Decanato de la Facultad de Ciencias de la Educación**.

```
INEDUC  →  Dirección de Investigación (Director: Dr. Máximo Díaz)  →  Decanato  →  Seguimiento y cierre
```

### Etapas

| # | Identificador interno | Etiqueta en la interfaz | Dependencia actual |
|---|---|---|---|
| 1 | `REGISTRADO_EN_INEDUC` | Registrado en INEDUC | INEDUC |
| 2 | `REMITIDO_A_DIRECCION_INVESTIGACION` | Remitido a la Dirección de Investigación | Dirección de Investigación (pendiente de recepción) |
| 3 | `RECIBIDO_EN_DIRECCION_INVESTIGACION` | Recibido en la Dirección de Investigación | Dirección de Investigación |
| 4 | `EN_GESTION_DIRECCION_INVESTIGACION` | En gestión en la Dirección de Investigación (opcional; no implica aprobación) | Dirección de Investigación |
| 5 | `REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO` | Remitido al Decanato | Decanato (pendiente de recepción) |
| 6 | `RECIBIDO_EN_DECANATO` | Recibido en el Decanato | Decanato |
| 7 | `EN_SEGUIMIENTO` | En seguimiento (opcional) | Decanato |
| 8 | `COMPLETADO` | Completado | Decanato |
| 9 | `ARCHIVADO` | Archivado (terminal) | Decanato |

### Transiciones permitidas

| Desde | Hacia | Origen → destino del traspaso | Debe constar antes en el historial |
|---|---|---|---|
| 1 | 2 | INEDUC → Dirección | Registro |
| 2 | 3 | INEDUC → Dirección | Remisión a la Dirección |
| 3 | 4 | Dirección → Dirección | Recepción en la Dirección |
| 3 o 4 | 5 | Dirección → Decanato | Recepción en la Dirección |
| 5 | 6 | Dirección → Decanato | Remisión desde la Dirección |
| 6 | 7 u 8 | Decanato | Recepción en el Decanato |
| 7 | 8 | Decanato | Recepción en el Decanato |
| 8 | 9 | Decanato | Completado |

Cualquier otra combinación se rechaza. En particular:

- **INEDUC → Decanato** directamente: rechazado.
- **Remitir desde la Dirección** sin haber registrado la recepción en la Dirección: rechazado.
- **Recepción en el Decanato** sin remisión previa desde la Dirección: rechazado.
- **Remitir no equivale a recibir**: cada recepción debe registrarse expresamente.

### Dónde se aplica

La regla se aplica en la base de datos (migración `20261021000200_documents_workflow.sql`), en tres capas independientes:

1. **`public.record_outgoing_transition()`** — única vía para avanzar. Verifica rol de administrador, bloquea la fila del documento (`FOR UPDATE`), compara la etapa esperada por el cliente con la real (concurrencia optimista: si otro usuario se adelantó, responde *SIGED_CONFLICTO*), valida la transición y escribe evento + etapa + dependencia + fecha del hito en una sola transacción.
2. **Trigger de `document_route_events`** — vuelve a validar cada evento contra el estado real y el **historial efectivo** (eventos no revertidos), fija actor (`auth.uid()`) y fecha del servidor, y rechaza transiciones insertadas fuera de una operación de flujo.
3. **Trigger de `documents`** — impide modificar etapa, dependencia o fechas de hitos fuera de una operación de flujo; exige que exista un evento de historial de la misma transacción; valida la transición y la coherencia **etapa ↔ dependencia**. Se aplica incluso a la clave de servicio y al superusuario.

La interfaz (`src/lib/workflow/outgoing.ts`) tiene una copia de la tabla de transiciones solo para mostrar opciones y vistas previas. Una prueba de integración compara ambas definiciones.

### Actor real y dependencia responsable

Cada movimiento registra por separado:

- **la cuenta autenticada que lo registró** (`recorded_by`), y
- **las dependencias institucionales** de origen y destino del traspaso.

El sistema muestra a Dr. Máximo Díaz como director de la Dirección de Investigación, pero **nunca** lo presenta como autor de un movimiento salvo que él mismo lo registre con su cuenta.

### Fechas

Las fechas y horas de los movimientos las genera el servidor (`now()`); el cliente no puede enviarlas ni retrocederlas. Si el acuse físico tiene otra fecha, anótela en las observaciones del movimiento.

### Correcciones

Un movimiento registrado por error se corrige con **«Corregir último»** (`public.reverse_last_movement`):

- solo el último movimiento vigente puede revertirse (en orden inverso),
- el motivo es obligatorio (mínimo 10 caracteres),
- se crea un evento `REVERSION` que apunta al original; **el original no se modifica ni se borra** y aparece marcado como «Revertido»,
- se restaura la etapa y la dependencia anteriores y se limpia la fecha del hito revertido.

El historial (`document_route_events`) es de solo anexado: los triggers rechazan `UPDATE` y `DELETE` para todos los roles.

### Excepciones

No existe ninguna operación para omitir la Dirección de Investigación. Si la institución llegara a definir una excepción, debería implementarse como una operación separada, autorizada por una cuenta designada, con motivo, fecha y evento propio; no se incluyó porque la regla vigente no admite excepciones.

## Documentos entrantes

Los entrantes **no** siguen la ruta de salientes. Su flujo es flexible:

- Estados: Recibido, En revisión, En trámite, Remitido, En espera de respuesta, En seguimiento, Completado, Archivado.
- Un movimiento puede cambiar el estado, la dependencia o ambos (`public.record_incoming_movement`), con la misma validación de concurrencia, actor y fecha del servidor.
- Solo se archivan documentos completados; un documento archivado no admite cambios.

## Trámites

Un documento puede originar varios trámites y un trámite puede no tener documento. Estados: Pendiente, En proceso, En revisión, En espera de respuesta, Completado, Cancelado (con motivo). «Vencido» y «Próximo a vencer» se calculan con la fecha límite, el estado y el umbral configurado; no son estados.
