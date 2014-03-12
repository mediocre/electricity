var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

var mime = require('mime');

exports.static = function static(directory, options) {
    directory = path.resolve(directory || 'public');

    if (options) {
        if (options.hostname) {
            if (typeof options.hostname !== 'string') {
                throw Error("Hostname must be a string");
            }
            else if (options.hostname.slice(-1) === '/') {
                options.hostname = options.hostname.slice(0, options.hostname.length - 1);
            }
        }
    }

    var files = {};

    function dehashifyPath(filePath) {
        var hashRegex = /-[0-9a-f]+\./;
        var hashMatch = filePath.match(hashRegex);

        return {
            path: filePath.replace(hashRegex, '.'),
            hash: hashMatch ? hashMatch[0].slice(1, hashMatch[0].length - 1): null
        };
    }

    function hashifyPath(filePath, hash) {
        if (filePath.indexOf('.') != -1) {
            return filePath.replace('.', '-' + hash + '.');
        }
    }

    function prefixSlash(path) {
        return path[0] === '/' ? path : '/' + path;
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

            var data = fs.readFileSync(filePath);

            // Ensure the path we use is relative to the public dir
            var relativePath = path.relative(directory, path.resolve(filePath));

            // Make URI-friendly and prepend a / since that's the format used by express
            relativePath = prefixSlash(relativePath).replace(/\\/g, '/');

            // TODO: Store Gzip version
            files[relativePath] = {
                content: data,
                contentLength: typeof data === 'string' ? Buffer.byteLength(data) : data.length,
                contentType: mime.lookup(relativePath),
                hash: crypto.createHash('md5').update(data).digest('hex'),
                modified: stat.mtime
            };
        });
    })(directory);

    return function staticMiddleware(req, res, next) {
        // Register helpers if we haven't already
        // Doing this at this stage because we can't access the express app from the initialization
        // without passing it in as a parameter, which would be poor API design.
        if (!req.app.locals.electricity) {
            req.app.locals.electricity = {
                url: function urlHelper(filePath) {
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
            };
        }

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            return next();
        }

        var reqInfo = dehashifyPath(req.path);
        var file = files[reqInfo.path];

        // Maybe the files cache should be more like, { '/styles/main.css': [{ version1 }, { version2 }, { version3 }...] }
        if (file) {
            // Verify file matches the requested hash, otherwise 302
            if (reqInfo.hash !== file.hash) {
                res.redirect(hashifyPath(reqInfo.path, file.hash));
                res.end();
            }
            else {
                res.set({
                    'Cache-Control': 'public, max-age=31536000', // One year
                    'Content-Length': file.contentLength,
                    'Content-Type': file.contentType,
                    'ETag': file.hash,
                    'Last-Modified': file.modified.toUTCString()
                });

                if (req.get('If-None-Match') === file.hash){
                    res.status(304);
                    res.end();
                }
                else {
                    res.status(200);

                    if (req.method === 'HEAD') {
                        res.end();
                    }
                    else {
                        res.send(file.content);
                    }
                }
            }
        } else {
            next();
        }
    };
};
