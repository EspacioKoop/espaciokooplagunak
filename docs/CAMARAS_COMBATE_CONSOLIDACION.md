# Cámaras de combate: consolidación preparatoria

Refs #1020, #1021, #1022, #1023, #1024. Entrega sucesora: #1064.

## Contenido preservado

Se incorporan por merges normales, conservando commits y autoría:

| PR | HEAD incorporado | Contenido |
|---|---|---|
| #1060 | `b83537a6e4c80f55bbbfa5bd9018e2649f49dcb4` | Modelo táctico, cuadrícula, zoom, tests y declaración de orfandad |
| #1062 | `da1b69552d5570c2d41862b0dcf9b74de9f53947` | Modelo POV, conversión de pies a metros y tests |
| #1063 | `aa001a432eb051c68926f6f4ef5d24799e123d8d` | Modelo libre, zoom conservado, controles y tests |
| #1066 | `0c5f0b7cac933c15abaed07ab79bebe6f5b71a1c` | Tercera persona, retiro métrico y tests |

No se propone borrar ramas ni marcar estos issues como terminados. La sustitución
es de PRs, no de aceptación. Sus comentarios y reviews continúan siendo evidencia.

## Costura implementada

`resolverVistaCombate` importa y despacha los cuatro módulos por nombre, no solo
un enum. Todos devuelven la misma forma:

```js
{ modo, camara: [x, y, z], yaw, pitch, zoom, proyeccion, dibujarPropio }
```

Es presentación pura: posiciones en metros, ángulos en radianes, yaw cero hacia
+z. La táctica adapta centro.x/centro.y al plano x/z y declara orientación cenital;
la altura nominal es 10 metros y el tamaño proyectado corresponde al zoom, no a
la distancia. Esto **no implementa una proyección**: ningún renderer consume aún
ese dato. El modelo táctico conserva su API de cuadrícula y sus unidades de entrada;
el futuro adaptador debe suministrarlas en metros si comparte el plano del catálogo.
POV y tercera reciben `origenCasilla` métrico explícito, con casilla de
5 pies convertidos a 1.524 metros; omitirlo conserva la casilla original por
compatibilidad. Se comprueban casillas desplazadas y negativas, movimiento y retiro.

V queda libre para el alternador de la nave. Solo se traducen 1/2/3/4; esta entrega
no registra ningún listener global. La cámara libre conserva las operaciones
existentes de movimiento/orbita/zoom GM; ese guard de presentación no es autorización
de datos. El catálogo no recibe ni publica entidades, visibilidad ni estado de combate.

## Pendientes preservados: no se rebaja la aceptación

- #1020: adaptador cenital ortográfico en retro3d y evidencia real de zoom sin perspectiva.
- #1021/#1022: cámaras ligadas al combatiente en una superficie real; no se concede
  movimiento de combate ni se valida aquí ocupación/autorización de la casilla.
- #1023: controles y captura en runtime; no se certifica acceso a datos ocultos.
- #1024: UI/atajo conectado al catálogo de puerta, lifecycle y smoke jugable.
- #1013: política de target desaparecido/no visible, transición de turno y autoridad
  corresponde al contrato superior y no se decide unilateralmente en este modelo.
- Validación visual/Foundry de las cámaras completas; los tests de modelos no son capturas.

La anterior aprobación parcial de #1060 no se usa para omitir el bloqueo común
señalado por el colaborador. Esta rama incorpora una costura real y pruebas de
forma/intercambiabilidad; el adaptador jugable sigue pendiente explícitamente.

OTACON Astra
