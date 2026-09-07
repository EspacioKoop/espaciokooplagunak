// Wiring for convocatoria de estancia (#832): inyecta la función convocar en la aplicación.
// Este módulo es puro: ni Foundry, ni DOM, ni red — solo "qué hacer con los datos".
/**
 * Crea los callbacks para la aplicación de convocatoria, inyectando la función convocar.
 * @param {{ convocar: function }} deps
 * @returns {{ onSubmit: function }} callbacks para v1 y v2 (mismo callback para ambas).
 */
export function crearConvocatoriaCallbacks({ convocar }) {
  return {
    // El resultado de convocar() (a quién se convocó, con qué estancia) se
    // entrega al consumidor en vez de descartarse: antes onSubmit ignoraba
    // por completo lo que convocar() devolvía.
    onSubmit: (data) => convocar(data.idEstancia, data.rolConvocante),
  };
}
