# Guía de Escaneo de Secretos para Espacio Kooplagaunak

## Objetivo
Garantizar que ninguna credencial real sea commitada al repositorio, protegiendo al proyecto y a sus mantenedores.

## Herramientas Integradas
1. **GitHub Secret Scanning**: Escanea todo el historial y nuevos pushes.
2. **Push Protection**: Bloquea commits que contengan secretos conocidos antes de que lleguen al servidor.

## Flujo de Trabajo Seguro
1. Antes de hacer commit, revisa archivos de configuración (`.env`, `config.js`, etc.).
2. Usa variables de entorno locales, nunca hardcodees valores.
3. Si usas ejemplos, usa valores ficticios (`AKIAIOSFODNN7EXAMPLE`).

## ¿Qué hacer si GitHub detecta un secreto?
1. Recibirás un email de `GitHub Security`.
2. Ve a la pestaña **Security** del repo > **Secret scanning**.
3. Rota la credencial en el proveedor externo (ej. regenerar API Key en AWS).
4. Vuelve a GitHub y marca como "Resolved" > "Revoked".

## Falsos Positivos
Si el scanner marca algo que no es un secreto real (ej. una clave de ejemplo en tests):
1. Comenta en la alerta explicando por qué es seguro.
2. Un maintainer la marcará como "Used in tests" o "Invalid".

Firmado: Teseo (Qwen3.5)
