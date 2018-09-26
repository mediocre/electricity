const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const chokidar = require('chokidar');
const mime = require('mime');
const Negotiator = require('negotiator');
const react = require('react-tools');
const sass = require('sass');
const sassGraph = require('sass-graph');
const Snockets = require('snockets');
const UglifyJS = require('uglify-es');
const UglifyCss = require('uglifycss');

const availableEncodings = ['gzip', 'identity'];
const gzipContentTypes = require('./gzipContentTypes.js');

exports.static = function static(directory, options) {
    directory = path.resolve(directory || 'public');

    if (!options) {
        options = {};
    }

    if (!('hashify' in options)) {
        options.hashify = true;
    }

    if (!options.sass) {
        options.sass = {};
    }

    if (!options.snockets) {
        options.snockets = {};
    }

    if (!options.jsx) {
        options.jsx = {};
    }

    options.snockets.async = false;

    if (!options.uglifycss) {
        options.uglifycss = {
            enabled: true
        };
    }

    if (!options.uglifyjs) {
        options.uglifyjs = {
            enabled: true
        };
    }

    if (!options.watch) {
        options.watch = {
            enabled: true
        };
    }

    if (options.hostname) {
        if (typeof options.hostname !== 'string') {
            throw Error('hostname must be a string');
        } else if (options.hostname.slice(-1) === '/') {
            options.hostname = options.hostname.slice(0, options.hostname.length - 1);
        }
    }

    if (options.sass.imagePath) {
        if (typeof options.sass.imagePath !== 'string') {
            throw Error('sass.imagePath must be a string');
        }
    }

    if (!options.sass.functions) {
        options.sass.functions = {};
    }

    options.sass.functions['image-url($img)'] = function(img) {
        return new sass.types.String('url("' +
            (options.sass.imagePath ?
                path.join('/', options.sass.imagePath, img.getValue()) :
                path.join('/', img.getValue())
            ) +
            '")');
    };

    var files = {};
    var snockets = new Snockets();
    var stylesheets = [];
    var watcher;

    function cacheFile(filePath, stat) {
        var data;
        var ext = path.extname(filePath);
        var relativeUrl = toRelativeUrl(filePath);

        // Compilation steps
        if (ext === '.scss' && !shouldIgnore(relativeUrl, options.sass.ignore)) {
            // Sass
            options.sass.file = filePath;
            data = sass.renderSync(options.sass).css.toString();

            // Future steps should treat this as plain CSS
            relativeUrl = relativeUrl.replace(/.scss$/, '.css');
            ext = '.css';
        } else if (ext === '.js' && !shouldIgnore(relativeUrl, options.snockets.ignore)) {
            // Snockets
            try {
                data = snockets.getConcatenation(filePath, options.snockets);
            } catch (e) {
                // Snockets can't parse, so just pass the js file along
                console.warn(`Snockets skipping ${filePath}:\n    ${e}`);
                data = fs.readFileSync(filePath).toString();
            }
        }

        if (ext === '.js' && !shouldIgnore(relativeUrl, options.jsx.ignore)) {
            // React
            data = data || fs.readFileSync(filePath).toString();

            try {
                data = react.transform(data, options.jsx);
            } catch (e) {
                // React can't transform, so just pass the js file along
                console.warn(`JSX compiler skipping ${filePath}:\n    ${e}`);
                data = fs.readFileSync(filePath).toString();
            }
        }

        // Postprocessing steps
        if (ext === '.css') {
            if (options.uglifycss.enabled) {
                // Uglifycss
                data = data ? UglifyCss.processString(data, options.uglifycss) : UglifyCss.processFiles([filePath], options.uglifycss);
            }
        } else if (ext === '.js' && options.uglifyjs.enabled && !shouldIgnore(relativeUrl, options.uglifyjs.ignore)) {
            var uglifyjsOptions = JSON.parse(JSON.stringify(options.uglifyjs));
            delete uglifyjsOptions.enabled;
            delete uglifyjsOptions.ignore;

            if (uglifyjsOptions.sourceMap === true) {
                uglifyjsOptions.sourceMap.filename = path.basename(relativeUrl);
                uglifyjsOptions.sourceMap.out = `${uglifyjsOptions.sourceMap.filename}.map`;
            }

            var result = UglifyJS.minify(data, uglifyjsOptions);

            if (result.error) {
                console.warn(`UglifyJS skipping ${filePath}:\n    ${JSON.stringify(result.error)}`);
            } else {
                data = result.code;
            }
        }

        // Have data?
        data = data || fs.readFileSync(filePath);

        // Cache file and hash, generate hash later if it's CSS because we're going to modify the contents
        files[relativeUrl] = {
            content: data,
            contentLength: typeof data === 'string' ? Buffer.byteLength(data) : data.length,
            contentType: mime.getType(relativeUrl),
            hash: ext !== '.css' ? crypto.createHash('md5').update(data).digest('hex') : '',
            modified: stat.mtime
        };

        // If-Modified-Since doesn't support millisecond precision
        files[relativeUrl].modified.setMilliseconds(0);

        if (ext === '.css') {
            stylesheets.push(relativeUrl);
        }

        return relativeUrl;
    }

    function dehashifyPath(filePath) {
        if (!options.hashify) {
            return {
                path: filePath,
                hash: undefined
            };
        }

        var hashRegex = /-[0-9a-f]+(\.[^.]*$)/;
        var hashMatch = filePath.match(hashRegex);
        var hash = hashMatch ? hashMatch[0].slice(1).replace(/\.([^.]*$)/, '') : '';

        return {
            path: hash.length == 32 ? filePath.replace(hashRegex, '$1') : filePath,
            hash: hash.length == 32 ? hash : null
        };
    }

    function gzip(file, callback) {
        if (file.gzippedContent && file.gzippedContentLength) {
            return callback(null, file);
        }

        zlib.gzip(file.content, function(err, gzippedContent) {
            if (err) {
                return callback(err);
            }

            file.gzippedContent = gzippedContent;
            file.gzippedContentLength = gzippedContent.length;

            callback(null, file);
        });
    }

    function hashifyCss(cssPath) {
        return files[cssPath].content.toString().replace(/url\(['"]?(.*?)['"]?\)/g, function(match, filename) {
            var file;

            if (filename[0] === '/') {
                file = files[filename];
            } else {
                var cssDir = path.dirname(cssPath);
                filename = path.normalize(path.join(cssDir, filename)).replace(/\\/g, '/');
                file = files[filename];
            }

            if (file) {
                return 'url(' + urlBuilder(filename) + ')';
            }

            return match;
        });
    }

    function hashifyPath(filePath, hash) {
        if (!filePath.includes('.')) {
            return filePath.replace(/([?#].*)?$/, `-${hash}$1`);
        }

        return filePath.replace(/\.([^.]*)([?#].*)?$/, `-${hash}.$1$2`);
    }

    function prefixSlash(path) {
        return path[0] === '/' ? path : '/' + path;
    }

    function reloadFile(filePath, stat) {
        stat = typeof stat === 'object' ? stat : fs.statSync(filePath);

        var ext = path.extname(filePath);

        if (ext === '.scss') {
            sassGraph.parseDir(directory).index[filePath].importedBy.forEach(reloadFile);
        } else if (ext === '.js') {
            // Clear snockets cache
            snockets.cache = {};
            snockets.concatCache = {};

            snockets.scan(filePath);
            snockets.depGraph.parentsOf(filePath).forEach(reloadFile);
        }

        var relativeUrl = cacheFile(filePath, stat);

        if (stylesheets.includes(relativeUrl)) {
            files[relativeUrl].content = hashifyCss(relativeUrl);
            files[relativeUrl].hash = crypto.createHash('md5').update(files[relativeUrl].content).digest('hex');
        }
    }

    function toRelativeUrl(filePath) {
        var relativeUrl = path.relative(directory, path.resolve(filePath));

        // Make URI-friendly and prepend a /
        return prefixSlash(relativeUrl).replace(/\\/g, '/');
    }

    function shouldIgnore(filePath, ignore) {
        if (!ignore) {
            // Not ignoring anything
            return false;
        }

        if (Array.isArray(ignore)) {
            // Multiple things to ignore
            return ignore.some(function ignoreElementMatch(ignored) {
                return shouldIgnore(filePath, ignored);
            });
        }

        return filePath.match(ignore) !== null;
    }

    function stripQueryAndTarget(filePath) {
        return filePath.replace(/[?#].*$/, '');
    }

    function urlBuilder(filePath) {
        var file = files[stripQueryAndTarget(prefixSlash(filePath))];

        if (file) {
            var uri = prefixSlash(filePath);

            if (options.hashify) {
                uri = hashifyPath(uri, file.hash);
            }

            if (options && options.hostname) {
                uri = '//' + options.hostname + uri;
            }

            return uri;
        } else {
            return filePath;
        }
    }

    // Load all files synchronously
    (function loadFiles(workingDir) {
        var contents = fs.readdirSync(workingDir);

        contents.forEach(function loadDirectory(file) {
            var filePath = path.join(workingDir, file);
            var stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                return loadFiles(filePath);
            }

            cacheFile(filePath, stat);
        });
    })(directory);

    // Hashify URLs in stylesheets
    stylesheets.forEach(function(stylesheet) {
        files[stylesheet].content = hashifyCss(stylesheet);
        files[stylesheet].hash = crypto.createHash('md5').update(files[stylesheet].content).digest('hex');
    });

    // Watch for changes
    if (options.watch.enabled) {
        const jsDirectories = Array.from(new Set(Object.keys(snockets.depGraph.map).map(d => path.dirname(d))));
        const sassDirectories = Array.from(new Set(Object.keys(sassGraph.parseDir(directory).index).map(d => path.dirname(d))));

        watcher = chokidar.watch([directory, ...jsDirectories, ...sassDirectories], {
            ignoreInitial: true
        });

        watcher.on('add', reloadFile);

        watcher.on('change', reloadFile);

        watcher.on('unlink', function(path) {
            var compiledPath = path.replace(/\.scss$/, '.css');
            delete files[toRelativeUrl(compiledPath)];
        });
    }

    return function staticMiddleware(req, res, next) {
        // Ignore anything that's not a GET or HEAD request
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            return next();
        }

        // Register view helper if we haven't already
        if (!req.app.locals.electricity) {
            req.app.locals.electricity = {
                url: urlBuilder
            };
        }

        var reqInfo = dehashifyPath(req.path);
        var file = files[reqInfo.path];

        if (!file) {
            return next();
        }

        // Verify file matches the requested hash, otherwise 302
        if (options.hashify && reqInfo.hash !== file.hash) {
            res.set({
                'Cache-Control': 'no-cache',
                'Expires': '0',
                'Pragma': 'no-cache'
            });

            return res.redirect(hashifyPath(reqInfo.path, file.hash));
        }

        var expires = new Date();
        expires.setYear(expires.getFullYear() + 1);

        res.set({
            'Cache-Control': 'public, max-age=31536000',
            'Content-Type': file.contentType,
            'ETag': file.hash,
            'Expires': expires.toUTCString(),
            'Last-Modified': file.modified.toUTCString()
        });

        if (options.headers) {
            res.set(options.headers);
        }

        if (req.get('If-None-Match') === file.hash) {
            res.status(304);
            res.end();
        } else if (new Date(req.get('If-Modified-Since')) >= file.modified) {
            res.status(304);
            res.end();
        } else {
            res.set({ 'Content-Length': file.contentLength });
            res.status(200);

            if (req.method === 'HEAD') {
                return res.end();
            }

            var negotiator = new Negotiator(req);

            if (negotiator.encodings(availableEncodings).indexOf('gzip') === 0 && gzipContentTypes.indexOf(file.contentType) !== -1) {
                gzip(file, function(err, gzippedFile) {
                    if (err) {
                        return next(err);
                    }

                    res.set({
                        'Content-Encoding': 'gzip',
                        'Content-Length': gzippedFile.gzippedContentLength
                    });

                    res.send(file.gzippedContent);
                });
            } else {
                res.send(file.content);
            }
        }
    };
};
