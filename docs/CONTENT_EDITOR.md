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
10. **Export file** escribe el recurso en la carpeta de exportaciones gestionada.
    Si el archivo ya existe, exige una segunda pulsación.
11. **Import inbox** permite elegir un JSON depositado en la bandeja gestionada.
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

## Formato `espaciokoop-content` v1

Todos los documentos tienen esta envoltura:

```json
{
  "format": "espaciokoop-content",
  "version": 1,
  "type": "ship",
  "id": "itsaso-1",
  "name": "Itsaso 1",
  "description": "Nave de la primera guardia",
  "fields": {
    "template": "Phobos M3P",
    "faction": "Human Navy"
  }
}
```

Tipos y campos específicos:

| Tipo | Campo principal | Campo secundario |
|---|---|---|
| `campaign` | `map_ids` | `starting_map_id` |
| `map` | `scenario_file` | `recommended_players` |
| `character` | `role` | `callsign` |
| `ship` | `template` | `faction` |

`id` admite de 1 a 64 caracteres ASCII en minúsculas: letras, números, `_` y
`-`; debe empezar por letra o número. El importador limita el documento a 64
KiB, rechaza claves desconocidas o duplicadas, versiones no soportadas, tipos
incorrectos y campos excesivamente largos.

## Seguridad

- Importar **nunca ejecuta Lua**, comandos ni rutas incluidas en el documento.
- El JSON se analiza en modo estricto y solo acepta una lista cerrada de claves.
- La biblioteca usa documento versionado, escritura temporal sincronizada,
  rotación de backup y sustitución atómica. Tras una interrupción conserva el
  canónico válido o recupera el temporal/backup completo. Las exportaciones
  gestionadas aplican el mismo protocolo y se reparan al inicializar el store.
- Se rechazan traversal, rutas absolutas, enlaces simbólicos o reparse points en
  cualquier componente gestionado, entradas que no sean archivos normales y
  tamaños fuera de límite. La lectura valida el handle abierto y está acotada a
  `límite + 1`, evitando carreras entre comprobación y lectura.
- Un lock privado serializa recuperación, guardados e import/export entre procesos,
  evitando colisiones sobre temporales y backups.
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
  -R 'content_resource_codec|content_library_store'
```

El test del codec cubre los cuatro tipos, round-trip, límite de 64 KiB, claves
duplicadas en raíz y objetos anidados, tipos y claves desconocidos, versiones
futuras, rutas de escenario inseguras, rangos numéricos y la doble confirmación
ligada al contenido exacto del formulario. El store cubre traversal, symlinks,
ENOSPC, permisos, interrupciones antes y después de rotar el backup, recuperación,
migración secuencial, versión futura y export-import-export equivalente.
`docker/build.sh` activa y ejecuta ambas pruebas en el job Linux.

## Alcance de esta primera fase

El editor crea, valida, persiste e intercambia metadatos declarativos de los cuatro tipos.
Los objetos del mapa se siguen colocando y ajustando visualmente desde Game
Master. Las siguientes fases mantendrán la misma envoltura versionada:

- conexión con el editor visual de mapas ([#54](https://github.com/VaroTv7/espaciokooplagunak/issues/54));
- plantillas, previsualización y spawn de naves ([#55](https://github.com/VaroTv7/espaciokooplagunak/issues/55));
- campañas y personajes vinculados a mapas, naves y puestos ([#56](https://github.com/VaroTv7/espaciokooplagunak/issues/56)).
