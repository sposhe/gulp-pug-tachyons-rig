# Gulp/Pug/Tachyons Rig

A static site starter template built on Gulp 5, Pug, Sass, and esbuild. Compiles to plain HTML, CSS, and JS with no runtime framework — just fast, flat files ready to deploy anywhere.

## Quick Start

```bash
npm install
gulp dev          # Build + dev server with live reload at localhost:3000
gulp build        # One-time production build
```

## Project Structure

```
├── site.config.js              # Global site settings (edit first)
├── gulpfile.js                 # Build pipeline (rarely needs editing)
├── src/
│   ├── pug/
│   │   ├── views/              # Pages — each .pug file becomes an HTML page
│   │   └── templates/          # Layouts — shared page shells (not compiled directly)
│   ├── sass/
│   │   ├── partials/           # Your stylesheets (%*.scss shorthand files)
│   │   ├── utilities/          # Prebuilt responsive utility classes
│   │   ├── boilerplate/        # Normalize CSS
│   │   ├── transients/         # Auto-generated from partials (do not edit)
│   │   └── styles.scss         # Sass entry point and breakpoint config
│   ├── js/
│   │   ├── index.js            # JS entry point
│   │   └── utils.js            # Shared utilities
│   └── images/                 # Static images (copied as-is to output)
└── docs/                       # Build output (auto-generated, gitignored)
```

## First Steps for a New Site

### 1. Edit `site.config.js`

This is the first file to change. It provides global variables available in every Pug template.

```js
export default {
  baseurl: 'https://yourdomain.com/',   // Trailing slash required
  site_name: 'Your Site Name',          // Used in OpenGraph og:site_name
  locale: 'en-US'                       // Used in OpenGraph og:locale
}
```

### 2. Edit the Home Page — `src/pug/views/index.pug`

This is the starter home page. It extends the base layout and defines page-level metadata and content.

```pug
extends ../templates/root.pug

append variables
  - const path = ''
  - const url = baseurl + path
  - const title = 'Your Page Title'
  - const description = 'A brief description of this page.'
  - const type = 'website'
  - const image = baseurl + 'og.png'
  - const imageWidth = 1200
  - const imageHeight = 630
  - const imageAlt = 'Description of the share image.'

block content
  main#main
    header
      h1 Your Page Title
    p Welcome to the site.
```

The variables in `append variables` are used to auto-generate `<title>`, `<meta name="description">`, canonical URL, and all OpenGraph meta tags. You do not need to write meta tags by hand.

### 3. Add Your Styles — `src/sass/partials/`

Create `%`-prefixed `.scss` files here (e.g., `%home.scss`). These files support a shorthand syntax where `%classname;` expands to `@extend %classname;` during the build:

```scss
// src/sass/partials/%home.scss
.hero {
  %pa4;
  %bg-dark-blue;
  %white;
  %tc;
}
```

The available `%placeholder` classes come from `src/sass/utilities/_tachyons-responsive.scss` and follow Tachyons naming conventions (e.g., `%pa4` for padding, `%db` for display block, `%flex` for flexbox). Responsive variants are available by appending `-ns`, `-l`, or `-xl` (e.g., `%pa4-ns` applies padding only at the `ns` breakpoint and above).

After creating a new partial, register it in `src/sass/styles.scss`:

```scss
@use 'transients/home';    // Matches the generated _home.scss

// ... at the bottom of the file, add:
@include home.styles;
```

### 4. Add JavaScript — `src/js/`

Create modules in `src/js/` and import them from `index.js`. Everything is bundled into a single `docs/js/bundle.js` via esbuild (IIFE format, minified, with source maps).

```js
// src/js/nav.js
export function initNav() { /* ... */ }

// src/js/index.js
import { initNav } from './nav.js'
initNav()
```

## Adding Pages

Create a new `.pug` file in `src/pug/views/`. The filename determines the URL:

| Source file                    | Output                         | URL             |
|--------------------------------|--------------------------------|-----------------|
| `src/pug/views/index.pug`      | `docs/index.html`              | `/`             |
| `src/pug/views/work.pug`       | `docs/about/index.html`        | `/about/`       |
| `src/pug/views/work-design.pug`| `docs/work/design/index.html`  | `/work/design/` |

Every page should extend the base layout and define its variables:

```pug
extends ../templates/root.pug

append variables
  - const path = 'about/'
  - const url = baseurl + path
  - const title = 'About'
  - const description = 'Learn more about us.'
  - const type = 'website'

block content
  main#main
    h1 About
```

## Base Layout — `src/pug/templates/root.pug`

The base template provides the HTML shell. It defines these overridable blocks:

| Block       | Purpose                                    | Default                          |
|-------------|--------------------------------------------|----------------------------------|
| `variables` | Page-level data (use `append variables`)   | —                                |
| `head`      | Entire `<head>` contents                   | Meta tags, styles, scripts       |
| `meta`      | Meta tags only                             | charset, viewport, OG tags       |
| `styles`    | Stylesheet links                           | `/css/styles.css`                |
| `scripts`   | Scripts in `<head>`                        | —                                |
| `json`      | JSON-LD structured data                    | —                                |
| `header`    | Page header                                | —                                |
| `content`   | Page body content                          | —                                |
| `footer`    | Page footer                                | —                                |

The template auto-generates OpenGraph meta tags and a canonical link from the variables you define. The JS bundle (`/js/bundle.js`) is loaded at the end of `<body>`.

## JSON-LD Structured Data

Define a `block json` in any page to add structured data. Use `at-` as a prefix for JSON-LD `@` properties (required because Pug compiles through XML internally):

```pug
block json
  at-context http://schema.org
  at-graph
    at-type WebSite
    at-id= baseurl + '#WebSite'
    url= baseurl
  at-graph
    at-type WebPage
    at-id= url + '#WebPage'
    url= url
    description= description
```

This compiles to an inline `<script type="application/ld+json">` block in the HTML output. The `at-` prefix is converted to `@` automatically.

## Sass & CSS

### Breakpoints

Four configurable breakpoints are defined in `src/sass/styles.scss`:

| Suffix | Min-width | Meaning        |
|--------|-----------|----------------|
| (none) | 0         | Mobile-first   |
| `-ns`  | 768px     | Not small      |
| `-l`   | 1024px    | Large          |
| `-xl`  | 1350px    | Extra large    |

### Using Utility Placeholders

In `%`-prefixed partials, use the shorthand to apply utility classes:

```scss
.card {
  %pa3;          // padding on all sides (mobile)
  %pa4-ns;       // more padding at ns breakpoint
  %flex-l;       // flexbox at large breakpoint
}
```

Unused placeholders produce no CSS output — Sass tree-shakes any `%placeholder` that is never `@extend`ed.

### Standalone Breakpoint Mixins

For one-off responsive rules that don't use utilities, use the breakpoint mixins in any `.scss` file:

```scss
@use '../styles' as s;

.sidebar {
  display: none;
  @include s.ns { display: block; }
}
```

Available mixins: `mo` (mobile only, max-width: 767px), `ns`, `l`, `xl`.

### Adding Custom Responsive Utilities

Add your own utility placeholders to `src/sass/utilities/_custom-responsive.scss` inside the `generate($s)` mixin. They will automatically get responsive variants:

```scss
@mixin generate($s) {
  %custom-shadow#{$s} { box-shadow: 0 2px 8px rgba(0,0,0,.15); }
}
```

This generates `%custom-shadow`, `%custom-shadow-ns`, `%custom-shadow-l`, `%custom-shadow-xl`.

### File Naming Convention

| Prefix | Location     | Purpose                                   |
|--------|--------------|-------------------------------------------|
| `%`    | `partials/`  | Author-editable shorthand files           |
| `_`    | `transients/`| Auto-generated from `%` files (do not edit)|
| `_`    | everywhere else | Standard Sass partials                 |

## Build Output

Running `gulp build` generates the `docs/` directory:

```
docs/
├── index.html              # Compiled HTML pages
├── css/
│   ├── styles.css          # Full CSS
│   └── styles.min.css      # Minified CSS
├── js/
│   ├── bundle.js           # Bundled + minified JS
│   └── bundle.js.map       # Source map
└── images/                 # Copied from src/images/
```

The `docs/` folder is gitignored and fully self-contained. Deploy it to any static host (GitHub Pages, Netlify, Vercel, S3, etc.).

## Key Files Reference

| File | When to edit |
|------|-------------|
| `site.config.js` | Setting up a new site (URL, name, locale) |
| `src/pug/views/*.pug` | Adding or editing pages |
| `src/pug/templates/root.pug` | Changing the shared HTML layout |
| `src/sass/partials/%*.scss` | Writing page/component styles |
| `src/sass/utilities/_custom-responsive.scss` | Adding custom utility classes |
| `src/sass/styles.scss` | Registering new partials, changing breakpoints |
| `src/js/index.js` | Adding JavaScript functionality |
| `gulpfile.js` | Modifying the build pipeline |
| `.browserslistrc` | Changing browser support targets |
