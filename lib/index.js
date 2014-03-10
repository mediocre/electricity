var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

var mime = require('mime');

exports.static = function static(directory) {
    directory = path.resolve(directory || 'public');

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

    function uriPath(path) {
        return prefixSlash(path).replace(/\\/g, '/');
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
            relativePath = uriPath(relativePath);

            // TODO: Store Gzip version
            files[relativePath] = {
                content: data,
                contentLength: typeof data === 'string' ? Buffer.byteLength(data) : data.length,
                contentType: mime.lookup(relativePath),
                hash: crypto.createHash('md5').update(data).digest('hex')
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
                        return hashifyPath(filePath, file.hash);
                    } else {
                        return filePath;
                    }
                }
            };
        }

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            return next();
        }

        var fileInfo = dehashifyPath(req.path);
        var file = files[fileInfo.path];

        // Maybe the files cache should be more like, { '/styles/main.css': [{ version1 }, { version2 }, { version3 }...] }
        if (file) {
            // Verify file matches the specified hash, otherwise 302
            if (file.hash !== fileInfo.hash) {
                res.redirect(hashifyPath(fileInfo.path, file.hash));
                res.end();
            }
            else {
                res.status(200);

                res.set({
                    'Content-Length': file.contentLength,
                    'Content-Type': file.contentType,
                    'ETag': file.hash
                });

                if (req.method === 'HEAD') {
                    res.end();
                }
                else {
                    res.send(file.content);
                }
            }
        } else {
            next();
        }
    };
};
