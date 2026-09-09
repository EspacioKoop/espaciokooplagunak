# Documentación de Espaciokoop Lagunak

Índice de la documentación del fork. Si es tu primera visita, empieza por el
[README principal](../README.md) del repositorio.

## Dirección de producto

| Documento | Qué cubre |
|---|---|
| [ROADMAP_PRODUCTO.md](ROADMAP_PRODUCTO.md) | Principios, no objetivos y etapas hacia el juego cooperativo standalone (#219) |
| [adr/](adr/README.md) | Decisiones de arquitectura registradas |

## Quiero jugar o instalar

| Documento | Qué cubre |
|---|---|
| [INSTALACION.md](INSTALACION.md) | Asistente de instalación guiado (`tools/instalar.py`) |
| [PRUEBA-INDIVIDUAL.md](PRUEBA-INDIVIDUAL.md) | Probar en solitario el escenario «Primera guardia» |
| [SESION-FASE1.md](SESION-FASE1.md) | Guion de sesión de prueba en grupo (fase 1) |
| [BETATESTING.md](BETATESTING.md) | Guion de sesión de betatesting con Foundry (alpha, fase 3) |

## Quiero compilar o desarrollar

| Documento | Qué cubre |
|---|---|
| [BUILDING.md](BUILDING.md) | Compilación nativa y flujo de desarrollo |
| [../docker/README.md](../docker/README.md) | Servidor headless + puente con Docker Compose |
| [UPSTREAM.md](UPSTREAM.md) | Relación con EmptyEpsilon y sincronización con upstream |
| [BASELINE.md](BASELINE.md) | Baseline de accesibilidad, seguridad, calidad y fiabilidad |
| [API_HTTP.md](seguridad/API_HTTP.md) | Inventario del API HTTP heredado del servidor |
| [BRIDGE_AUTHENTICATION.md](seguridad/BRIDGE_AUTHENTICATION.md) | Ciclo de vida, rotación y revocación del Bearer |
| [CONTENT_EDITOR.md](CONTENT_EDITOR.md) | Editor de contenido integrado |

## Integración con Foundry VTT

| Documento | Qué cubre |
|---|---|
| [FOUNDRY.md](FOUNDRY.md) | Arquitectura de la integración y gestión de nave |
| [FOUNDRY_DISTRIBUTION.md](FOUNDRY_DISTRIBUTION.md) | Empaquetado y distribución del módulo Foundry |
| [FOUNDRY_GUI_SMOKE.md](FOUNDRY_GUI_SMOKE.md) | Prueba de humo de la interfaz del módulo |
| [SMOKE_PRS_2026-08-04.md](SMOKE_PRS_2026-08-04.md) | Checklist de trabajo para los PRs abiertos de esa fecha (temporal: bórralo tras cerrarlos) |
| [CONSOLA_CALIENTE_GM.md](CONSOLA_CALIENTE_GM.md) | Cómo se ejecuta la fusión de consolas del GM cuando se abra su puerta (#276) |
| [MINIJUEGOS_FOUNDRY.md](MINIJUEGOS_FOUNDRY.md) | Contrato previo para minijuegos sociales y primer vertical de póker (#308) |
| [MINIJUEGOS_DADOS.md](MINIJUEGOS_DADOS.md) | Reglas del segundo vertical: dados de cubilete, en 3D retro legible (#413) |
| [NPC_GENERADOR.md](NPC_GENERADOR.md) | Motor del generador de NPC: ficha 5e del SRD 5.1, afinidades y reparto de acciones (#676) |
| [MINIJUEGOS_ASISTENCIA.md](MINIJUEGOS_ASISTENCIA.md) | Diseño de asistencia entre puestos con minijuegos de habilidad y tiradas dnd5e (#309) |
| [CONTENIDO_EXTERNO.md](CONTENIDO_EXTERNO.md) | Lectura opcional del contenido dnd5e ya importado por el usuario, filtrado a 2014 (#332) |
| [ECOSISTEMA_MODULOS_FOUNDRY.md](ECOSISTEMA_MODULOS_FOUNDRY.md) | De qué módulos ajenos dependemos, cuáles imitamos y cuáles nos estorban |
| [ASSETS_LIBRES.md](ASSETS_LIBRES.md) | Fuentes de arte y audio libres (CC0, dominio público, CC BY) y por qué la mayoría no encaja todavía (#568) |
| [ATLAS_HYG.md](ATLAS_HYG.md) | Adaptador del catálogo estelar HYG al formato de atlas de #213, sin cablear (#568) |
| [ECOSISTEMA_OPEN_SOURCE.md](ECOSISTEMA_OPEN_SOURCE.md) | Qué código libre y qué datos de dominio público podemos aprovechar, y qué lo impide (#568) |

## Investigación y diseño de contenido

| Documento | Qué cubre |
|---|---|
| [ATLAS_SPELLJAMMER.md](ATLAS_SPELLJAMMER.md) | Investigación del atlas jerárquico de campaña y matriz de procedencia/licencia (#213) |
| [DOMINIO_PUBLICO_SCIFI.md](DOMINIO_PUBLICO_SCIFI.md) | Catálogo verificado de guiños scifi/pulp en dominio público (copyright vs. marca) (#310) |
| [INSPIRACION_JUEGOS_LIBRES.md](INSPIRACION_JUEGOS_LIBRES.md) | Catálogo de mecánicas de rol jugadas en proyectos libres (#840) |
| [research-rpg-open-cc0-licensing.md](research-rpg-open-cc0-licensing.md) | Sistemas de RPG abiertos, licencias y repositorios CC0 para integración standalone (#886) |

## Localización

| Documento | Qué cubre |
|---|---|
| [LOCALIZATION_ES.md](i18n/LOCALIZATION_ES.md) | Estado y proceso de la localización es-ES |
| [i18n-es-style-guide.md](i18n/i18n-es-style-guide.md) | Guía editorial para traducir al español |

## Cómo contribuir

Las normas de colaboración están en [CONTRIBUTING.md](../CONTRIBUTING.md), la
guía para agentes de IA en [AGENTS.md](../AGENTS.md) y el código de conducta en
[CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md).

| Documento | Para qué sirve |
| --- | --- |
| [ETIQUETAS.md](ETIQUETAS.md) | Inventario medido de las etiquetas del repositorio, qué se etiqueta solo y qué no (#717) |
