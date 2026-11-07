# CER Analytics — Especificación técnica V0.2

**Estado:** propuesta revisada para aprobación previa a implementación
**Fecha:** 6 de noviembre de 2026
**Alcance:** documentación técnica; no se implementa código

## 1. Objetivo y alcance

La V0.2 desarrolla la especificación aprobada como propuesta de arquitectura y resuelve el diseño de lotes de importación, atributos de datos, ejecución de parsers y matriz de permisos. La primera versión cubre aplicación web responsive, autenticación, configuración de fundos, cuarteles, importación Excel/CSV y KML/GeoJSON, validación y corrección antes de confirmar, Leaflet, asignaciones y recuperación del onboarding.

Quedan fuera: operación offline, dibujo manual de polígonos, Shapefile e historial avanzado de cosechas. No se modifican el prototipo HTML ni los PDF de referencia. Los valores del prototipo no se convierten en reglas productivas.

Las etiquetas usadas son **Documentado** (aparece en el material del proyecto o en alcance aprobado), **Propuesta** (diseño técnico sugerido) y **Pendiente** (requiere aprobación de CER Analytics).

## 2. Requisitos funcionales y no funcionales

### Funcionales

| ID | Requisito | Criterio de aceptación |
|---|---|---|
| RF-01 | Registro, inicio y cierre de sesión | La identidad se administra con Supabase Auth y las rutas/mutaciones exigen sesión cuando corresponde. |
| RF-02 | Fundos y membresías | Un usuario autorizado crea o administra fundos y ve únicamente los fundos a los que pertenece. |
| RF-03 | Onboarding recuperable | El avance y los datos no confirmados quedan guardados y se pueden recuperar después de cerrar sesión. |
| RF-04 | Lote de importación | Un lote agrupa un archivo tabular y uno o varios archivos geográficos, sus validaciones, staging, vínculos y resultado de confirmación. |
| RF-05 | Excel/CSV | El usuario autorizado carga y revisa filas/columnas, corrige valores de staging y ve errores antes de confirmar. |
| RF-06 | KML/GeoJSON | El usuario autorizado carga y revisa entidades geométricas, corrige propiedades/mapeos permitidos y ve errores antes de confirmar. |
| RF-07 | Relacionar datos | El usuario revisa la correspondencia de filas y geometrías; no se confirma una relación ambigua. |
| RF-08 | Confirmar una sola vez | Un lote listo se confirma de forma idempotente; un reintento no duplica los efectos ya aplicados. |
| RF-09 | Mapa | Leaflet muestra las geometrías confirmadas que el usuario puede consultar. |
| RF-10 | Equipo | El usuario autorizado gestiona miembros/roles y asigna muestreadores a cuarteles según permisos aprobados. |

### No funcionales

- Aislamiento por fundo mediante autorización del servidor y RLS; la UI no es una barrera de seguridad.
- Archivos originales privados, límites explícitos y trazabilidad de acceso/importación.
- Los datos vigentes no se alteran hasta que el usuario confirma el lote.
- Despliegue Next.js App Router en Vercel, con persistencia en Supabase; sin depender del disco local de Functions.
- Interfaz responsive y errores que identifiquen archivo, fila/campo o geometría.
- Operación de parsing limitada por topes medidos antes del piloto. La meta de onboarding inferior a diez minutos es hipótesis de producto, no SLA de V1.

## 3. Modelo de datos

### 3.1 Separación de clases de datos

| Clase | Diseño propuesto | Situación de los datos |
|---|---|---|
| Estructurales | Columnas relacionales y tipos explícitos: IDs, pertenencia a fundo, actor/rol, estado, tiempos, identificadores fuente, relación entre entidades y geometría PostGIS. | Modelo técnico necesario. Los nombres/campos visibles de negocio y cardinalidades se confirman con CER. |
| Agronómicos conocidos en las referencias | Candidatos: especie, variedad, año de plantación, densidad; se mencionan datos históricos de cosecha en los documentos. | Son campos nombrados en el prototipo/informes, pero el diccionario, obligatoriedad, tipo/unidad y rangos **no están aprobados**. Historia avanzada queda fuera de V1. |
| Personalizados futuros | Definiciones de atributos por entidad/fundo y valores separados del esquema estructural. | Extensión futura propuesta. No habilitar campos arbitrarios ni convertirlos en reglas de producción sin gobierno y validación. |

No se recomienda guardar campos estructurales ni atributos agronómicos confirmados en un `JSONB` general: dificultaría tipos, restricciones, índices y evolución controlada. `JSONB` se limita a contenido de origen conservado, configuración del mapeo de columnas, errores, resumen, valores de borrador aún no confirmados y valores personalizados gobernados.

### 3.2 Entidades y relaciones

```mermaid
erDiagram
  AUTH_USERS ||--o| PROFILES : perfil
  PROFILES ||--o{ FARM_MEMBERSHIPS : participa
  FARMS ||--o{ FARM_MEMBERSHIPS : tiene
  FARMS ||--o{ BLOCKS : contiene
  BLOCKS ||--o{ BLOCK_PLANTINGS : contiene
  FARM_MEMBERSHIPS ||--o{ BLOCK_ASSIGNMENTS : asignada
  BLOCKS ||--o{ BLOCK_ASSIGNMENTS : recibe
  FARMS ||--o{ IMPORT_BATCHES : agrupa
  PROFILES ||--o{ IMPORT_BATCHES : inicia
  IMPORT_BATCHES ||--|{ IMPORT_FILES : incluye
  IMPORT_FILES ||--o{ IMPORT_VALIDATIONS : valida
  IMPORT_BATCHES ||--o{ STAGED_BLOCKS : prepara
  IMPORT_BATCHES ||--o{ STAGED_GEOMETRIES : prepara
  IMPORT_FILES ||--o{ STAGED_BLOCKS : origen_tabular
  IMPORT_FILES ||--o{ STAGED_GEOMETRIES : origen_geografico
  STAGED_BLOCKS ||--o{ BATCH_GEOMETRY_LINKS : relaciona
  STAGED_GEOMETRIES ||--o{ BATCH_GEOMETRY_LINKS : relaciona
  IMPORT_BATCHES ||--o| IMPORT_CONFIRMATIONS : resultado
  IMPORT_BATCHES ||--o{ BATCH_BLOCK_RESULTS : aplica
  BLOCKS ||--o{ BATCH_BLOCK_RESULTS : resultado_de
  IMPORT_BATCHES ||--o{ BATCH_AUDIT_EVENTS : registra
  FARMS ||--o{ INVITATIONS : invita
  PROFILES ||--o{ ONBOARDING_DRAFTS : edita
  FARMS ||--o{ ONBOARDING_DRAFTS : configura
  FARMS ||--o{ ATTRIBUTE_DEFINITIONS : define
  ATTRIBUTE_DEFINITIONS ||--o{ CUSTOM_ATTRIBUTE_VALUES : tipa

  PROFILES {
    uuid id PK
    text display_name
    timestamptz created_at
  }
  FARMS {
    uuid id PK
    text name
    text region_code "pendiente de diccionario"
    uuid created_by FK
    timestamptz created_at
    timestamptz updated_at
  }
  FARM_MEMBERSHIPS {
    uuid id PK
    uuid farm_id FK
    uuid user_id FK
    text role
    text status
    timestamptz created_at
  }
  BLOCKS {
    uuid id PK
    uuid farm_id FK
    text external_code "clave de negocio por confirmar"
    geometry geom "PostGIS, SRID acordado"
    uuid created_by FK
    timestamptz created_at
    timestamptz updated_at
  }
  BLOCK_PLANTINGS {
    uuid id PK
    uuid block_id FK
    text species "candidato, confirmar"
    text variety "candidato, confirmar"
    smallint planting_year "candidato, confirmar"
    numeric density "unidad/reglas por confirmar"
  }
  BLOCK_ASSIGNMENTS {
    uuid id PK
    uuid block_id FK
    uuid membership_id FK
    uuid assigned_by FK
    timestamptz created_at
  }
  IMPORT_BATCHES {
    uuid id PK
    uuid farm_id FK
    uuid initiated_by FK
    text status
    uuid idempotency_key
    text parser_version
    timestamptz created_at
    timestamptz updated_at
  }
  IMPORT_FILES {
    uuid id PK
    uuid batch_id FK
    text kind "tabular o geographic"
    text original_name
    text storage_path UK
    text detected_format
    bigint size_bytes
    text sha256
    text status
    timestamptz uploaded_at
  }
  IMPORT_VALIDATIONS {
    uuid id PK
    uuid batch_id FK
    uuid file_id FK
    text scope
    text severity
    text code
    text location_ref
    jsonb details
    timestamptz created_at
  }
  STAGED_BLOCKS {
    uuid id PK
    uuid batch_id FK
    uuid source_file_id FK
    bigint source_row_number
    text external_code
    text species "candidato, confirmar"
    text variety "candidato, confirmar"
    smallint planting_year "candidato, confirmar"
    numeric density "unidad/reglas por confirmar"
    jsonb source_payload
    text status
  }
  STAGED_GEOMETRIES {
    uuid id PK
    uuid batch_id FK
    uuid source_file_id FK
    bigint source_feature_number
    text external_code
    geometry geom "geometría importada normalizada"
    jsonb source_properties
    text status
  }
  BATCH_GEOMETRY_LINKS {
    uuid id PK
    uuid batch_id FK
    uuid staged_block_id FK
    uuid staged_geometry_id FK
    text link_method
    uuid linked_by FK
    timestamptz linked_at
  }
  IMPORT_CONFIRMATIONS {
    uuid id PK
    uuid batch_id FK_UQ
    uuid confirmed_by FK
    text status
    jsonb result_summary
    timestamptz confirmed_at
  }
  BATCH_BLOCK_RESULTS {
    uuid id PK
    uuid batch_id FK
    uuid block_id FK
    uuid staged_block_id FK
    text operation
    timestamptz applied_at
  }
  BATCH_AUDIT_EVENTS {
    uuid id PK
    uuid batch_id FK
    uuid actor_id FK
    text event_type
    jsonb event_summary
    timestamptz created_at
  }
  INVITATIONS {
    uuid id PK
    uuid farm_id FK
    text recipient
    text role
    text status
    uuid created_by FK
    timestamptz expires_at
  }
  ONBOARDING_DRAFTS {
    uuid id PK
    uuid farm_id FK
    uuid updated_by FK
    text current_step
    jsonb draft_data
    timestamptz updated_at
  }
  ATTRIBUTE_DEFINITIONS {
    uuid id PK
    uuid farm_id FK
    text entity_type
    text key
    text value_type
    jsonb validation_schema
    boolean active
  }
  CUSTOM_ATTRIBUTE_VALUES {
    uuid id PK
    uuid definition_id FK
    uuid entity_id
    jsonb value
  }
```

**Notas del ERD:** `BLOCK_PLANTINGS` y los cuatro atributos que muestra son estructura candidata, no afirmación de esquema oficial. La cardinalidad cuartel-plantación necesita confirmación; podría implementarse inicialmente como un registro por cuartel si CER confirma esa regla. `entity_id` de valores personalizados es polimórfico y no tiene FK relacional simple; si se activa, se debe restringir por trigger/tablas especializadas o cambiarlo a tablas de valores por entidad. No es necesario implementar atributos personalizados en V1.

### 3.3 Restricciones relacionales del lote

1. **Un solo archivo tabular por lote:** índice único parcial en `IMPORT_FILES(batch_id)` para `kind = 'tabular'`. Debe haber al menos un archivo tabular antes de pasar el lote a `ready_to_confirm`.
2. **Uno o más archivos geográficos:** `kind = 'geographic'` admite varias filas. La regla de si se requiere al menos uno o se permiten lotes solo tabulares queda pendiente; el alcance actual incluye carga de ambas clases.
3. **Archivos:** `storage_path` único; `kind` y `status` con `CHECK`/enum; `size_bytes >= 0`; formato detectado derivado del contenido, no confiado desde el cliente. Original inmutable; correcciones residen en staging.
4. **Fuente:** `(source_file_id, source_row_number)` único en filas staging; `(source_file_id, source_feature_number)` único en geometrías staging. Los números de origen comienzan en la convención documentada del parser (propuesta: 1-based para filas visibles, registrar encabezado separadamente).
5. **Integridad del staging:** toda fila/geom y vínculo referencia el mismo `batch_id`; aplicar FK compuesta `(id, batch_id)` o triggers equivalentes para impedir vínculos cruzados entre lotes.
6. **Relaciones:** `BATCH_GEOMETRY_LINKS` lleva FK a lote, fila y geometría; `UNIQUE(batch_id, staged_block_id, staged_geometry_id)` evita duplicar el mismo vínculo. No se agrega unicidad por fila o geometría hasta confirmar cardinalidad (uno-a-uno, uno-a-varios o muchos-a-muchos).
7. **Validaciones:** errores y advertencias se separan por `severity`; código estable; `location_ref` identifica archivo/fila/campo/feature. Las validaciones se pueden recalcular por `parser_version`; no se pisan correcciones sin registrar nueva revisión.
8. **Idempotencia de lote:** `UNIQUE(farm_id, idempotency_key)` evita crear dos lotes por reintento de solicitud. Un lote tiene como máximo una fila `IMPORT_CONFIRMATIONS` (`UNIQUE(batch_id)`). Estados y cambio a `confirming` se bloquean con transición condicional/lock para impedir confirmaciones concurrentes.
9. **No duplicar cuarteles:** la confirmación ejecuta dentro de transacción y registra los efectos en `BATCH_BLOCK_RESULTS` con `UNIQUE(batch_id, block_id)`. La repetición del mismo lote devuelve el resultado ya guardado. Prevenir duplicados entre lotes distintos requiere una clave de negocio aprobada; se recomienda `UNIQUE(farm_id, external_code)` solo cuando CER confirme que el código es estable y único. Sin clave estable, el sistema puede garantizar idempotencia por lote, pero no deduplicación semántica entre archivos/lotes.
10. **Confirmación conjunta:** aplicar filas, geometrías y relaciones del mismo lote en una única transacción lógica. Si no se puede completar, no dejar estado parcialmente confirmado; registrar `failed`/resultado de error y permitir reintento seguro.
11. **Aislamiento:** `farm_id` presente en lote y entidades del fundo; permisos/RLS impiden cruzar fundos. FK evita asignar archivos o staging a otra granja.

## 4. Arquitectura de procesamiento

```mermaid
sequenceDiagram
  actor U as Usuario
  participant B as Navegador
  participant V as Next.js / Vercel
  participant A as Supabase Auth
  participant S as Supabase Storage privado
  participant D as PostgreSQL + PostGIS / RLS
  participant X as Procesador externo eventual

  U->>B: Selecciona tabla y archivo(s) geográficos
  B->>V: Crear lote (metadatos, sesión)
  V->>A: Validar JWT/sesión
  V->>D: Verificar membresía y crear import_batch
  V-->>B: IDs + permisos de carga acotados
  B->>S: Subir originales directamente (sin pasar binarios por Vercel)
  B->>V: Finalizar carga / solicitar validación
  V->>D: Verificar propietario, hashes, límites y estado
  alt Dentro de límites V1 medidos
    V->>S: Leer objeto privado
    V->>V: Parsear en runtime Node aislado por límites; normalizar/validar
    V->>D: Guardar staging, vínculos y errores
  else Fuera de límites V1, solo tras aprobar evolución
    V->>D: Encolar trabajo/referencia y estado
    V->>X: Procesamiento asíncrono de referencia privada
    X->>S: Leer original autorizado
    X->>D: Guardar staging/resultado con identidad de servicio restringida
  end
  D-->>B: Errores, preview y estado de lote
  U->>B: Corrige datos, asigna enlaces y confirma
  B->>V: Solicitar confirmación con versión del lote
  V->>D: Revalidar permisos/estado, transacción idempotente
  D-->>B: Resultado persistido y mapa listo
```

### Responsabilidad por componente

| Componente | Operaciones en V1 |
|---|---|
| Navegador | Selección de archivos; comprobaciones UX de extensión/tamaño; subida directa a Storage con autorización limitada; edición de valores de staging; visualización de preview saneado y mapa Leaflet. Nunca decide permisos finales ni reglas autoritativas. |
| Next.js en Vercel | Autenticación de cada acción; autorización por fundo/rol; creación de lote y permisos de carga; finalización/estado; parsing acotado de objetos privados; validaciones estructurales; guardado de errores/staging; confirmación transaccional vía operación de servidor/DB. Secretos solo server-side. |
| Supabase Auth | Identidad, sesión y tokens. Política exacta de registro/invitación pendiente. |
| Supabase Storage | Originales en bucket privado, rutas opacas segregadas por entorno/fundo/lote, restricciones de tamaño/tipo configurables, políticas de acceso y ciclo de vida aprobado. |
| PostgreSQL/PostGIS | Membresías y permisos RLS; entidades y staging; validaciones/estados; constraints e idempotencia; persistencia y consultas espaciales. Las geometrías se guardan en SRID acordado; PostGIS valida y consulta datos, no sustituye la revisión del usuario. |
| Procesador externo eventual | Solo si benchmark demuestra que un tamaño/carga soportada excede de forma regular los límites razonables de una Function. Recibe referencia a objeto privado y un trabajo idempotente; no es requisito de V1 ni se selecciona proveedor/cola en esta etapa. |

### Vercel, parser y límites

- La documentación actual de Vercel establece 4,5 MB como máximo del body de solicitud/respuesta de una Function. Por eso el archivo va directo del navegador a Storage; la Function recibe identificadores y metadatos, no el binario del cliente.
- La descarga del objeto desde Storage para parsear evita el límite del body de entrada, pero no los límites de tiempo, memoria, CPU, bundle o tamaño de respuesta de la Function. V1 requiere topes configurables y medidos para bytes descomprimidos, hojas/filas, features y vértices, más pruebas con archivos representativos.
- Los límites de duración dependen de configuración y plan de Vercel. No se asume que extender `maxDuration` haga seguro o económico parsear archivos arbitrariamente grandes.
- Los originales se mantienen privados. Validar extensión + MIME + firma/contenido; no confiar en `Content-Type` del cliente. Calcular hash para integridad/detección de repetición, sin usar hash como deduplicación de entidades de negocio.
- XLSX es contenedor ZIP: limitar entradas y tamaño descomprimido, rechazar archivos cifrados/dañados y contenido activo no admitido; nunca ejecutar macros ni fórmulas. Definir si se importan valores calculados o se rechazan fórmulas.
- KML/XML: desactivar DTD, entidades externas y resolución de red (mitigar XXE/SSRF); imponer profundidad/tamaño y no resolver referencias remotas. GeoJSON: limitar profundidad, cantidad de features/coordenadas, aceptar solo tipos aprobados y rechazar NaN/Infinity/geometrías fuera de límites.
- Parsers se ejecutan en Node runtime de servidor, no Edge, salvo que una evaluación específica pruebe compatibilidad. No se elige biblioteca hasta comprobar mantenimiento, licencia, seguridad, soporte de formato/CRS y peso de bundle.
- Si los benchmarks no cumplen límites acordados, reducir el límite máximo o aprobar una arquitectura asíncrona antes de ampliar capacidad. No se incorporan colas, workers ni servicios externos por anticipado.

## 5. Matriz de roles y permisos

### Claves de lectura

- **D:** capacidad o necesidad descrita en la documentación del proyecto, sin que esto defina por sí sola el detalle de seguridad.
- **P:** propuesta de permiso mínimo para V1, requiere aprobación de CER.
- **—:** no otorgado en la propuesta inicial.
- **Futuro:** alcance posterior a V1.

El requisito documentado de más alto nivel es segmentar privilegios por roles y aislar datos por fundo. Los informes describen administradores/agrónomos configurando datos, muestreadores operando en campo y Soporte CER como categoría; no contienen una matriz formal completa.

| Acción | Administrador | Agrónomo | Muestreador | Soporte CER |
|---|---|---|---|---|
| Crear fundo / completar configuración | D (configuración del cliente) / P (crear y ser propietario) | D (configura el fundo) | — | — |
| Ver fundo y cuarteles | P: todos los fundos donde es admin | P: fundos donde es miembro | D/P: asignados; acceso a mapa web requiere confirmar | P: ninguno por defecto |
| Editar datos básicos del fundo | P: sí | P: sí | — | — |
| Cargar archivos | D: proceso para admin/agrónomo | D | — | P: solo sesión de soporte aprobada |
| Corregir staging y confirmar lote | P: sí | P: sí | — | P: no por defecto |
| Gestionar miembros/invitaciones | D: asignación de equipo en propuesta / P: administrar miembros | P: no por defecto | — | — |
| Asignar muestreadores a cuarteles | D: sí en prototipo/propuesta | P: no por defecto | — | — |
| Registrar conteos | Futuro: operación de muestreo | Futuro: operación de muestreo | D (app móvil) / Futuro para móvil offline | — |
| Administrar roles | P: sí, limitado a roles permitidos; proteger transferencia del último admin | — | — | P: no por defecto |
| Acceso transversal a fundos | — | — | — | Pendiente: posible acceso de soporte con autorización temporal, alcance mínimo y auditoría |

### Decisiones de autorización pendientes

1. Si Administrador y Agrónomo son roles distintos y qué acciones separan; el prototipo combina ambos como una opción.
2. Si puede haber varios administradores y cómo se transfiere/revoca el último.
3. Si el muestreador se autentica en esta web V1, qué información ve y si solo consulta o también cambia asignaciones. La captura móvil/offline no está en V1.
4. Si Soporte CER necesita acceso a datos productivos; recomendación: denegado por defecto, aprobación temporal por fundo, justificación y auditoría.
5. Quién invita, si el registro es abierto o solo por invitación, y canales de envío.

Implementación recomendada: rol contextual almacenado en `farm_memberships`, catálogo de permisos en código/SQL con nombres estables y checks en servidor más RLS. No convertir cada permiso en una columna ni usar una claim global de JWT para permisos que dependen del fundo. Una tabla de overrides de permisos se pospone salvo que CER requiera excepciones de V1.

## 6. Requisitos de datos por confirmar

- Campos estructurales de fundo: nombre y código interno; confirmar región/comuna, identificadores externos y obligatoriedad.
- Campos estructurales de cuartel: identificador/código estable, geometría, estado si aplica y unicidad por fundo.
- Campos agronómicos candidatos mencionados: especie, variedad, año de plantación, densidad y datos de cosecha. Confirmar nombre oficial, tipo/unidad, cardinalidad, obligatoriedad y reglas. No usar los rangos ni variedades de la demo.
- Relación cuartel/plantación: ¿uno o varios ciclos/variedades por cuartel? ¿qué atributos se comparten?
- Clave de relación entre planilla y geometría y política ante filas/features sobrantes, duplicados u omitidos.
- CRS permitido, reproyección, tipos geométricos admitidos, semántica de solapes y criterios bloqueantes.
- Para CSV/Excel: hojas, encabezados, codificación, separador, formatos regionales, fórmulas y columnas obligatorias.
- Límites máximos de archivo, filas, features, vértices, tamaño descomprimido, tiempo de proceso y retención de originales.
- Política de upsert/actualización: reemplazo completo, merge, altas solamente o revisión manual; quién puede confirmar.
- Política de retención/borrado y obligaciones de soporte.

Hasta aprobar el diccionario, V1 puede construir infraestructura relacional/técnica y mapeo; no debe cerrar constraints agronómicos ni rechazar datos por reglas inventadas.

## 7. Seguridad

1. RLS y grants mínimos en cada tabla expuesta; policies de `SELECT`, `INSERT`, `UPDATE`, `DELETE` definidas por operación y membresía activa del fundo.
2. Storage privado; políticas de carga/lectura por usuario, fundo y lote; rutas UUID no sustituyen autorización.
3. La clave Supabase `service_role` solo en server-side y con uso restringido; jamás en cliente ni logs.
4. Validar la propiedad del `batch_id`, archivos y staging en cada endpoint; impedir referencias cruzadas entre fundos/lotes con constraints además de RLS.
5. Originales inmutables. Correcciones se guardan como revisiones de staging y el resultado final mantiene linaje con lote/archivo/fila/feature.
6. Sanitizar salida en HTML/UI; celdas y propiedades se tratan como texto. No ejecutar contenido de documentos.
7. Límites anti abuso, expiración de permisos de carga, expiración de invitaciones y rate limit en endpoints sensibles.
8. TLS, variables separadas por entorno, auditoría de cambios y política explícita de retención/eliminación.

## 8. Decisiones técnicas pendientes y riesgos

| Decisión / riesgo | Consecuencia | Acción previa al código funcional |
|---|---|---|
| No hay clave oficial entre filas y geometrías | No se puede asegurar relación correcta ni upsert idempotente entre lotes distintos. | CER define identificador/correspondencia y cardinalidad. |
| No hay diccionario agronómico aprobado | Constraints o transformaciones pueden rechazar datos legítimos. | Aprobar campos, tipos, unidades, nulos y reglas. |
| Rol de soporte ambiguo | Posible acceso excesivo a datos de clientes. | Mantener denegado por defecto y aprobar procedimiento temporal. |
| Volumen real no definido | Puede agotar memoria/tiempo de Vercel o afectar costos. | Medir muestras representativas y publicar límites del piloto. |
| XLSX/CSV no homogéneos | Mapeo ambiguo, fórmulas, locale, errores de parseo. | Seleccionar parser tras prueba de seguridad y archivos anonimizados autorizados. |
| KML con CRS/propiedades heterogéneos | Coordenadas mal ubicadas o no vinculables. | Definir CRS y flujo de confirmación/rechazo. |
| Confirmación con más de un archivo | Riesgo de aplicación parcial o doble. | Transacción, bloqueo de estado, clave de idempotencia y pruebas concurrentes. |
| Sin identificador estable de cuartel | Solo se garantiza no duplicar al reintentar el mismo lote, no entre lotes diferentes. | Definir clave única de negocio antes de habilitar upsert automático. |
| Parser pesado para Functions | Timeout, memoria, bundle o procesamiento no recuperable. | Topes V1; solo incorporar procesador externo si benchmarks lo justifican. |
| Personalización excesiva temprana | Complejidad de permisos/consultas/esquema. | No habilitar atributos personalizados en V1; reservar el patrón con gobierno explícito. |

## 9. Pruebas de aceptación para el diseño de importación

Estas pruebas se planifican para implementación; no se han ejecutado:

- Reintentar creación con la misma clave idempotente devuelve el mismo lote.
- Un lote no puede contener un segundo archivo tabular ni aceptar archivo fuera de allowlist.
- Los originales no cambian cuando el usuario corrige staging.
- Fila y geometría no pueden vincularse entre lotes o fundos distintos.
- Dos solicitudes concurrentes de confirmar el mismo lote producen un único resultado.
- Una falla a mitad de confirmación no deja una mezcla parcial de cuarteles/datos.
- Reprocesar un lote con una nueva versión de parser conserva trazabilidad y no borra correcciones sin advertencia.
- Duplicados dentro del archivo se reportan por clave técnica de origen; duplicados semánticos entre lotes se resuelven según identificador de negocio confirmado.
- XLSX malformado, expansión ZIP, fórmula/ejecutable no admitido, KML XXE, XML con entidad externa, GeoJSON excesivo, MIME falsificado, geometría vacía y CRS desconocido fallan de forma segura y localizada.
- Usuario de un fundo no puede ver archivos, staging, errores, geometrías o jobs de otro fundo, incluso conociendo sus UUID.

## 10. Plan de trabajo actualizado

1. **Aprobación de decisiones de datos y permisos:** diccionario, clave de cuartel, relación fila-geometría, roles, política de upsert y límites.
2. **Fundación de aplicación/seguridad:** Next.js App Router, Supabase Auth, esquema estructural, membresías, RLS y Storage privado.
3. **Lotes y borradores:** estados, archivos, idempotency key, originales privados, progreso recuperable y auditoría.
4. **Parser tabular:** staging relacional, mapeo de columnas, validación estructural, edición y pruebas de límites.
5. **Parser geográfico:** geometrías PostGIS, relaciones staging, validación de formato/CRS y mapa Leaflet.
6. **Confirmación conjunta:** transacción/idempotencia, upsert solo con clave aprobada, linaje y estados de resultado.
7. **Roles, invitaciones y asignaciones:** permisos finales aprobados, RLS y auditoría.
8. **Piloto Vercel:** medición de archivos representativos, seguridad, accesibilidad, límites y tiempos de onboarding.

Cada hito debe aportar migraciones versionadas, criterios de aceptación y pruebas acordes antes de seguir. No se añade procesador externo salvo que las mediciones de Vercel incumplan límites de negocio aprobados.

## Referencias técnicas

- [Límites de Vercel Functions](https://vercel.com/docs/functions/limitations) (límite de cuerpo de solicitud/respuesta y límites de recursos; revisar al iniciar el despliegue porque pueden cambiar por plan/configuración).
- [Supabase Storage: buckets y acceso privado](https://supabase.com/docs/guides/storage/buckets/fundamentals).
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).
