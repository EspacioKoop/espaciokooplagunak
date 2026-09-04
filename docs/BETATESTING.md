# Guion de sesión de betatesting (alpha, fase 3)

Guion para una sesión de prueba en grupo de la integración con Foundry VTT en
estado alpha. Está escrito para dos públicos: la persona anfitriona (GM
técnico, que prepara servidor, puente y Foundry) y las personas testers, que
solo necesitan un navegador y, si prueban puestos de tripulación reales, el
cliente del juego.

Complementa a otros documentos, no los sustituye:

- [FOUNDRY_GUI_SMOKE.md](FOUNDRY_GUI_SMOKE.md) — verificación técnica del
  módulo por el GM; ejecútala **antes** de sentar a los testers.
- [PRUEBA-INDIVIDUAL.md](PRUEBA-INDIVIDUAL.md) — recorrido en solitario del
  escenario, sin Foundry.
- [SESION-FASE1.md](SESION-FASE1.md) — sesión de grupo de la fase 1, solo con
  el juego.

## Regla de alcance

Antes de la sesión, el GM anota el commit exacto que se prueba
(`git rev-parse HEAD`). Solo se prueba lo que está integrado en ese commit:
si una funcionalidad de esta lista no existe en el build (por ejemplo, porque
su PR aún no se ha fusionado), se marca `N/A` en las notas, no se improvisa.

## Preparación del anfitrión (antes de la sesión)

1. Levanta servidor y puente (vía asistente `python3 tools/instalar.py` o
   [docker/README.md](../docker/README.md)) y comprueba `/healthz`.
2. Instala y activa el módulo en Foundry siguiendo
   [foundry-module/README.md](../foundry-module/README.md); usa un mundo
   desechable o con copia de seguridad.
3. Ejecuta el smoke de [FOUNDRY_GUI_SMOKE.md](FOUNDRY_GUI_SMOKE.md) en la
   versión de Foundry que usará la mesa. Si el smoke falla, se arregla o se
   recorta el guion — no se descubre delante de los testers.
4. Prepara dónde recogerás notas durante la partida (papel, chat aparte…):
   interrumpir la sesión para redactar issues rompe el ritmo.

## Guion de la sesión

Duración orientativa: 60–90 minutos. El GM dirige; los testers no necesitan
haber leído nada.

### 1. Incorporación (10 min)

- Cada tester entra en Foundry con su usuario de jugador.
- Si el build incluye la ventana «Puestos de tripulación», cada jugador elige
  su puesto y el GM corrige una asignación a propósito para probar el flujo.
- Quien vaya a ocupar un puesto real de nave conecta además el cliente del
  juego a la partida.

**Anotar:** si alguien se pierde al entrar, qué pregunta hizo y qué texto o
control no entendió.

### 2. Estado y mapa en vivo (15 min)

- El GM abre «Estado de la nave» y «Mapa vivo» y comparte pantalla o deja que
  los testers miren.
- Sin explicar nada primero, pide a un tester que diga en voz alta: dónde está
  la nave, hacia dónde va, cuánto falta para llegar (ETA) y qué contactos hay.

**Anotar:** qué respondió sin ayuda y qué hubo que explicarle. Este es el
criterio de comprensión del onboarding (issue #126): si necesita al GM para
leer el mapa, es un hallazgo, no un fallo del tester.

### 3. Trayecto y tempo (20 min)

- La tripulación desatraca y pone rumbo a Argia; los puestos manipulan
  impulso, energía y sensores desde el juego.
- El GM pausa desde Foundry, comprueba que la mesa entiende **sin ambigüedad**
  si la simulación está pausada o corriendo, y reanuda.
- Repetir la pausa con mala conexión simulada si es posible (parar el puente
  unos segundos): la ventana debe fallar cerrado, sin órdenes fantasma.

**Anotar:** cualquier momento en que alguien no supo si el juego estaba
pausado, y cuánto tardó la UI en reflejar el estado real.

### 4. Avería y encuentro (15 min)

- El GM inflige una avería sin anunciarla. **Desde Foundry hoy es `N/A`**: el
  puente declara la orden `set_system_health`, pero el módulo aún no expone
  ningún control que la envíe (solo pausa/reanudación), así que este paso se
  ejecuta desde la pantalla de GM del propio juego: seleccionar la nave de los
  jugadores → «Tweak» → bajar el campo *Health* del sistema elegido. Cuando
  exista la UI integrada, este paso pasará a hacerse desde Foundry.
- La tripulación debe detectarla, diagnosticarla y repararla desde su estación
  de ingeniería real; el GM observa la reparación en el estado.
- Si el trayecto cruza el encuentro del escenario, se juega con normalidad.

**Anotar:** cuánto tardaron en darse cuenta de la avería y si el reparto de
tareas entre puestos funcionó o se pisaron.

### 5. Llegada y cierre (10 min)

- La nave llega a Argia; el GM comprueba que la llegada aparece **una sola
  vez** en el Journal aunque reabra la ventana o recargue.
- Ronda rápida de la mesa: a cada tester, «¿qué es lo primero que
  arreglarías?» — una respuesta por cabeza, sin debate.

## Qué anotar en todo momento (transversal)

- **Textos en español** (issue #28): traducciones raras, textos cortados,
  mezcla de idiomas, terminología inconsistente. Basta apuntar el texto
  exacto y dónde salió.
- Errores de consola del navegador o del juego, bloqueos y esperas largas.
- Cualquier cosa que obligó a preguntar al GM.

## Cómo reportar después

Cada hallazgo, un issue en
[GitHub](https://github.com/EspacioKoop/espaciokooplagunak/issues) (el GM puede
abrirlos en nombre de testers sin cuenta). Incluye:

- commit probado y versión de Foundry;
- qué se hizo, qué se esperaba y qué pasó;
- captura o texto exacto si es un problema de UI o de idioma.

Etiquetas orientativas: `Betatesting` siempre; añade `Fix` para fallos y
`Accesibilidad` o `Calidad` cuando aplique. Los hallazgos de comprensión del
mapa van al issue #126 y los de español al #28 como comentarios, si encajan.

**Revisa y redacta antes de adjuntar** cualquier texto de consola o captura —
la consola del navegador y las capturas de la ventana suelen incluir datos de
despliegue aunque no muestren el token. No publiques en issues ni capturas:

- el `BRIDGE_TOKEN`, contraseñas del servidor, el contenido de `docker/.env`
  o `~/.emptyepsilon`;
- la URL, IP o hostname del puente y cualquier otra topología de la red de la
  mesa (tapa o recorta la barra de ajustes y las URLs de las peticiones);
- nombres de usuario de Foundry o del sistema y rutas locales de archivos;
- datos personales de la mesa.

Una captura que no se pueda anonimizar no se adjunta: se describe con texto.
