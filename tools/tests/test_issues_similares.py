"""Las partes puras de `tools/issues_similares.py`.

No se prueba el modelo —eso no es determinista y no es lo que puede romperse—
sino las tres cosas que sí: qué texto entra a comparar, cómo se ordena y que
nadie salga como vecino de sí mismo. Sin Ollama delante, esta suite pasa igual.
"""

from __future__ import annotations

import unittest

from tools.issues_similares import coseno, texto_de, vecinos


class TextoDeLaIssue(unittest.TestCase):
    def test_junta_titulo_y_arranque_del_cuerpo(self) -> None:
        texto = texto_de({"title": "feat: el museo", "body": "Sale de #590.\nY encaja."})
        self.assertIn("feat: el museo", texto)
        self.assertIn("Sale de #590.", texto)

    def test_tira_tablas_citas_y_bloques_de_codigo(self) -> None:
        # Son ruido de formato: dos issues del mismo tema no se parecen más por
        # tener las dos una tabla.
        texto = texto_de({
            "title": "t",
            "body": "| a | b |\n> cita\n```\ncodigo\n```\nlo que importa",
        })
        self.assertNotIn("| a | b |", texto)
        self.assertIn("lo que importa", texto)

    def test_aguanta_una_issue_sin_cuerpo(self) -> None:
        # El tablero tiene varias con el cuerpo vacío; que reviente ahí sería
        # justo en las que peor se buscan a mano.
        self.assertEqual(texto_de({"title": "solo título", "body": None}), "solo título\n")


class Similitud(unittest.TestCase):
    def test_coseno_conocido(self) -> None:
        self.assertAlmostEqual(coseno([1, 0], [1, 0]), 1.0)
        self.assertAlmostEqual(coseno([1, 0], [0, 1]), 0.0)
        self.assertAlmostEqual(coseno([1, 0], [-1, 0]), -1.0)

    def test_vector_cero_no_revienta(self) -> None:
        self.assertEqual(coseno([0, 0], [1, 1]), 0.0)


class Vecinos(unittest.TestCase):
    VECTORES = {
        1: [1.0, 0.0],
        2: [0.9, 0.1],   # casi igual que 1
        3: [0.0, 1.0],   # ortogonal
        4: [-1.0, 0.0],  # opuesto
    }

    def test_ordena_de_mas_parecido_a_menos_y_se_excluye(self) -> None:
        salida = vecinos(self.VECTORES, 1, k=3)
        self.assertEqual([n for n, _ in salida], [2, 3, 4])
        self.assertNotIn(1, [n for n, _ in salida])

    def test_k_recorta(self) -> None:
        self.assertEqual(len(vecinos(self.VECTORES, 1, k=1)), 1)

    def test_el_desempate_es_estable(self) -> None:
        # Dos issues igual de parecidas salen siempre en el mismo orden: una
        # lista que baila entre ejecuciones no se puede comparar con la de ayer.
        empate = {1: [1.0, 0.0], 7: [0.0, 1.0], 3: [0.0, 1.0]}
        self.assertEqual([n for n, _ in vecinos(empate, 1, k=2)], [3, 7])


if __name__ == "__main__":
    unittest.main()
