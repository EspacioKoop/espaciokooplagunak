function referenciaValida(value) {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function resolverMapRef(nodo, documentos = []) {
  const mapRef = referenciaValida(nodo?.map_ref);
  if (!mapRef || !Array.isArray(documentos)) return null;

  return documentos.find(
    (documento) => documento && documento.id === mapRef,
  ) ?? null;
}
