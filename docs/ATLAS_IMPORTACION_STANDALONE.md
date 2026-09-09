# Importar un atlas sin Foundry

Desde la raíz del repositorio, con Node instalado:

```sh
node tools/importar-atlas.mjs < atlas.csv
node tools/importar-atlas.mjs < atlas.json
```

La entrada real de consola llama al mismo `importarAtlas` que la ventana del
GM. Detecta CSV HYG o JSON cosmográfico, valida y devuelve el catálogo completo
por stdout. La atribución y la licencia viajan dentro del JSON; no se reducen a
un contador. No hay red, escritura de archivos ni dependencias de Foundry/DOM.
El límite de entrada es 8 MiB; un error termina con código distinto de cero y
sin catálogo parcial. No se deben interpretar los errores como un atlas vacío.

Esta entrega permite convertir y validar datos desde un consumidor standalone;
no es un visor ni decide el atlas de campaña, su autoridad o su persistencia.
Refs #634 y #213: siguen pendientes los demás módulos y decisiones de esos
issues. Las pruebas `atlas-entrada-standalone.test.mjs` ejecutan el comando real,
incluyen ida y vuelta HYG/JSON, procedencia y entradas inválidas.
