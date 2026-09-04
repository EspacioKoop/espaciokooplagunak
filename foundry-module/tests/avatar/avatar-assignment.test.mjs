import assert from "node:assert/strict";
import test from "node:test";

import {
  AVATAR_ASSIGNMENT_ERRORS,
  assignAvatar,
  avatarDeUsuario,
  canAssignAvatar,
} from "../../scripts/avatar/avatar-assignment.mjs";

const MODULE_ID = "lagunak";

function user({ id, name = id, isGM = false, avatar = null } = {}) {
  return {
    id,
    name,
    isGM,
    flags: avatar ? { avatar } : {},
    getFlag(_moduleId, key) { return this.flags[key]; },
    async setFlag(_moduleId, key, value) { this.flags[key] = value; },
  };
}

test("cada quien puede editar su propio avatar, y el GM el de cualquiera", () => {
  const gm = user({ id: "gm", isGM: true });
  const jugador = user({ id: "u1" });
  const otro = user({ id: "u2" });

  assert.equal(canAssignAvatar(gm, jugador), true);
  assert.equal(canAssignAvatar(jugador, jugador), true);
  assert.equal(canAssignAvatar(jugador, otro), false);
});

test("guardar normaliza la descripción y la deja en el flag", async () => {
  const jugador = user({ id: "u1" });
  const resultado = await assignAvatar({
    actor: jugador,
    target: jugador,
    descripcion: { raza: "elfo", clase: "picaro", silueta: "estrecha", gesto: "brindis" },
    moduleId: MODULE_ID,
  });

  assert.equal(resultado.raza, "elfo");
  assert.equal(resultado.clase, "picaro");
  assert.equal(resultado.gesto, "brindis");
  assert.deepEqual(jugador.flags.avatar, resultado);
});

test("una descripción inválida no rompe el guardado: cae a los valores por defecto", async () => {
  const jugador = user({ id: "u1" });
  const resultado = await assignAvatar({
    actor: jugador,
    target: jugador,
    descripcion: { raza: "marciano", clase: "piloto-espacial" },
    moduleId: MODULE_ID,
  });

  assert.equal(resultado.raza, "humano");
  assert.equal(resultado.clase, "guerrero");
});

test("quien no es dueño ni GM no puede guardar el avatar de otro", async () => {
  const jugador = user({ id: "u1" });
  const otro = user({ id: "u2" });

  await assert.rejects(
    assignAvatar({ actor: jugador, target: otro, descripcion: {}, moduleId: MODULE_ID }),
    (error) => error.code === AVATAR_ASSIGNMENT_ERRORS.NOT_ALLOWED,
  );
});

test("avatarDeUsuario devuelve siempre una descripción completa y normalizada", () => {
  const sinFlag = user({ id: "u1" });
  assert.equal(avatarDeUsuario(sinFlag, MODULE_ID).clase, "guerrero");

  const conFlag = user({ id: "u2", avatar: { raza: "enano", pelo: 99 } });
  const avatar = avatarDeUsuario(conFlag, MODULE_ID);
  assert.equal(avatar.raza, "enano");
  assert.equal(typeof avatar.pelo, "number");
});
