# ADR-0010 — El hackeo se queda solo-nativo: no se expone a Lua ni al puente

- Estado: Aceptada
- Fecha: registrada 2026-08-07 (Etapa B, issues #521 y #516)
- Fuentes: `src/playerInfo.cpp` (`CMD_HACKING_FINISHED`),
  `src/screenComponents/hackingDialog.cpp`, `src/components/hacking.h`,
  `src/script.cpp`. La auditoría de #460 (`docs/SESION-PANTALLAS-NATIVAS.md`)
  motivó el issue, pero **vive todavía en la rama `test/460-pantallas-nativas`
  y no en `main`**: esta decisión no depende de ella — se apoya en la lectura
  directa del motor citada arriba.

## Contexto

La auditoría de #460 señaló el hackeo como una de las agencias más ricas del
juego nativo: un minijuego completo, en la pantalla de Relay, con consecuencias
sobre los sistemas del objetivo. #516 lo listó como hueco de la Etapa B, y #521
se abrió para decidir si exponerlo a Foundry — a diferencia del resto de la
serie, este exigía binding nuevo en C++, porque `src/script.cpp` no registra
ningún `commandHack*`.

Al leer cómo funciona de verdad, el reparto resultó ser otro:

- **El minijuego vive entero en el cliente.** `GuiHackingDialog` monta un
  buscaminas o un *lights out* (`mineSweeper.h`, `lightsOut.h`) y va midiendo el
  progreso localmente.
- **Al servidor solo llega el resultado.** Cuando el minijuego se completa, el
  cliente envía `CMD_HACKING_FINISHED` con objetivo y sistema.
- **El servidor no valida nada de ese resultado.** El manejador
  (`src/playerInfo.cpp`) comprueba que la nave tenga componente `HackingDevice`
  y suma su `effectiveness` al `hacked_level` del sistema. No comprueba que se
  haya jugado ningún minijuego, ni distancia, ni tiempo, ni frecuencia.

Es decir: lo que hace del hackeo una decisión —la destreza, el tiempo que cuesta,
el riesgo de quedarse quieto mientras lo resuelves— **no existe en la simulación**.
Existe solo en la GUI del cliente que lo juega.

## Decisión

**El hackeo se queda solo-nativo.** No se registra ninguna global Lua para él, no
entra en la lista blanca del puente y no aparece en `STATION_ACTIONS`. El hueco
que #516 anotaba para Relay se cierra **por escrito** en vez de con código.

Los motivos, en orden de peso:

1. **Exponerlo como orden atómica no arriesgaría disolver el minijuego: sería
   la disolución.** Como el reto solo existe en el cliente, una orden
   `hack_target` es exactamente «este sistema queda hackeado», sin coste ni
   destreza. No estaríamos trasladando una agencia; estaríamos sustituyéndola
   por un botón y llamándolo lo mismo.
2. **Rompería el patrón que sostiene toda la serie #516.** Cada orden que hemos
   expuesto se apoya en que *el juego la valida server-side*: un tubo vacío no
   dispara, una frecuencia fuera de rango se recorta, un waypoint inexistente no
   se mueve. `CMD_HACKING_FINISHED` es la única que no valida nada. Una orden de
   puente con efecto real y cero validación en el servidor no es del mismo
   género que las demás, y no debería colarse entre ellas por parecerse.
3. **Rehacer el minijuego en Foundry no resuelve el problema, lo muda.** El
   módulo tiene motor para ello (#309), pero el resultado seguiría siendo un
   cliente diciéndole al servidor «he ganado». Ganaríamos un minijuego bonito y
   la misma ausencia de validación, con una superficie más que mantener.
4. **Arreglarlo bien es trabajo de upstream, no de este fork.** Que el servidor
   valide el hackeo —duración mínima, distancia, estado de la nave— es un cambio
   de reglas en código heredado, y ADR-0007 ya fija que eso va primero a
   EmptyEpsilon. Hacerlo aquí crearía una divergencia grande y viva en la parte
   del motor que menos conviene tener bifurcada.

## Consecuencias

- **La tabla de #516 queda cerrada para Relay** con la nota de que el hackeo es
  deliberadamente solo-nativo. #517 expuso las otras cuatro decisiones del puesto
  (puntos de ruta, sondas, enlace sonda→ciencia y condición de alerta), que son
  las que sí tienen validación en el servidor.
- **Una mesa que quiera hackear tiene una vía**, y no es mala: abrir la pantalla
  nativa de Relay. El fork nunca ha pedido jugar solo desde Foundry —el juego es
  el juego, Foundry es la campaña alrededor (ADR-0008)— y este es uno de los
  sitios donde esa frontera se nota.
- **Queda una observación anotada, no una alarma.** El hackeo es hoy
  falsificable desde un cliente modificado: basta enviar `CMD_HACKING_FINISHED`
  sin haber jugado nada. Es el modelo de confianza de EmptyEpsilon, no una
  regresión de este fork, y solo importa en partidas con clientes no confiables
  — que es un supuesto que este proyecto no maneja hoy. Si alguna vez lo maneja,
  la conversación es con upstream y bajo ADR-0007.
- **Hay que corregir la auditoría de #460 cuando se fusione.** Describe el
  hackeo como «un minijuego completo con consecuencias» —cierto en pantalla—
  sin haber mirado dónde vive el reto ni si el servidor lo valida. La frase no
  es falsa, pero llevó a listar el hackeo como agencia trasladable cuando no lo
  es. Que ese documento siga fuera de `main` es la ocasión de arreglarlo antes
  de que se lea como establecido.
- **Si la decisión cambia**, cambia con un ADR nuevo y con el orden correcto:
  primero la validación en el servidor (upstream), después el binding, y solo
  entonces la orden de puente. Nunca al revés.
