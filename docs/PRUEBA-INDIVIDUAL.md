# Prueba individual de «Primera guardia»

Esta variante permite recorrer el escenario propio de Espaciokoop Lagunak con una sola persona y el cliente normal. No necesita Foundry VTT, puente HTTP ni Docker.

La ayuda es **opt-in**: el modo `Normal` sigue siendo el predeterminado y no muestra controles de QA.

## Arranque directo en CachyOS

Con un build nativo en `build/EmptyEpsilon`:

```bash
./tools/run-solo-qa.sh
```

Si el binario está en otra ruta:

```bash
ESPACIOKOOP_BIN=/ruta/a/EmptyEpsilon ./tools/run-solo-qa.sh
```

El lanzador inicia un servidor local no publicado en Internet, carga directamente `Lagunak: Primera guardia` con `Modo=Prueba individual` y abre la selección de nave. No modifica la configuración global ni el modo normal.

## Puesto recomendado

1. Selecciona la nave **Itsaso 1**.
2. Entra en **Tactical**: reúne timón y armas en una sola pantalla.
3. Verás el aviso `PRUEBA INDIVIDUAL ACTIVA` y cuatro controles `QA`.

## Recorrido corto sugerido

1. Pulsa **QA: estado** para comprobar fase, tiempo, distancia, casco y energía.
2. Prueba a desatracar de Lagunak y maniobrar unos minutos.
3. Pulsa **QA: ir al encuentro** para aparecer antes de los dos Dagger Exuari. Siguen activos: puedes combatir o esquivarlos.
4. Si recibes demasiado daño, usa **QA: restaurar nave**. Solo restaura casco, escudos y energía; no altera la fase.
5. Pulsa **QA: preparar llegada**. Aparecerás a 1,6U de Argia con el impulso y la curvatura solicitados a cero.
6. Avanza la distancia final. El botón no concede la victoria: la llegada, el evento y el cierre los procesa el flujo normal del escenario.

## Qué conviene anotar

- Si Tactical permite pilotar y combatir sin cambiar de puesto.
- Si los botones caben y se entienden a la resolución usada.
- Si el encuentro es razonable para una persona.
- Si restaurar la nave responde una sola vez por pulsación.
- Si la llegada termina la misión y muestra el tiempo de guardia.
- Errores de consola, bloqueos, textos cortados o comportamiento inesperado.

No publiques `~/.emptyepsilon`, contraseñas de servidor ni datos personales al adjuntar evidencias.

## Volver al juego normal

Cierra la partida y arranca Espaciokoop Lagunak desde su acceso habitual. Al crear `Lagunak: Primera guardia`, deja **Modo: Normal**. Los controles QA no se instalan en esa variante.

<!-- Prueba de #361: PR solo de documentación. -->
