const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

//const babel = require('@babel/core');
const chokidar = require('chokidar');
const mime = require('mime');
const Negotiator = require('negotiator');
//const sass = require('sass');
//const sassGraph = require('sass-graph');
const Snockets = require('snockets');
//const UglifyJS = require('uglify-js');
//const UglifyCss = require('uglifycss');

const gzipContentTypes = require('./gzipContentTypes.js');

exports.static = function(directory, options) {
    // Default to 'public' if the directory is not specified
    directory = directory || 'public';

    // Options are optional
    if (!options) {
        options = {};
    }

    // Hashify by default
    if (!Object.prototype.hasOwnProperty.call(options, 'hashify')) {
        options.hashify = true;
    }

    if (!options.snockets) {
        options.snockets = {};
    }

    // Snockets must be processed syncronously to produce consistent output
    options.snockets.async = false;

    if (!options.watch) {
        options.watch = {
            enabled: false
        };
    }

    // Create a local cache to hold the files
    const files = {};

    const snockets = new Snockets();

    let watcher;

    if (options.watch.enabled) {
        // Setup the watcher
        watcher = chokidar.watch(directory, { ignoreInitial: true });

        watcher.on('change', function(filePath) {
            // Remove the changed file from the local cache
            delete files[toUrlPath(filePath)];
        });
    }

    /**
     * Tries to read a file from local cache.
     * Reads the file from disk if it's not present in the local cache.
     * @param {string} url
     */
    function fetchFile(url) {
        // Try to get the file from local cache
        let file = files[url];

        // Return the file from cache if found
        if (file) {
            return file;
        }

        // Read the file from disk
        file = readFile(url);

        // Put the file in local cache
        files[url] = file;

        return file;
    }

    /**
     * Converts a URL (/robots.txt) to a URL that includes the file's hash (/robots-3f54004ef6fc21b24a9e6069fc114fd9070b77a1.txt)
     * @param {string} url
     * @param {string} hash
     */
    function hashifyUrl(url, hash) {
        if (!url.includes('.')) {
            return url.replace(/([?#].*)?$/, `-${hash}$1`);
        }

        return url.replace(/\.([^.]*)([?#].*)?$/, `-${hash}.$1$2`);
    }

    /**
     * Parses a URL path potentially containing a hash (/robots-3f54004ef6fc21b24a9e6069fc114fd9070b77a1.txt)
     * into an object with a hash and path properties ({ hash: '3f54004ef6fc21b24a9e6069fc114fd9070b77a1', path: '/robots.txt' })
     * @param {object} req
     */
    function parseUrlPath(urlPath) {
        // https://regex101.com/r/xHYySX/1
        const regex = /\/.+(-([0-9a-f]{40}))/;
        const matches = urlPath.match(regex);

        if (!matches) {
            return {
                path: urlPath
            };
        }

        return {
            hash: matches[2],
            path: urlPath.replace(matches[1], '')
        };
    }

    function readFile(url) {
        let filePath = toFilePath(url);
        let extension = path.extname(filePath);
        let data;

        if (extension === '.js') {
            data = readJavaScriptFile(filePath);
        } else {
            data = fs.readFileSync(filePath);
        }

        const file = {
            content: data,
            contentLength: data.length,
            contentType: mime.getType(url),
            hash: crypto.createHash('sha1').update(data).digest('hex')
        };

        // Don't gzip any content less that 1500 bytes (the size of a TCP packet). Only gzip specific content types.
        if (file.contentLength > 1500 && gzipContentTypes.includes(file.contentType)) {
            const gzipContent = zlib.gzipSync(file.content);

            file.gzip = {
                content: gzipContent,
                contentLength: gzipContent.length
            };
        }

        return file;
    }

    function readJavaScriptFile(filePath) {
        let data;

        // Snockets
        try {
            data = snockets.getConcatenation(filePath, options.snockets);
        } catch(err) {
            // Snockets can't parse, so just pass the js file along
            console.warn(`Snockets skipping ${filePath}:\n    ${err}`);
            data = fs.readFileSync(filePath).toString();
        }

        return data;
    }

    function urlBuilder(urlPath) {
        // If hashify is disabled simply return the original URL path
        if (!options.hashify) {
            return urlPath;
        }

        try {
            const request = parseUrlPath(urlPath);
            const file = fetchFile(request.path);

            return hashifyUrl(request.path, file.hash);
        } catch(err) {
            // If we don't have a file that matches the specified URL path simply return the original URL path
            return urlPath;
        }
    }

    /**
     * Converts a URL path (/robots.txt) to a file path (/Users/username/site/public/robots.txt).
     * @param {string} urlPath
     */
    function toFilePath(urlPath) {
        const myURL = new URL(urlPath, 'https://example.org/');
        const pathname = myURL.pathname.replace(/^\//, '');
        return path.resolve(directory, pathname);
    }

    /**
     * Converts a file path (/Users/username/site/public/robots.txt) to a URL path (/robots.txt).
     * @param {string} urlPath
     */
    function toUrlPath(filePath) {
        const urlPath = path.posix.relative(directory, path.resolve(filePath));

        return `/${urlPath}`;
    }

    return function staticMiddleware(req, res, next) {
        // Ignore anything that's not a GET or HEAD request
        if (!['GET', 'HEAD'].includes(req.method)) {
            return next();
        }

        // Register function in app.locals to help views build URLs: https://expressjs.com/en/api.html#app.locals
        if (req.app && !req.app.locals.electricity) {
            req.app.locals.electricity = {
                url: urlBuilder
            };
        }

        let file;
        const request = parseUrlPath(req.path);

        try {
            file = fetchFile(request.path);
        } catch(err) {
            // Handle EISDIR (Is a directory): https://nodejs.org/api/errors.html#common-system-errors
            if (err.code === 'EISDIR') {
                return next();
            }

            // Handle ENOENT (No such file or directory): https://nodejs.org/api/errors.html#common-system-errors
            if (err.code === 'ENOENT') {
                return next();
            }

            return next(err);
        }

        // Verify file matches the requested hash, otherwise 302
        if (options.hashify && request.hash !== file.hash) {
            res.set({
                'cache-control': 'no-cache',
                'expires': '0',
                'pragma': 'no-cache'
            });

            const url = hashifyUrl(request.path, file.hash);

            return res.redirect(url);
        }

        // Set a far-future expiration date
        const expires = new Date();
        expires.setFullYear(expires.getFullYear() + 1);

        res.set({
            'cache-control': 'public, max-age=31536000',
            'content-Type': file.contentType,
            etag: file.hash,
            expires: expires.toUTCString()
        });

        // Set any other headers specified in options
        if (options.headers) {
            res.set(options.headers);
        }

        const ifNoneMatch = req.get('if-none-match');

        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-None-Match
        if (ifNoneMatch && ifNoneMatch.includes(file.hash)) {
            return res.sendStatus(304);
        }

        // By default, send the file's content (without gzip)
        let content = file.content;
        let contentLength = file.contentLength;

        // Check to see if the file could be gzipped
        if (file.gzip && file.gzip.content) {
            const negotiator = new Negotiator(req);

            // Ensure the request supports gzip
            if (negotiator.encodings().includes('gzip')) {
                content = file.gzip.content;
                contentLength = file.gzip.contentLength;

                res.set('content-encoding', 'gzip');
            }
        }

        // Set the content-length header
        res.set('content-length', contentLength);

        // Return early without sending content for HEAD requests
        if (req.method === 'HEAD') {
            return res.sendStatus(200);
        }

        res.send(content);
    };
};