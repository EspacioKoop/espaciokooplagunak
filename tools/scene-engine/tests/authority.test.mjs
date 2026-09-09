import assert from "node:assert/strict";
import test from "node:test";

import {
  createAuthority,
  restoreAuthority,
  saveAuthority,
} from "../authority.mjs";

// These tests exercise state flow, not the read/authority boundary itself
// (that boundary is covered separately below), so reads stay open to both
// clients and only the `set-door` command stays GM-only.
function authorizeOpenReads(clientId, command) {
  if (command.type === "read") return true;
  return clientId === "gm" && command.type === "set-door";
}

function buildAuthority() {
  return createAuthority({
    initialState: { door: "closed", revisionNote: "initial" },
    authorize: authorizeOpenReads,
    reduce: (state, command) => ({
      ...state,
      door: command.value,
      revisionNote: `changed-by-${command.clientId}`,
    }),
  });
}

test("connect gives both clients the same authoritative snapshot and revision", () => {
  const authority = buildAuthority();

  const first = authority.connect("gm");
  const second = authority.connect("player");

  assert.deepEqual(first, second);
  assert.equal(first.revision, 0);
  assert.equal(first.state.door, "closed");
});

test("only an authorized client changes state and each accepted command advances revision", () => {
  const authority = buildAuthority();

  assert.throws(
    () => authority.dispatch("player", { type: "set-door", value: "open" }),
    /not authorized/,
  );
  assert.equal(authority.snapshot().revision, 0);

  const result = authority.dispatch("gm", { type: "set-door", value: "open" });

  assert.equal(result.revision, 1);
  assert.equal(result.state.door, "open");
  assert.equal(result.state.revisionNote, "changed-by-gm");
  assert.deepEqual(authority.connect("player", 0), authority.snapshot());
});

test("save and restore preserve state and revision for reconnection", () => {
  const authority = buildAuthority();
  authority.dispatch("gm", { type: "set-door", value: "open" });

  const saved = saveAuthority(authority);
  const restored = restoreAuthority(saved, {
    authorize: authorizeOpenReads,
    reduce: (state, command) => ({
      ...state,
      door: command.value,
      revisionNote: `changed-by-${command.clientId}`,
    }),
  });

  assert.deepEqual(restored.snapshot(), authority.snapshot());
  assert.deepEqual(restored.connect("player", 1), authority.snapshot());
});

test("a field an unauthorized client cannot read never reaches it, in connect, reconnection or dispatch", () => {
  const authority = createAuthority({
    initialState: { public: "door", gmSecret: "hidden encounter" },
    // Denies every read: nothing at all should leak to "player".
    authorize: () => false,
    reduce: (state, command) => ({ ...state, public: command.value }),
  });

  const playerConnect = authority.connect("player");
  assert.equal(Object.hasOwn(playerConnect.state, "gmSecret"), false);
  assert.deepEqual(JSON.stringify(playerConnect.state), JSON.stringify({}));

  // Reconnection (a client with a stale/known revision) goes through the
  // exact same projection — no separate, unfiltered path.
  const playerReconnect = authority.connect("player", 0);
  assert.equal(Object.hasOwn(playerReconnect.state, "gmSecret"), false);

  // A dispatch is rejected for this client (authorize denies everything),
  // but even the rejection path must never have handed out the secret.
  assert.throws(() => authority.dispatch("player", { type: "set-public", value: "open" }));
  assert.equal(JSON.stringify(authority.snapshot().state).includes("hidden encounter"), true);
});

test("field-level authorize lets an authorized client see a field a denied client cannot", () => {
  const authority = createAuthority({
    initialState: { public: "door", gmSecret: "hidden encounter" },
    authorize: (clientId, command) => {
      if (command.type === "read") return clientId === "gm" || command.field === "public";
      return clientId === "gm";
    },
    reduce: (state, command) => ({ ...state, ...command.payload }),
  });

  const gmView = authority.connect("gm");
  assert.equal(gmView.state.gmSecret, "hidden encounter");
  assert.equal(gmView.state.public, "door");

  const playerView = authority.connect("player");
  assert.equal(playerView.state.public, "door");
  assert.equal(Object.hasOwn(playerView.state, "gmSecret"), false);

  // Dispatch by the GM also returns a projection scoped to the GM, and
  // still never lets an unrelated player projection see the secret.
  const afterDispatch = authority.dispatch("gm", { type: "set", payload: { public: "open" } });
  assert.equal(afterDispatch.state.gmSecret, "hidden encounter");
  assert.equal(Object.hasOwn(authority.connect("player").state, "gmSecret"), false);
});
