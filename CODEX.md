# Instrucciones para Codex CLI

**Este archivo no contiene el contrato: lo indexa.** Se mantiene deliberadamente corto porque
duplicar las instrucciones por herramienta es cómo se desincronizan — y una regla desincronizada es
peor que no tenerla, porque parece vigente.

Lee, en este orden:

1. [`AGENTS.md`](AGENTS.md) — el contrato operativo, común a **cualquier** agente que trabaje en
   este repositorio: prioridades, arranque obligatorio, límites, coordinación y qué debe incluir
   cada entrega. Sus reglas prevalecen sobre cualquier hábito por defecto de la herramienta.
2. [`CLAUDE.md`](CLAUDE.md) — el conocimiento del repositorio: qué es el proyecto, comandos de
   compilación y prueba, arquitectura por áreas, flujo git y estilo. El nombre es histórico (lo
   escribió y lo mantiene Claude Code); el contenido **no** es específico de ninguna herramienta y
   te sirve igual.
3. [`docs/adr/`](docs/adr/README.md) — las decisiones ya tomadas. `CLAUDE.md` incluye una tabla
   «si estás tocando X, léete el ADR N». No rediscutas una decisión registrada: si crees que está
   mal, la vía es un ADR nuevo que la sustituya, no un PR que la ignore.

Si algo de lo anterior se contradice con lo que te diga tu configuración por defecto, manda el
repositorio.
