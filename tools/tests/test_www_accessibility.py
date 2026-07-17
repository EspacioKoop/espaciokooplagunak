import re
import unittest
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
WWW_INDEX = ROOT / "www" / "index.html"


class ControlCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.controls: dict[str, dict[str, str | None]] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        control_id = attributes.get("id")
        if control_id and tag in {"textarea", "pre"}:
            self.controls[control_id] = {"tag": tag, **attributes}


class WwwAccessibilityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.source = WWW_INDEX.read_text(encoding="utf-8")
        parser = ControlCollector()
        parser.feed(cls.source)
        cls.controls = parser.controls

    def test_http_sandbox_controls_have_contextual_accessible_names(self) -> None:
        expected = {
            "exec-script": ("textarea", "/exec.lua script"),
            "get-script": ("textarea", "/get.lua parameters"),
            "get-output": ("textarea", "/get.lua response"),
            "set-script": ("textarea", "/set.lua parameters"),
            "set-output": ("textarea", "/set.lua response"),
        }
        for control_id, (tag, accessible_name) in expected.items():
            with self.subTest(control_id=control_id):
                self.assertIn(control_id, self.controls)
                self.assertEqual(self.controls[control_id]["tag"], tag)
                self.assertEqual(self.controls[control_id].get("aria-label"), accessible_name)

        self.assertEqual(self.controls["exec-output"]["tag"], "pre")
        self.assertNotIn("aria-label", self.controls["exec-output"])

    def test_exec_output_pre_has_a_matching_closing_tag(self) -> None:
        self.assertRegex(
            self.source,
            re.compile(r'<pre\b[^>]*\bid="exec-output"[^>]*>\s*</pre>', re.DOTALL),
        )
        self.assertNotRegex(
            self.source,
            re.compile(r'<pre\b[^>]*\bid="exec-output"[^>]*>\s*</textarea>', re.DOTALL),
        )


if __name__ == "__main__":
    unittest.main()