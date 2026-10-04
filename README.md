# Estado de cuenta a Excel

Convierte el PDF "Estado de Cuenta" de Banca Remota en un `.xlsx`. Todo corre en el navegador; el PDF no sale de la máquina. Sitio estático para GitHub Pages, sin paso de build.

## Correr en local

Los módulos ES no cargan con doble clic (`file://`); hace falta un servidor:

```sh
python3 -m http.server 8000
# abrir http://localhost:8000
```

## Estructura

```
index.html              markup
css/styles.css          estilos (tema claro/oscuro)
vendor/                 pdf.js 3.11.174 (Apache-2.0), ExcelJS 4.4.0 (MIT) — sin tocar
js/
  main.js               entrada: eventos, flujo cargar PDF → alias → render → descargar
  config.js             comercios conocidos y conceptos   ← editar aquí
  util.js               formato de números, texto
  domain/
    classify.js         concepto, comercio, descripción y tránsito de cada operación
    statement.js        filas, saldos calculados, totales, comprobación
    summary.js          agregados por concepto y comercio
  pdf/parser.js         lectura del PDF con pdf.js (columnas por coordenadas)
  storage/aliases.js    alias de comercios en localStorage
  storage/ejemplos.js   ejemplos de cada plantilla en localStorage (arranque sin PDF)
  excel/
    workbook.js         arma el libro y el nombre del archivo
    movimientos.js      hoja Movimientos
    resumen.js          hoja Resumen
    styles.js           colores y formatos compartidos
  ui/
    render.js           pinta resultados, estado y errores
    aliasDialog.js      modal de comercios sin identificar
```

Dependencias en un solo sentido: `config/util → domain → pdf · excel · storage → ui → main`.
Solo `ui/` y `main.js` tocan el DOM; solo `storage/` toca `localStorage`.

## Despliegue

GitHub Pages se publica con `.github/workflows/pages.yml`:

- Push / merge a `main` → publica `main` (siempre tiene prioridad).
- Etiqueta `deploy` en un PR → publica la rama del PR en vez de `main`; cada commit nuevo al PR se vuelve a publicar.
- Etiqueta `remove-flag-deploy` (o quitar `deploy`, o cerrar el PR sin merge) → vuelve a publicar `main` y limpia las etiquetas.
