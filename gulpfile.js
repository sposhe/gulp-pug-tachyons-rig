import gulp from 'gulp'
import pugCompiler from 'pug'
import gulpPug from 'gulp-pug'
import { dirname } from 'path'
import * as dartSass from 'sass'
import gulpSass from 'gulp-sass'
import rename from 'gulp-rename'
import { Transform } from 'stream'
import * as esbuild from 'esbuild'
import browserSync from 'browser-sync'
import urlBuilder from 'gulp-url-builder'
import { XMLParser } from 'fast-xml-parser'
import sassExtendShorthand from 'gulp-sass-extend-shorthand'
import postcss from 'gulp-postcss'
import autoprefixer from 'autoprefixer'
import cssnano from 'cssnano'
import locals from './site.config.js'

const { src, dest, series, parallel, watch } = gulp

const sass = gulpSass(dartSass)
const bs = browserSync.create()

const paths = {
  pug: {
    src: 'src/pug/views/**/*.pug',
    dest: 'docs'
  },
  sass: {
    partials: 'src/sass/partials/**/*.scss',
    transients: 'src/sass/transients',
    watch: ['src/sass/**/*.scss', '!src/sass/transients/**'],
    src: ['src/sass/**/*.scss', '!src/sass/**/_*.*', '!src/sass/**/%*.*', '!src/sass/**/old.scss'],
    dest: 'docs/css'
  },
  js: {
    src: 'src/js/index.js',
    dest: 'docs/js'
  },
  images: {
    src: 'src/images/**/*',
    dest: 'docs/images'
  }
}

// Preprocess Pug files to compile block json into inline JSON-LD
function preprocessJsonBlocks() {
  const parser = new XMLParser({
    ignoreAttributes: true,
    ignoreDeclaration: true
  })

  return new Transform({
    objectMode: true,
    transform(file, encoding, callback) {
      try {
        const content = file.contents.toString()

        // Check if file has block json
        if (!/(?:block|append|prepend)\s+json/.test(content)) {
          callback(null, file)
          return
        }

        // Extract all include statements
        const includes = []
        const includeRegex = /^(\s*)include\s+(.+)$/gm
        let match
        while ((match = includeRegex.exec(content)) !== null) {
          includes.push(match[0])
        }

        // Extract all top-level variable declarations
        const variables = []
        const varRegex = /^-\s+(var|const|let)\s+.+$/gm
        while ((match = varRegex.exec(content)) !== null) {
          variables.push(match[0])
        }

        // Extract variables from block variables (if it exists)
        const lines = content.split('\n')
        const variablesBlockRegex = /^(\s*)((?:block|append|prepend)\s+variables)\s*$/

        for (let i = 0; i < lines.length; i++) {
          const match = lines[i].match(variablesBlockRegex)
          if (match) {
            const blockIndent = match[1]
            const expectedIndent = blockIndent + '  '

            // Extract content lines from block variables
            for (let j = i + 1; j < lines.length; j++) {
              const line = lines[j]
              if (line.trim() === '') continue
              if (!line.startsWith(expectedIndent)) break
              variables.push(line.substring(expectedIndent.length))
            }
            break
          }
        }

        // Parse line by line to find block json
        const blockRegex = /^(\s*)((?:block|append|prepend)\s+json)\s*$/

        let blockStartIdx = -1
        let blockIndent = ''
        let blockDeclaration = ''

        for (let i = 0; i < lines.length; i++) {
          const match = lines[i].match(blockRegex)
          if (match) {
            blockStartIdx = i
            blockIndent = match[1]
            blockDeclaration = match[2]
            break
          }
        }

        if (blockStartIdx === -1) {
          callback(null, file)
          return
        }

        // Extract content lines that are indented more than the block declaration
        const contentLines = []
        const expectedIndent = blockIndent + '  '
        let blockEndIdx = blockStartIdx

        for (let i = blockStartIdx + 1; i < lines.length; i++) {
          const line = lines[i]
          if (line.trim() === '') {
            blockEndIdx = i
            continue
          }
          if (!line.startsWith(expectedIndent)) break
          contentLines.push(line.substring(expectedIndent.length))
          blockEndIdx = i
        }

        if (contentLines.length === 0) {
          callback(null, file)
          return
        }

        // Build temporary Pug for compilation
        const tempPug = [
          ...includes,
          ...variables,
          '',
          'doctype xml',
          'root',
          '  entity',
          ...contentLines.map(line => '    ' + line)
        ].join('\n')

        // Compile to XML
        const fileDir = dirname(file.path)
        const compiledXml = pugCompiler.compile(tempPug, { filename: file.path, basedir: fileDir })(locals)

        // Parse XML to JSON
        const json = parser.parse(compiledXml)
        const entity = json.root.entity || json.root

        // Replace at- with @
        let jsonString = JSON.stringify(entity)
        jsonString = jsonString.replace(/"at-/g, '"@')

        // Build replacement - the block declaration followed by piped JSON
        const replacementLines = [
          `${blockIndent}${blockDeclaration}`,
          `${blockIndent}  | ${jsonString}`
        ]

        // Replace the block in the original content
        const newLines = [
          ...lines.slice(0, blockStartIdx),
          ...replacementLines,
          ...lines.slice(blockEndIdx + 1)
        ]

        file.contents = Buffer.from(newLines.join('\n'))
        callback(null, file)
      } catch (err) {
        callback(err)
      }
    }
  })
}

// Compile Pug to HTML
export function compilePug() {
  return src(paths.pug.src)
    .pipe(preprocessJsonBlocks())
    .pipe(gulpPug({
      locals: locals,
      pretty: true
    }))
    .pipe(urlBuilder())
    .pipe(dest(paths.pug.dest))
    .pipe(bs.reload({ stream: true }))
}

// Wrap file contents in a Sass mixin so transients can be @use'd
function wrapInMixin() {
  return new Transform({
    objectMode: true,
    transform(file, encoding, callback) {
      const content = file.contents.toString()
      const indented = content.split('\n').map(line => line ? '  ' + line : line).join('\n')
      file.contents = Buffer.from(`@mixin styles {\n${indented}\n}\n`)
      callback(null, file)
    }
  })
}

// Convert Sass shorthand to longhand
export function sassShorthand() {
  return src(paths.sass.partials)
    .pipe( sassExtendShorthand() )
    .pipe( wrapInMixin() )
    .pipe( rename(function(path) {
      path.basename = path.basename.replace('%','_')
    }) )
    .pipe( dest(paths.sass.transients) )
}

// Compile Sass to CSS
export function compileSass() {
  return src(paths.sass.src)
    .pipe(sass.sync().on('error', sass.logError))
    .pipe(postcss([ autoprefixer() ]))
    .pipe(dest(paths.sass.dest))
    .pipe(bs.stream())
    .pipe(postcss([ cssnano() ]))
    .pipe(rename({ suffix: '.min' }))
    .pipe(dest(paths.sass.dest))
}

// Bundle JavaScript with esbuild
export async function bundleJs() {
  await esbuild.build({
    entryPoints: ['src/js/index.js'],
    bundle: true,
    minify: true,
    sourcemap: true,
    outfile: 'docs/js/bundle.js',
    format: 'iife'
  })
  bs.reload()
}

// Copy images to docs
export function copyImages() {
  return src(paths.images.src)
    .pipe(dest(paths.images.dest))
}

// Start BrowserSync server
export function serve(cb) {
  bs.init({
    server: {
      baseDir: 'docs'
    },
    port: 3000,
    notify: false
  })
  cb()
}

// Watch files for changes
function watchFiles(cb) {
  watch(['src/pug/**/*.pug'], series(compilePug))
  watch(paths.sass.watch, series(sassShorthand, compileSass))
  watch(['src/js/**/*.js'], series(bundleJs))
  watch([paths.images.src], series(copyImages))
  cb()
}

// Default build task
export const build = parallel(
  compilePug,
  series(sassShorthand, compileSass),
  bundleJs,
  copyImages
)

// Development task with server and watch
export const dev = series(build, serve, watchFiles)

// Default task
export { build as default }
