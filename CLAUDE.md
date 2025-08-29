# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Electricity is an Express middleware for serving static files with built-in optimization features including minification, gzipping, Sass compilation, Snockets concatenation, and React JSX transformation. It follows best practices for web performance without requiring complex build processes.

## Development Commands

### Testing
```bash
# Run full test suite
npm test

# Run tests with coverage and send to Coveralls
npm run coveralls

# Run a specific test file
npx mocha test/index.js --exit -R spec

# Run tests matching a pattern
npx mocha test/index.js --grep "pattern" --exit -R spec
```

### Linting
```bash
# Run ESLint on all files
npx eslint .

# Fix auto-fixable issues
npx eslint . --fix

# Check specific file
npx eslint lib/index.js
```

## Architecture Overview

### Core Components

**Main Module (`lib/index.js`)**
- Exports `static()` middleware function that handles all file serving
- Implements file caching system with SHA1 hashing for cache busting
- Processes files through various transformers (Sass, Snockets, Babel, minifiers)
- Manages file watching for development mode
- Key functions:
  - `fetchFile()`: Retrieves files from cache or disk
  - `processFile()`: Applies transformations based on file type
  - `sendFile()`: Handles HTTP response with proper headers
  - `url()`: View helper for generating hashed URLs

**File Processing Pipeline**
1. Request comes in → middleware checks if it's a GET/HEAD request
2. URL is parsed, hash stripped if present
3. File is fetched from cache or loaded from disk
4. Transformations applied based on file type:
   - `.scss` → Sass compilation → CSS minification
   - `.js` with JSX → Babel transformation → UglifyJS
   - `.js` with Snockets → Dependency concatenation → minification
   - CSS files → URL rewriting for assets → minification
5. Content is gzipped if applicable
6. Response sent with appropriate headers (Cache-Control, ETag, etc.)

### Dependencies and Their Roles

- **@babel/core**: Transforms JSX files for React support
- **sass**: Compiles SCSS files to CSS
- **snockets**: JavaScript concatenation via require directives
- **uglify-js**: JavaScript minification
- **uglifycss**: CSS minification
- **chokidar**: File watching for development mode
- **sass-graph**: Tracks Sass dependencies for intelligent cache invalidation
- **mime**: Content-type detection
- **negotiator**: Content negotiation for gzip support

### Testing Structure

Tests in `test/index.js` cover:
- Basic middleware functionality
- File serving with proper headers
- Hash generation and URL rewriting
- Sass compilation and dependency tracking
- Snockets concatenation
- JSX transformation
- CSS/JS minification
- Gzip compression
- Error handling
- Watch mode functionality

Test fixtures are in `test/public/` with subdirectories for different asset types.

## Configuration Options

The middleware accepts these options:
- `babel`: Babel transformation options
- `hashify`: Enable/disable URL hashing (default: true)
- `headers`: Additional HTTP headers
- `hostname`: CDN hostname for URL generation
- `sass`: Node-sass compilation options
- `snockets`: Snockets concatenation options
- `uglifyjs`: UglifyJS minification options (enabled by default)
- `uglifycss`: UglifyCSS minification options (enabled by default)
- `watch.enabled`: Enable file watching for development

## ESLint Configuration

Located in `eslint.config.js`:
- Uses flat config format (ESLint 9+)
- ECMAScript 2020 with JSX support
- Node.js and Mocha globals
- Key rules: single quotes, semicolons required, no trailing spaces
- Ignores: `coverage/` and `test/public/`