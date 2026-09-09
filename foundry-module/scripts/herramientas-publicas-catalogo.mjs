export function construirHerramientasPublicas({
  abrirCantina,
  abrirSeccionNave,
  abrirAndarNave,
  alternarAudioLocal,
}) {
  return [
    {
      name: "lagunak-cantina",
      title: "LAGUNAK.Controles.AbrirCantina",
      icon: "fa-solid fa-mug-saucer",
      button: true,
      onClick: () => abrirCantina(),
    },
    {
      name: "lagunak-seccion",
      title: "LAGUNAK.Controles.AbrirSeccion",
      icon: "fa-solid fa-diagram-project",
      button: true,
      onClick: () => abrirSeccionNave(),
    },
    {
      name: "lagunak-andar-nave",
      title: "LAGUNAK.Controles.AbrirAndarNave",
      icon: "fa-solid fa-person-walking",
      button: true,
      onClick: () => abrirAndarNave(),
    },
    {
      name: "lagunak-musica-audio",
      title: "LAGUNAK.Controles.AudioMusica",
      icon: "fa-solid fa-headphones",
      button: true,
      onClick: () => alternarAudioLocal(),
    },
  ];
}
