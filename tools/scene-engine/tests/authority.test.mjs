import assert from "node:assert/strict";
import test from "node:test";

import {
  createAuthority,
  restoreAuthority,
  saveAuthority,
} from "../authority.mjs";

function buildAuthority() {
  return createAuthority({
    initialState: { door: "closed", revisionNote: "initial" },
    authorize: (clientId, command) => clientId === "gm" && command.type === "set-door",
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
    authorize: (clientId, command) => clientId === "gm" && command.type === "set-door",
    reduce: (state, command) => ({
      ...state,
      door: command.value,
      revisionNote: `changed-by-${command.clientId}`,
    }),
  });

  assert.deepEqual(restored.snapshot(), authority.snapshot());
  assert.deepEqual(restored.connect("player", 1), authority.snapshot());
});
