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

  const snapshot = () => ({ revision, state: clone(state) });

  return {
    snapshot,

    connect(clientId, knownRevision = null) {
      // A client with a stale revision receives the complete authoritative state.
      return snapshot({ clientId, knownRevision });
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
      return snapshot();
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
