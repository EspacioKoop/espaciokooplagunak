# Estudio de referencias de texturas 2D pixelart de dominio público y propuestas de mejora

## Referencias de dominio público y licencias libres

1. **OpenGameArt.org** - Gran colección de assets pixelart bajo licencias CC0, CC BY, etc.
   - Ejemplo: https://opengameart.org/users?field_user_type_tid%5B%5D=1&sort_by=name&sort_order=ASC&page=0
   - Filtro por licencia: CC0, Dominio Público.

2. **Itch.io** - Muchos artistas liberan packs bajo CC0 o dominio público.
   - Buscar: "pixel art CC0" o "public domain pixel art".

3. **Los específicados en el juego "LPC" (Liberated Pixel Cup)** - Assets bajo CC-BY-SA 3.0, pero podemos usar los que son CC0.
   - Repositorio: https://github.com/UniversalPC/LPC

4. **SpriteLib** - Colección de sprites de dominio público.
   - http://spritelib.com/

5. **Kenney.nl** - Muchos assets bajo dominio público (CC0).
   - https://kenney.nl/assets

## Propuestas de mejora para el proyecto

- Crear una guía de estilo pixelart coherente con el estilo retro3d del proyecto (paleta limitada, resolución base 32x32 o 64x64).
- Establecer un proceso de contribución para assets pixelart: requerir especificación de licencia y revisión legal.
- Integrar un pipeline de preprocesamiento que optimice las texturas (paleta, compresión sin pérdida) para uso en el motor.
- Generar un atlas de texturas combinado para reducir llamadas de dibujo.
- Proponer un conjunto inicial de assets básicos (tiles, personajes simples, UI) bajo CC0 para usar como placeholders y ejemplo.

## Próximos pasos

1. Revisar y descargar los assets de las fuentes mencionadas, verificando licencias.
2. Adaptar los assets al estilo y paleta del proyecto.
3. Documentar el proceso de integración en CLAUDE.md o en un nuevo documento de assets.
4. Abrir un issue para la creación de un pipeline de importación de assets si no existe.

