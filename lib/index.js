var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

var mime = require('mime');

var gzipContentTypes = require('./gzipContentTypes.js');
var watch = require('watch');

exports.static = function static(directory, options) {
    directory = path.resolve(directory || 'public');

    if (options) {
        if (options.hostname) {
            if (typeof options.hostname !== 'string') {
                throw Error('Hostname must be a string');
            } else if (options.hostname.slice(-1) === '/') {
                options.hostname = options.hostname.slice(0, options.hostname.length - 1);
            }
        }
    }

    var files = {};

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

    function cacheFile(filePath, stat) {
        var data = fs.readFileSync(filePath);

        // Ensure the path we use is relative to the public dir
        var relativePath = path.relative(directory, path.resolve(filePath));

        // Make URI-friendly and prepend a / since that's the format used by express
        relativePath = prefixSlash(relativePath).replace(/\\/g, '/');

        files[relativePath] = {
            content: data,
            contentLength: typeof data === 'string' ? Buffer.byteLength(data) : data.length,
            contentType: mime.lookup(relativePath),
            hash: crypto.createHash('md5').update(data).digest('hex'),
            modified: stat.mtime
        };
    }

    // Load all files synchronously
    (function loadFiles(workingDir) {
        var contents;

        try {
            contents = fs.readdirSync(workingDir);
        }
        catch (e) {
            switch (e.code) {
                case 'ENOENT':
                    console.error('Directory does not exist');
                break;

                case 'ENOTDIR':
                    console.error('Not a directory');
                break;

                case 'EACCES':
                    console.error('Insufficient permissions to access directory');
                break;
            }

            throw e;
        }

        contents.forEach(function loadDirectory(file) {
            var filePath = path.join(workingDir, file);
            var stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                return loadFiles(filePath);
            }

            cacheFile(filePath, stat);

        });
    })(directory);

    //Setup file watch on asset directory
    watch.createMonitor(directory, function monitorFiles(monitor) {
        monitor.on('created', cacheFile);
        monitor.on('changed', cacheFile);
        monitor.on('removed', function fileRemoved(f, stat) {
            var relativePath = path.relative(directory, path.resolve(f));
            relativePath = prefixSlash(relativePath).replace(/\\/g, '/');
            files[relativePath] = null;
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

            if(req.method === 'HEAD') {
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
            }
            else {
                res.send(file.content);
            }
        }
    };
};
