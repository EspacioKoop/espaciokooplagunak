# Investigación de licencias RPG

Este directorio es una investigación técnica para el issue #857, no asesoramiento jurídico. Las fichas registran el alcance de una fuente concreta; una licencia de reglas no autoriza por defecto el uso de setting, arte, nombres, logos o marcas.

## Regla standalone

Espaciokoop Lagunak funciona sin estos sistemas. Este repositorio no incorpora SRD, texto, arte ni branding de terceros. Una integración futura debe vivir fuera del core y depender de él en una sola dirección:

```text
adaptador opcional -> core Espaciokoop
core Espaciokoop -X-> RPG externo o adaptador
```

El registro machine-readable está en [`registry.json`](registry.json). Se valida con:

```bash
python3 tools/validate_license_registry.py
python3 -m pytest tools/tests/test_validate_license_registry.py -q
```

Cada ficha declara `verificationStatus`:

- `verified`: la fuente primaria, versión y alcance indicados se han fijado y no
  contienen marcadores pendientes;
- `pending`: sirve como inventario de investigación, pero **no** autoriza una
  adopción ni puede alimentar una recomendación de integración.

En esta primera entrega solo Year Zero Engine está marcado `verified`. Las demás
fichas permanecen deliberadamente `pending` hasta fijar su texto primario,
versión y alcance exactos.

## Matriz comparativa y decisión provisional

| Sistema | Licencia/fuente | Uso seguro ahora | VTT/comercial | Riesgo |
|---|---|---|---|---|
| Year Zero Engine | FTL 1.0, Free League | adaptador separado; solo YZE SRD | VTT y comercial sujetos a FTL | medio |
| Cairn | CC BY-SA 4.0, sitio oficial | inspiración o texto expresamente cubierto | permitido por CC con BY-SA | bajo |
| Fate | CC BY/OGL según texto | revisar la versión del SRD | depende del texto y marca | bajo/medio |
| Blades/FitD | fuente y sistema concretos | inspiración; revisar términos | no asumir permisos | medio/alto |
| Basic Fantasy | edición y contenido designado | referencia; confirmar edición | confirmar | medio |
| Mausritter | SRD y versión concretos | referencia; confirmar alcance | confirmar | medio |
| Liminal Horror | SRD y versión concretos | referencia; confirmar alcance | confirmar | medio |
| ORC | licencia, no contenido | modelo de licenciamiento | depende del contenido | bajo |
| MÖRK BORG | programa de terceros | estudiar separación de IP | depende del programa | alto |

Otros candidatos están en el registro: OpenD6, Open Legend, Ironsworn, Starforged, Dungeon World, Cepheus Engine, BRP, OpenQuest, PbtA y FitD. La inclusión en un índice o ecosistema no equivale a autorización.

### Candidatos de investigación (no aprobados como pilotos)

1. **Year Zero Engine**, ficha verificada: puede evaluarse como adaptador separado,
   respetando el aviso, el alcance SRD y las exclusiones.
2. **Cairn**, pendiente: antes de proponer un piloto hay que fijar edición y texto
   primario cubierto.
3. **Fate**, pendiente: antes de proponer un piloto hay que fijar versión, opción
   de licencia y texto exacto cubierto.

## Fuentes primarias consultadas

- [Free League: Open Game Licenses](https://freeleaguepublishing.com/community-content/free-tabletop-licenses/) y [FTL 1.0 (PDF)](https://freeleaguepublishing.com/wp-content/uploads/2023/11/Year-Zero-Engine-License-Agreement.pdf).
- [Cairn](https://cairnrpg.com/), que declara CC BY-SA 4.0 para el texto.
- [Fate SRD](https://fate-srd.com/) y [guía oficial de licencias de Evil Hat](https://evilhat.com/wp-content/uploads/2022/03/Fate-Version-Guide-Spheres-Differences-Licensing-Selections-2021.pdf).
- [Blades licensing](https://bladesinthedark.com/licensing) y [SRD](https://bladesinthedark.com/browse-srd).
- [Basic Fantasy](https://www.basicfantasy.org/), [Paizo ORC](https://paizo.com/orclicense) y [MÖRK BORG content](https://morkborg.com/content/).

Las fichas con `verify` son deliberadamente conservadoras: antes de redistribuir material hay que comprobar el texto vigente, la edición y la parte exacta cubierta.
