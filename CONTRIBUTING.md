# Contribuir a Espaciokoop Lagunak

Gracias por colaborar. Este repositorio es un fork de EmptyEpsilon y está pensado para trabajo coordinado entre personas y agentes de IA.

## Antes de empezar

1. Lee el [`README.md`](README.md), esta guía y, si eres un agente, [`AGENTS.md`](AGENTS.md).
2. Comprueba si ya existe un issue o pull request para el mismo objetivo.
3. Para cambios no triviales, abre un issue que describa problema, alcance y criterio de aceptación.
4. No incluyas secretos, datos personales ni archivos generados localmente.

## Flujo de trabajo

```bash
git switch main
git pull --ff-only origin main
git switch -c feature/nombre-breve
```

Prefijos recomendados:

- `feature/`: funcionalidad nueva.
- `fix/`: corrección de un defecto.
- `docs/`: documentación.
- `test/`: pruebas.
- `chore/`: mantenimiento sin cambio funcional.
- `upstream/`: integración controlada desde EmptyEpsilon.

Tras el bootstrap inicial, todo cambio debe llegar a `main` mediante pull request. No uses `push --force` sobre ramas compartidas.

## Issues

Un issue útil incluye:

- contexto y problema observable;
- resultado esperado;
- alcance y elementos expresamente fuera de alcance;
- pasos de reproducción, si es un defecto;
- plataforma y versión relevantes;
- criterio de aceptación comprobable.

## Pull requests

Cada pull request debe resolver un objetivo coherente e indicar:

- qué cambia y por qué;
- issue relacionado;
- archivos o áreas principales afectadas;
- pruebas ejecutadas y resultados reales;
- pruebas no ejecutadas y motivo;
- riesgos, compatibilidad y posible rollback;
- capturas o vídeo si cambia la interfaz.

No marques una casilla de prueba si no la has ejecutado. Si una dependencia bloquea la prueba, documenta el comando y el error relevante sin ocultarlo ni inventar resultados.

## Criterio de terminado

Un cambio está terminado cuando:

- cumple el criterio de aceptación del issue;
- compila o pasa las comprobaciones aplicables en el entorno declarado;
- no introduce secretos ni artefactos locales;
- actualiza documentación y roadmap cuando modifica comportamiento o estado;
- conserva licencia, atribuciones y compatibilidad razonable con upstream;
- ha sido revisado antes de integrarse en `main`.

## Estilo

Se mantienen inicialmente las convenciones originales de EmptyEpsilon:

- C++17.
- Miembros con guion bajo: `zoom_level`.
- Clases en `HighCamelCase`: `GuiSlider`.
- Funciones en `lowCamelCase`: `getZoomLevel`.
- Escenarios y lógica de misión en Lua.

Evita reformateos masivos mezclados con cambios funcionales.

## Commits

Usa mensajes breves, imperativos y específicos. Ejemplos:

- `docs: document Linux build prerequisites`
- `feat(scenario): add cooperative training mission`
- `fix(network): handle station reconnect timeout`

Un commit no debe contener credenciales, builds, configuración personal ni cambios ajenos al objetivo.

## Pruebas mínimas

Escoge las comprobaciones aplicables:

- configuración y compilación CMake;
- pruebas o targets definidos por el proyecto;
- validación sintáctica Lua con `luac -p`;
- arranque local y prueba manual del escenario;
- conexión cliente/servidor cuando cambie red o juego multijugador.

Consulta [`docs/BUILDING.md`](docs/BUILDING.md).

## Sincronización con EmptyEpsilon

`upstream` debe seguir apuntando exclusivamente a `https://github.com/daid/EmptyEpsilon`. La integración se realiza en una rama dedicada y mediante pull request. Consulta [`docs/UPSTREAM.md`](docs/UPSTREAM.md).

## Licencia

Al contribuir aceptas que tu aportación se distribuya bajo la licencia aplicable al repositorio, GNU GPL v2. Conserva avisos de copyright y atribución existentes.
