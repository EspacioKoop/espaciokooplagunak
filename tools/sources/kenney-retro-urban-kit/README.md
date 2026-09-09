# Fuente de la escalera de balcón

Autor: Kenney (kenney.nl). Pack **Retro Urban Kit 2.0** (2025-01-29).
Licencia del archivo: **CC0 1.0**, no la GPL del código del repositorio.
La [página oficial](https://kenney.nl/assets/retro-urban-kit) declara CC0;
[License.txt](License.txt) conserva el aviso del distribuidor (solo espacios y
saltos de línea normalizados). El original del aviso en el ZIP tiene SHA-256
`83d0de4f34000323da12cf54bc542dbc24ba48cfad101510dccddaa69483ebeb`.

- [ZIP oficial](https://kenney.nl/media/pages/assets/retro-urban-kit/8314d4db22-1738147509/kenney_retro-urban-kit.zip).
- Entrada: `Models/GLB format/balcony-ladder-bottom.glb`.
- Copia binaria sin cambios: [balcony-ladder-bottom.glb](balcony-ladder-bottom.glb).
- Tamaño: 4196 bytes.
- SHA-256: `266b04ffb06c53a17988f858646d1fd1072258050ac3d9ba653004a769cc37d1`.

## Receta offline desde la raíz del repositorio

```bash
node tools/convertir-glb-geometria.mjs > foundry-module/data/mallas/balcony-ladder-bottom.mjs
node --test foundry-module/tests/convertir-glb-geometria.test.mjs
```

La CLI comprueba el hash registrado antes de emitir código. No requiere paquetes,
red ni el ZIP. El lector acepta hasta 1 MiB y 65536 elementos por accessor:
GLB 2, exactamente chunks JSON/BIN, un buffer interno, una escena, un nodo
identidad, una malla y una primitiva TRIANGLES indexada; POSITION float32 VEC3,
índices unsigned 8/16/32, offsets y stride validados contra cada bufferView.
Transformaciones no identidad, jerarquías, skins, animaciones, morphs, sparse,
accessors normalized, compresión y extensiones geométricas se rechazan.
Nombres y metadatos min/max de accessors son informativos, no autoridad.
Los atributos NORMAL/TANGENT/TEXCOORD_0/TEXCOORD_1/COLOR_0, accessors no usados
y datos de material/imagen/sampler/textura no se interpretan ni validan como
contenido renderizable. Las declaraciones KHR_materials_unlit y
KHR_texture_transform se toleran solo porque no afectan a esta geometría.
No es un validador general de glTF ni un cargador de materiales.

La referencia externa `Textures/bars.png` permanece en el GLB original, pero
no se distribuye ni se abre: solo se extrae geometría. La igualdad estructural
exacta con la malla anterior se probó antes de regenerarla; no se inventó ni
se normalizó una geometría sustituta. La serialización JS conserva incluso -0.

No hay consumidor visual del catálogo: este fixture y sus pruebas no acreditan
apariencia, selección, colocación ni funcionamiento en Foundry.
