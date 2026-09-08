# Campo de pruebas

Las escenas andables del módulo, en un navegador y **sin Foundry VTT**. Dos
niveles: el **museo** (#598, cuadros en #836/#838) y la **playa** (#587).

## Para qué

Dos cosas, y ninguna es una demo:

1. **Comprueba la regla standalone-first.** La dirección de producto del fork
   (issue #219, ADR-0008) obliga a preguntarse, ante cualquier cosa nueva, «¿sigue
   siendo jugable si Foundry desaparece?». Estas dos escenas ya cumplían la regla
   por dentro —geometría, render y motor de andar son módulos puros— pero no
   había forma de verificarlo sin un mundo montado. Ahora es una URL.
2. **Es el sitio donde mirar el arte.** Hay afirmaciones que son visuales y que
   ninguna prueba de Node demuestra: que el empaste de un cuadro se lea como
   bulto y no como agujero depende del sentido de la luz sobre los costados, que
   es el error clásico del relieve dibujado a mano; que la niebla cierre el
   horizonte depende de que el fondo y el alcance de dibujo casen.

Ya ha pagado su coste. Encontró que el bucle **no arrancaba** sin inyectarle
`requestAnimationFrame` —la escena se veía perfecta en una captura y estaba
muerta: no se andaba, no corría el reloj del viento y no saltaba ninguna
cartela— y que un muro lateral del museo queda **siempre** en el suelo ambiente
de 0,35 porque la luz del motor no le da, así que los cuadros de ese lado pierden
el color.

## Cómo se abre

Los módulos van por `import`, así que hace falta servirlo por HTTP: con `file://`
el navegador bloquea la carga. Desde la raíz del repositorio:

```bash
python3 -m http.server 8000
```

Y abrir <http://localhost:8000/tools/campo-de-pruebas/>.

| Parámetro | Qué hace |
|---|---|
| `?nivel=museo` \| `playa` | Con qué nivel se abre. |
| `?mirador=<pieza>` | Empieza plantado delante de esa pieza, mirándola. |
| `?idioma=en` | La sala en inglés (cartelas incluidas). |

`?mirador=frente-al-mar` existe para lo que vino esta herramienta: comprobar el
relieve de un cuadro andando doce metros cada vez que se cambia un tono es como
no comprobarlo.

## Controles

`W` `A` `S` `D` andar · `Q` `E` girar · `C` agacharse · `espacio` saltar ·
`V` primera/tercera persona · `Tab` cambiar de nivel · `INTRO` en la salida,
pasar al siguiente.

## Qué NO hace

**No duplica nada.** Las escenas, sus piezas, sus cartelas y el motor de andar se
importan de `foundry-module/scripts/`, y los niveles salen del propio
`CATALOGO_ANDAR` del módulo: si esto tuviera su copia de una sala dejaría de
comprobar la sala de verdad el primer día que alguien tocara una de las dos, que
es el fallo que `nave-planta-phobos.mjs` evita comparándose con su `.lua`. Lo
propio de aquí es el teclado, el `<canvas>` y el panel de cartela — justo lo que
en Foundry pone la ventana de la aplicación.

**Un tercer nivel es una entrada más** en `niveles.mjs`, no una página nueva.

**No concede, no cuenta y no recuerda.** Es la misma regla de `docs/FOUNDRY.md`
que ya cumple el museo: enseña y ya está. La salida de cada escena, que en la
partida vuelve a la cantina, aquí encadena con el siguiente nivel y lo **dice**
en pantalla, en vez de simular un viaje a una cantina que no existe.

**No está en CI**, a propósito: depender de un navegador para que pase la suite
es cambiar una prueba frágil por otra. Es una herramienta de revisión, y su
salida se pega en el PR — el mismo criterio que `tools/evidencia-tinte-retrato.mjs`.
