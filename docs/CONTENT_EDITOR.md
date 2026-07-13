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
4. **Export** copia únicamente el recurso visible al portapapeles como JSON.
5. **Import** lee un recurso JSON del portapapeles y valida todos sus campos.
6. Si ya existe el mismo par `type + id`, hay que pulsar **Import** por segunda
   vez para confirmar la sustitución.
7. **Delete** también requiere una segunda pulsación.

La biblioteca permanece disponible durante la sesión Game Master. Para conservar
un recurso entre sesiones, expórtalo y guárdalo como archivo `.json`. Una fase
posterior añadirá selector de archivos y almacenamiento local gestionado por el
juego; el portapapeles es el transporte inicial multiplataforma.

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
KiB, rechaza claves desconocidas, versiones no soportadas, tipos incorrectos y
campos excesivamente largos.

## Seguridad

- Importar **nunca ejecuta Lua**, comandos ni rutas incluidas en el documento.
- El JSON se analiza en modo estricto y solo acepta una lista cerrada de claves.
- La sustitución y el borrado requieren confirmación explícita.
- Cada recurso se importa/exporta por separado; no se mezclan campañas, mapas,
  personajes y naves accidentalmente.
- Los documentos no deben contener secretos ni datos privados que no deban
  compartirse.

## Alcance de esta primera fase

El editor crea, valida e intercambia metadatos declarativos de los cuatro tipos.
Los objetos del mapa se siguen colocando y ajustando visualmente desde Game
Master. La siguiente fase conectará los recursos `map` y `ship` con el mapa vivo
y las plantillas/spawn del juego, manteniendo la misma envoltura versionada.
