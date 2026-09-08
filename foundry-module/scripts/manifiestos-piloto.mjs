// Manifiestos piloto del contrato de capacidades (#709). Documentados en
// docs/CONTRATO_CAPACIDADES.md junto con el formato y las invariantes que
// validarManifiesto/validarManifiestos hacen cumplir.

export const atlas = {
  module: "atlas",
  standalone: true,
  produces: ["discovery.recorded"],
  consumes: ["station.action.completed"],
  capabilities: ["record_discovery", "query_discovery"],
};

export const chronicle = {
  module: "chronicle",
  standalone: true,
  produces: ["chronicle.entry.created"],
  consumes: [
    "discovery.recorded",
    "crew.convocation.requested",
    "station.action.completed",
  ],
  capabilities: ["record_entry"],
};

export const foundryBridge = {
  module: "foundry-bridge",
  standalone: false,
  produces: ["bridge.connection.changed"],
  consumes: ["chronicle.entry.created", "ship.system.status_changed"],
  capabilities: ["relay_bridge_state"],
};

export const manifiestosPiloto = [atlas, chronicle, foundryBridge];
