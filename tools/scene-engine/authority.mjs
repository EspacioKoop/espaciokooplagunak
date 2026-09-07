// Authoritative standalone state for the scene vertical.
// Rendering adapters consume snapshots but cannot mutate this state directly.

function clone(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(clone);
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)]));
}

function checkFunction(value, name) {
  if (typeof value !== "function") throw new TypeError(`${name} must be a function`);
}

export function createAuthority({ initialState, initialRevision = 0, authorize, reduce }) {
  checkFunction(authorize, "authorize");
  checkFunction(reduce, "reduce");
  if (!Number.isInteger(initialRevision) || initialRevision < 0) {
    throw new TypeError("initialRevision must be a non-negative integer");
  }

  let state = clone(initialState);
  let revision = initialRevision;

  // `snapshot()` (no args) is the INTERNAL, complete, authoritative view —
  // it must never be handed to a client directly. Anything that leaves the
  // authority for a specific client goes through `projection(clientId)`,
  // which asks `authorize` per top-level field before including it. This is
  // what was missing: connect() used to return the raw snapshot regardless
  // of clientId, so a field like `gmSecret` reached every client that ever
  // connected or reconnected, no matter what `authorize` said.
  const snapshot = () => ({ revision, state: clone(state) });

  function projection(clientId) {
    const full = snapshot();
    const visible = {};
    for (const [field, value] of Object.entries(full.state)) {
      const allowed = authorize(clientId, { type: "read", field }, full);
      if (allowed) visible[field] = clone(value);
    }
    return { revision: full.revision, state: visible };
  }

  return {
    snapshot,

    connect(clientId, knownRevision = null) {
      // A client with a stale revision receives the complete authoritative
      // state it is entitled to see — never more, regardless of knownRevision.
      void knownRevision;
      return projection(clientId);
    },

    dispatch(clientId, command) {
      const request = { ...clone(command), clientId };
      if (!authorize(clientId, request, snapshot())) throw new Error("not authorized");
      const nextState = reduce(clone(state), request);
      if (!nextState || typeof nextState !== "object") {
        throw new TypeError("reduce must return an object state");
      }
      state = clone(nextState);
      revision += 1;
      return projection(clientId);
    },
  };
}

export function saveAuthority(authority) {
  if (!authority || typeof authority.snapshot !== "function") {
    throw new TypeError("authority must expose snapshot");
  }
  return JSON.stringify(authority.snapshot());
}

export function restoreAuthority(serialized, options) {
  let saved;
  try {
    saved = typeof serialized === "string" ? JSON.parse(serialized) : clone(serialized);
  } catch {
    throw new TypeError("saved authority is not valid JSON");
  }
  if (
    !saved ||
    !Number.isInteger(saved.revision) ||
    saved.revision < 0 ||
    !saved.state ||
    typeof saved.state !== "object"
  ) {
    throw new TypeError("saved authority has an invalid snapshot");
  }

  const authority = createAuthority({
    ...options,
    initialState: saved.state,
    initialRevision: saved.revision,
  });
  return authority;
}
