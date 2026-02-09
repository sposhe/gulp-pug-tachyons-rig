# Modern Gulp Build Pipeline

A modern, modular build system using Gulp 5+ to compile Pug templates, Sass stylesheets, and bundle JavaScript with esbuild. Includes JSON-LD schema compilation via Pug and live development server with BrowserSync.

## Architecture Overview

```
src/
├── pug/                  # Pug templates for HTML generation
│   ├── views/            # Page views that get compiled to HTML
│   └── templates/        # Reusable layout templates (not compiled)
├── sass/                 # SCSS stylesheets
│   ├── boilerplate/      # Normalize and base styles
│   ├── partials/         # Shorthand files (%*.scss) — authored here
│   ├── transients/       # Generated longhand files (_*.scss) — do not edit
│   ├── utilities/        # Placeholder utility class definitions
│   └── styles.scss       # Main entry point
├── js/                   # JavaScript modules
└── images/               # Static images

docs/                     # Generated output
├── *.html / */index.html # Compiled HTML with pretty URLs
├── css/styles.css        # Compiled stylesheet
├── js/bundle.js          # Bundled JavaScript
└── images/               # Copied images
```

## Build Pipeline

### JSON-LD Inline Compilation

JSON-LD schemas are compiled inline during Pug compilation:

- Define `block json` in view files with `at-` prefixed properties
- Preprocessing automatically extracts and compiles to JSON
- Converted JSON is injected back into the template
- Pug compiles the template with embedded JSON-LD
- Properties prefixed with `at-` become `@` (XML limitation workaround)

### Pug Compilation (`compilePug`)

- Compile `src/pug/views/**/*.pug` → HTML
- `index.pug` → `docs/index.html`
- `about.pug` → `docs/about/index.html` (pretty URLs)
- Templates in `src/pug/templates/` are NOT compiled
- Global `locals` (`baseurl`, `site_name`, `locale`) defined in `site.config.js` and passed to all templates
- Variables defined in `append variables` are used for OpenGraph meta tags (auto-generated), standard meta tags (`title`, `description`), and JSON-LD schema values

### Sass Utility Shorthand & Compilation

Sass compilation is a two-stage pipeline: shorthand transpilation, then standard Sass compilation.

**Stage 1 — Shorthand transpilation (`sassShorthand`)**

Files in `src/sass/partials/` are prefixed with `%` (e.g., `%test.scss`). Inside these files, `%classname;` is shorthand for `@extend %classname;`:

```scss
// src/sass/partials/%test.scss (authored)
.foo {
  %db;
  %flex-ns;
}

// src/sass/transients/_test.scss (generated — do not edit)
.foo {
  @extend %db;
  @extend %flex-ns;
}
```

The `gulp-sass-extend-shorthand` plugin converts the shorthand, then files are wrapped in a `@mixin styles` block, renamed (`%` → `_`), and written to `src/sass/transients/`. Transient files are generated artifacts — edit the `%`-prefixed source in `partials/` instead.

**Stage 2 — Responsive placeholder generation (`suffixer` mixin)**

`styles.scss` defines a `suffixer` mixin that calls responsive utility mixins once per breakpoint, appending a suffix via the `$s` parameter:

```scss
$breakpoints: ('-ns': 768, '-l': 1024, '-xl': 1350);

@include suffixer using ($s) {
  @include tachyons-responsive.generate($s);
  @include custom-responsive.generate($s);
}
```

Responsive utility files expose a `generate($s)` mixin. Inside it, `#{$s}` generates breakpoint variants:

```scss
// utilities/_tachyons-responsive.scss
@mixin generate($s) {
  %db#{$s} { display: block; }
  // Generates: %db, %db-ns, %db-l, %db-xl
}
```

Standalone breakpoint mixins (`mo`, `ns`, `l`, `xl`) are also available for one-off media queries.

**Stage 3 — Compilation (`compileSass`)**

Dart Sass compilation of `styles.scss` → `docs/css/styles.css`, with autoprefixer via PostCSS. A minified `styles.min.css` is also generated via cssnano. Unused placeholders produce no CSS output (Sass tree-shakes `%placeholder` classes that are never `@extend`ed).

**Workflow**: Edit `%`-prefixed files in `partials/` → watch triggers `sassShorthand` then `compileSass` in series

### JavaScript Bundling (`bundleJs`)

- Bundle `src/js/index.js` with esbuild
- Format: IIFE (compatible with `<script>` tags)
- Minified with source maps

## Task Execution Order

```javascript
export const build = parallel(
  compilePug,                      // Includes automatic JSON-LD preprocessing
  series(sassShorthand, compileSass), // Shorthand transpile, then compile
  bundleJs,                        // JS bundling
  copyImages                       // Copy src/images → docs/images
)
```

Pug, Sass (as a series), JS, and image tasks run in parallel. JSON-LD compilation happens automatically during Pug compilation via preprocessing.

## Development Workflow

```bash
gulp dev        # Start dev server with watch and live reload
gulp build      # One-time build
```

### File Watching

- `src/pug/**/*.pug` → `compilePug` (includes automatic JSON-LD preprocessing)
- `src/sass/**/*.scss` → `sassShorthand` then `compileSass` (CSS injected without reload)
- `src/js/**/*.js` → `bundleJs` (full page reload)
- `src/images/**/*` → `copyImages`

## Extending the Build

- **CSS**: Create `%`-prefixed files in `src/sass/partials/` using shorthand. Add custom responsive utilities inside the `@mixin generate($s)` block in `_custom-responsive.scss`
- **JavaScript**: Create in `src/js/`, import in `index.js` → esbuild bundles automatically
- **Pages**: Create `.pug` in `src/pug/views/` extending `templates/root.pug` with `append variables` block → builds to `docs/[name]/index.html`
- **JSON-LD**: Add `block json` with `at-` prefixed properties → compiles inline automatically
- **Meta/OG tags**: Define variables (`title`, `description`, `type`, `url`, `image`, `imageWidth`, `imageHeight`, `imageAlt`) in `append variables` → auto-generated

## Dependencies

- **gulp** - Task automation
- **pug**, **gulp-pug** - Template compilation
- **gulp-sass**, **sass** - Sass compilation (Dart Sass)
- **gulp-sass-extend-shorthand** - `%classname;` → `@extend %classname;` transpilation
- **gulp-postcss**, **autoprefixer**, **cssnano** - PostCSS processing, vendor prefixes, minification
- **esbuild** - JavaScript bundler
- **gulp-url-builder** - Pretty URL generation
- **gulp-rename** - File renaming (shorthand transpilation, CSS minification)
- **fast-xml-parser** - XML to JSON conversion (for JSON-LD preprocessing)
- **browser-sync** - Live development server

## Code Style

- **JavaScript**: No semicolons, imports sorted by line length (shortest to longest)
- **Pug**: 2-space indentation, single quotes for attributes, comma-delimited attributes, semantic HTML
- **Sass**: 2-space indentation, SCSS nesting, `$` prefix for variables