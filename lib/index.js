var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

var mime = require('mime');
var sass = require('node-sass');
var sassGraph = require('../node_modules/sass-graph/sass-graph'); // For some reason this refuses to include normally
var Snockets = require('snockets');
var watch = require('watch');

var gzipContentTypes = require('./gzipContentTypes.js');

exports.static = function static(directory, options) {
    directory = path.resolve(directory || 'public');
    options = options || {};

    if (options.hostname) {
        if (typeof options.hostname !== 'string') {
            throw Error('Hostname must be a string');
        } else if (options.hostname.slice(-1) === '/') {
            options.hostname = options.hostname.slice(0, options.hostname.length - 1);
        }
    }

    if (options.sass) {
        if (options.sass.imagePath) {
            if (typeof options.sass.imagePath !== 'string') {
                throw Error('Sass imagePath must be a string');
            } else if (options.sass.imagePath.slice(-1) === '/') {
                options.sass.imagePath = options.sass.imagePath.slice(0, options.sass.imagePath.length - 1);
            }
        }
    } else {
        options.sass = {};
    }

    options.snockets = options.snockets || false;
    options.snockets.async = false;

    var snockets = new Snockets();

    var files = {};

    function cacheFile(filePath, stat) {
        //Make sure stat wasn't an extra index parameter
        stat = typeof stat === 'object' ? stat : fs.statSync(filePath);

        if (!stat.isDirectory()) {
            var data;
            var relativeUrl = toRelativeUrl(filePath);
            var type = mime.lookup(relativeUrl);

            // Sass compilation
            if (path.extname(relativeUrl) === '.scss' && !shouldIgnore(relativeUrl, options.sass.ignore)) {
                var sassOptions = options.sass || {};
                sassOptions.file = filePath;
                data = sass.renderSync(sassOptions);
                relativeUrl = relativeUrl.replace(/.scss$/, '.css');
            } else if ((type === 'application/javascript' || type === 'text/javascript') && !shouldIgnore(relativeUrl, options.snockets.ignore)) {
                try {
                    data = snockets.getConcatenation(filePath, options.snockets);
                }
                catch (e) { // Snockets can't parse, so just pass the js file along
                    console.warn("Snockets skipping " + filePath + ":\n" + e);
                    data = fs.readFileSync(filePath);
                }
            } else {
                data = fs.readFileSync(filePath);
            }

            files[relativeUrl] = {
                content: data,
                contentLength: typeof data === 'string' ? Buffer.byteLength(data) : data.length,
                contentType: type,
                hash: crypto.createHash('md5').update(data).digest('hex'),
                modified: stat.mtime
            };
        }
    }

    function dehashifyPath(filePath) {
        var hashRegex = /-[0-9a-f]+(\.[^\.]*$)/;
        var hashMatch = filePath.match(hashRegex);

        return {
            path: filePath.replace(hashRegex, '$1'),
            hash: hashMatch ? hashMatch[0].slice(1).replace(/\.([^\.]*$)/, '') : null
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

    function hashifyPath(filePath, hash) {
        if (filePath.indexOf('.') != -1) {
            return filePath.replace(/\.([^\.]*$)/, '-' + hash + '.$1');
        }

        return filePath + '-' + hash;
    }

    function prefixSlash(path) {
        return path[0] === '/' ? path : '/' + path;
    }

    function reloadFile(filePath, stat) {
        if (path.extname(filePath) === '.scss') {
            var sassDependencies = sassGraph.parseDir(directory);

            if (sassDependencies.index[filePath]) {
                sassDependencies.index[filePath].importedBy.forEach(reloadFile);
            }
        }

        cacheFile(filePath, stat);
    }

    function toRelativeUrl(filePath) {
        var relativeUrl = path.relative(directory, path.resolve(filePath));

        // Make URI-friendly and prepend a /
        return prefixSlash(relativeUrl).replace(/\\/g, '/');
    }

    function shouldIgnore(filePath, ignore) {
        if (!ignore) return false; // Not ignoring anything
        if (Array.isArray(ignore)) { // Multiple things to ignore
            return ignore.some(function ignoreElementMatch(ignored) {
                return shouldIgnore(filePath, ignored);
            });
        }
        return filePath.match(ignore) !== null;
    }

    function urlBuilder(filePath) {
        var file = files[prefixSlash(filePath)];

        if (file) {
            var uri = hashifyPath(prefixSlash(filePath), file.hash);

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

    // Watch directory for changes
    watch.createMonitor(directory, function monitorFiles(monitor) {
        monitor.on('changed', reloadFile);
        monitor.on('created', reloadFile);

        monitor.on('removed', function removeFile(f, stat) {
            delete files[toRelativeUrl(f)];
        });
    });

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
        if (reqInfo.hash !== file.hash) {
            return res.redirect(hashifyPath(reqInfo.path, file.hash));
        }

        var expires = new Date();
        expires.setYear(expires.getFullYear() + 1);

        res.set({
            'Cache-Control': 'public, max-age=31536000', // One year
            'Content-Type': file.contentType,
            'ETag': file.hash,
            'Expires': expires.toUTCString(),
            'Last-Modified': file.modified.toUTCString()
        });

        if (req.get('If-None-Match') === file.hash) {
            res.send(304);
        } else if (new Date(req.get('If-Modified-Since')) >= file.modified) {
            res.send(304);
        } else {
            res.set({
                'Content-Length': file.contentLength
            });

            res.status(200);

            if (req.method === 'HEAD') {
                return res.end();
            }

            var acceptEncoding = req.get('Accept-Encoding');

            if (acceptEncoding && acceptEncoding.split(/,\s?/).indexOf('gzip') !== -1 && gzipContentTypes.indexOf(file.contentType) !== -1) {
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
