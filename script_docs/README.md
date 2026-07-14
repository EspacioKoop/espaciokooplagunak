Python scripts to generate the HTML documentation for the scripting API.

A successful build of EmptyEpsilon also builds the scripting reference, which should be the `script_reference.html` file in the build directory.

To build the reference manually, you must have Python 3 installed.

1. Navigate to the `script_docs` directory in the EmptyEpsilon repository.
2. Run `python3 ./main.py output.html`, where `output.html` is the name of the file you want to write.
3. Open `output.html` in a browser.

Fork note (Espaciokoop Lagunak, issue #87): syntax highlighting no longer loads
highlight.js from a CDN. The assets live in `vendor/` (see `vendor/README.md` for
version, provenance and update procedure) and `main.py` embeds them inline via the
`{{inline ...}}` template tag, so the generated `script_reference.html` remains a
single self-contained file that also works offline.

