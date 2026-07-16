# Editor de contenido integrado

El modo Game Master incluye un editor de contenido para crear y mantener cuatro
tipos de recursos sin editar Lua:

- campañas;
- mapas;
- personajes;
- naves.

## Uso

1. Abre **Game Master → Content editor…**.
2. Selecciona el tipo de recurso.
3. Pulsa **New**, rellena el formulario y guarda.
4. **Save** actualiza el recurso seleccionado aunque cambie su ID. Si ese ID ya
   pertenece a otro recurso, exige una segunda pulsación antes de sustituirlo.
5. **Export** copia únicamente el recurso visible al portapapeles como JSON.
6. **Import** lee un recurso JSON del portapapeles y valida todos sus campos.
7. Si ya existe el mismo par `type + id`, hay que pulsar **Import** por segunda
   vez para confirmar la sustitución.
8. **Delete** también requiere una segunda pulsación.
9. Si el formulario cambió desde la última carga o guardado, **New**, cambiar de
   tipo, cargar otro recurso, importar o cerrar requieren repetir la acción. La
   confirmación se invalida si cambia el formulario o se elige otra acción.
10. En mapas, **Preview on radar** activa una capa sobre el radar GM.
    Asteroides y nebulosas se muestran semitransparentes; los tipos futuros se
    conservan pero no se interpretan ni dibujan. Si existen, el editor muestra
    junto al toggle cuántos objetos se omiten sin dejar de conservarlos. El
    preview persiste al cerrar el modal y sigue el pan/zoom del radar.
11. **Edit on radar** cierra el modal y entra en un modo explícito de staging:
    seleccionar y arrastrar un asteroide o nebulosa solo cambia la copia del
    documento. El movimiento se confirma al soltar y crea una única entrada de
    deshacer; **Undo** y **Redo** operan sobre ese historial. Escape o clic derecho
    cancelan el arrastre activo y vuelven al editor. Los tipos futuros nunca son
    seleccionables. Guardar persiste las posiciones; **New**, cargar/importar otro
    recurso o descartar reconstruyen la sesión desde su snapshot limpio.
12. **Export file** escribe el recurso en la carpeta de exportaciones gestionada.
    Si el archivo ya existe, exige una segunda pulsación.
13. **Import inbox** permite elegir un JSON depositado en la bandeja gestionada.
    **Import file** muestra primero tipo, ID y nombre de archivo; una segunda
    pulsación confirma la importación y una sustitución exige confirmación propia.

**Save**, **Delete** e importación persisten la biblioteca entre sesiones. El
portapapeles continúa disponible como transporte multiplataforma, pero no es
necesario para el uso local.

## Almacenamiento gestionado

La raíz privada se deriva del directorio de configuración que ya calcula el
juego. El backend crea bajo `content-editor/` únicamente estas carpetas:

- `library/`: documento canónico de la biblioteca;
- `exports/`: recursos exportados con nombre derivado de `type + id`;
- `inbox/`: única bandeja desde la que la UI admite archivos;
- `backups/`: última generación confirmada y backups de exportación;
- `quarantine/`: documentos parciales o dañados apartados durante recuperación.

La UI y Lua no reciben rutas ni primitivas generales de filesystem. Para importar
un archivo, hay que copiarlo externamente a `inbox/`; el selector solo muestra
archivos `.json` normales con nombres portables. **Import file** refresca la
lista en cada acción. Para mantener el selector accesible muestra como máximo
los primeros 16 nombres ordenados; hay que mover o borrar los ya procesados para
acceder a los siguientes.

## Formato `espaciokoop-content` v4

La versión 4 mantiene la envoltura y los objetos de mapa de v3, y añade overrides
declarativos a las naves. El importador sigue aceptando documentos v1–v3; al
volver a guardarlos o exportarlos se escriben como v4. Un mapa antiguo migra a
`objects: []` y una nave antigua a colecciones de overrides vacías.

```json
{
  "format": "espaciokoop-content",
  "version": 4,
  "type": "map",
  "id": "sector-uno",
  "name": "Sector uno",
  "description": "Terreno inicial",
  "fields": {
    "scenario_file": "scenario_00_basic.lua",
    "recommended_players": "4",
    "objects": [
      {
        "id": "asteroid-1",
        "kind": "asteroid",
        "position": [1200.0, -300.0],
        "rotation": 45.0,
        "properties": {"size": 150.0}
      }
    ]
  }
}
```

Tipos y campos específicos:

| Tipo | Campos |
|---|---|
| `campaign` | `map_ids` ordenados, `starting_map_id`, `character_ids`, `ship_ids`, `transitions` |
| `map` | `scenario_file`, `recommended_players`, `objects` |
| `character` | `crew_position_id`, `callsign`, `tags`, `ship_id` opcional, `legacy_role` para migración v1 |
| `ship` | `template`, `faction`, `overrides` (`systems`, `resources`, `cargo`, `crew_positions`) |

Los overrides de nave son datos cerrados: cada sistema usa uno de los nueve IDs
canónicos y una salud entre `-1` y `1`; recursos y carga usan IDs portables y
cantidades acotadas; los puestos usan IDs canónicos. Las cuatro colecciones son
explícitas aunque estén vacías. No admiten callbacks, Lua ni claves adicionales.

Las listas se editan separadas por comas. Las transiciones son aristas
declarativas `mapa-origen>mapa-destino`: ambos extremos deben pertenecer a
`map_ids`, no pueden formar ciclos y nunca contienen callbacks o Lua importado.
`crew_position_id` solo admite los identificadores canónicos del juego (por
ejemplo `helms`, `engineering`, `science`, `tactical` o `operations`). Antes de
persistir se comprueba que los mapas, personajes y naves referenciados existan
en la biblioteca; borrar un recurso aún referenciado también queda bloqueado.

Al importar un personaje v1, los alias de puesto conocidos se normalizan a su
ID canónico. Un `role` histórico de texto libre se conserva íntegro en
`legacy_role` y deja vacío `crew_position_id`, en vez de inventar una asignación
operativa. El editor muestra ambos campos para que el GM pueda elegir un puesto
canónico y borrar después el valor histórico; mientras tanto el documento sigue
siendo válido y puede guardarse o exportarse como v4 sin perder el rol original.

`objects` admite inicialmente `asteroid` (posición, rotación y tamaño) y `nebula`
(posición y rotación). Los IDs son únicos y las coordenadas, rotaciones, tamaños
y número de objetos están acotados. Un `kind` futuro se conserva como JSON opaco
canónico: no se interpreta, no se ejecuta y no puede editarse mediante la
allowlist actual, pero tampoco desaparece en un round-trip.

Cada exportación individual añade `dependencies`, un manifiesto cerrado con
tipo, ID y el booleano `missing`. Así puede transportarse un recurso aislado y
ver qué dependencias faltan sin incluirlas ni ejecutar contenido. El importador
verifica que el manifiesto coincide exactamente con las referencias del recurso.

`id` admite de 1 a 64 caracteres ASCII en minúsculas: letras, números, `_` y
`-`; debe empezar por letra o número. El importador limita el documento a 64
KiB, rechaza claves desconocidas o duplicadas, versiones no soportadas, tipos
incorrectos y campos excesivamente largos.

## Seguridad

- Importar **nunca ejecuta Lua**, comandos ni rutas incluidas en el documento.
- El JSON se analiza en modo estricto y solo acepta una lista cerrada de claves.
- La biblioteca usa documento versionado, escritura temporal sincronizada,
  rotación de backup y sustitución atómica. En POSIX sincroniza también los
  directorios destino y origen; en Windows usa `FlushFileBuffers` y renombres
  `MOVEFILE_WRITE_THROUGH` (la persistencia de la creación inicial de carpetas
  depende del filesystem). Tras una interrupción conserva el canónico válido o
  recupera el temporal/backup completo. Las exportaciones gestionadas aplican el
  mismo protocolo y se reparan al inicializar el store.
- Se rechazan traversal, rutas absolutas, enlaces simbólicos o reparse points en
  cualquier componente gestionado, entradas que no sean archivos normales y
  tamaños fuera de límite. La lectura valida el handle abierto y está acotada a
  `límite + 1`, evitando carreras entre comprobación y lectura.
- Un lock privado serializa recuperación, guardados e import/export entre hilos y
  procesos cooperantes, evitando colisiones sobre temporales y backups. Si dos
  editores guardan snapshots distintos, se aplica explícitamente último escritor gana.
- Una versión futura no se migra hacia atrás ni se modifica.
- Guardar o importar sobre otro ID y borrar requieren confirmación explícita.
- Una sola acción de navegación o cierre no descarta un formulario modificado.
- Cada recurso se importa/exporta por separado; no se mezclan campañas, mapas,
  personajes y naves accidentalmente.
- Los documentos no deben contener secretos ni datos privados que no deban
  compartirse.

## Pruebas del formato

El codec/guard y el store tienen ejecutables C++ independientes. En un build
configurado con `-DBUILD_CONTENT_RESOURCE_TESTS=ON` se ejecutan con:

```bash
ctest --test-dir build --output-on-failure \
  -R 'content_resource_codec|content_library_store|map_document_codec|map_edit_session|map_preview_projection|ship_document_model|ship_template_catalog|ship_template_preview_lua|ship_edit_session'
```

El test del codec cubre los cuatro tipos, round-trip, límite de 64 KiB, claves
duplicadas en raíz y objetos anidados, tipos y claves desconocidos, versiones
futuras, rutas de escenario inseguras, rangos numéricos y la doble confirmación
ligada al contenido exacto del formulario. El store cubre traversal, symlinks,
ENOSPC, permisos, interrupciones antes y después de rotar el backup, recuperación,
migración secuencial, versión futura y export-import-export equivalente.
`docker/build.sh` activa y ejecuta estas pruebas en el job Linux.

## Alcance de esta fase

El editor crea, valida, persiste e intercambia metadatos declarativos de los cuatro tipos.
Los mapas tienen modelo separado del ECS, sesión transaccional de staging con undo,
redo, dirty state y rollback, y edición visual sobre el radar GM. El modo de edición
consume los gestos antes de la lógica normal del radar: nunca crea ni mueve entidades
del mundo. Solo proyecta, selecciona y mueve asteroides y nebulosas de la allowlist;
los tipos futuros opacos se omiten visualmente sin perderse y su recuento queda
visible en el editor. El hit-test mantiene una tolerancia visual estable al zoom y los
objetos opacos nunca participan en él. El drag provisional vive fuera de
`MapEditSession`: mover el puntero no modifica el documento y `mouse-up` llama una sola
vez a `moveObject()` únicamente si conserva la misma identidad generacional y revisión
de sesión con que empezó. Cada edición, undo, redo, rollback, guardado o reemplazo de
sesión avanza esa barrera para impedir ABA. Escape, clic derecho, una coordenada fuera
de rango o terminar el modo cancelan sin ensuciar el documento ni añadir historial.

Las naves tienen un modelo tipado para overrides opcionales de sistemas, recursos,
carga y puestos. Rechaza IDs no canónicos, duplicados, valores no finitos y
cantidades fuera de rango; v4 ya lo persiste e intercambia con migración de v1–v3.
El formulario ya ofrece verticales GUI tipadas para los cuatro grupos de overrides:
salud de sistemas, recursos, carga y puestos canónicos de tripulación. Incluye IDs
y valores validados, aplicar/quitar override y undo/redo compartido sobre el staging.
Al guardar una nave consulta un catálogo read-only generado por los registros Lua
precargados de confianza: exige una plantilla canónica existente y que su modelo 3D
siga registrado. La consulta devuelve solo metadatos escalares ordenados; no expone
ni ejecuta callbacks de spawn. Si todavía no hay escenario/catálogo cargado, el
editor conserva el comportamiento declarativo y no bloquea el guardado.
El botón `Elegir plantilla` abre una lista buscable con scroll. Solo ofrece plantillas
visibles cuyo modelo siga registrado; filtra sin distinguir mayúsculas ASCII sobre
ID, etiqueta, tipo y modelo, pero aplica siempre el ID canónico. La entrada manual se
mantiene para documentos legacy y las plantillas ocultas siguen validando al cargar su
ID. Al seleccionar una entrada, el overlay consulta únicamente el `mesh_render` de la
plantilla y muestra una vista 3D giratoria. El widget conserva una copia inerte de
`MeshRenderComponent`: no crea ninguna entidad ECS, `Transform`, física, red ni
callback de spawn, y descarta la copia al cambiar o cerrar/aplicar el selector.
El documento editado no toca el ECS. La sesión C++ pura prepara todos los overrides
con dirty state, historial acotado y rollback al último snapshot guardado.
La aplicación autorizada al mundo se incorporará en un vertical posterior.
La siguiente fase mantendrá la misma envoltura versionada:

- aplicación tipada al mundo con autorización GM y rollback, sin Lua importado
  ([#54](https://github.com/VaroTv7/espaciokooplagunak/issues/54));
- plantillas, previsualización y spawn de naves ([#55](https://github.com/VaroTv7/espaciokooplagunak/issues/55)).

Las campañas y personajes ya se enlazan de forma declarativa con mapas, naves
y puestos canónicos. Aplicar esos documentos a una sesión viva queda separado
de la edición y persistencia de metadatos.
