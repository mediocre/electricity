//var async = require('async');
var fs = require('fs');
var crypto = require('crypto');
var path = require('path');
var lru = require('lru-cache');
var mime = require('mime');
var zlib = require('zlib');

function hash(data) {
    return crypto.createHash('md5').update(data).digest('hex');
}

function hashifyPath(assetPath, hash) {
    if(assetPath.indexOf('.') != -1) {
        return assetPath.replace('.', '-' + hash + '.');
    }
}

function dehashifyPath(assetPath) {
    return assetPath.replace(/-[0-9a-f]+\./, '.');
}

function assetLength(asset) {
    if(typeof asset == 'string') {
        return Buffer.byteLength(asset);
    }
    //Otherwise Buffer
    return asset.length;
}

exports.static = function(directory) {

    function prepAndSendAsset(asset, req, res) {
        var encodings = req.get('Accept-encoding').split(/,\s?/);
        if (encodings.indexOf('gzip') != -1) {
            res.set("Content-encoding", "gzip");
            zlib.gzip(asset, sendAssetForReqAndRes(req, res));
        }
        else {
            sendAssetForReqAndRes(req, res)(null, asset);
        }
    }

    function sendAssetForReqAndRes(req, res) {
        return function assetCallback(err, asset) {
            if(err) {
                throw err; //TODO: find out what errors zlib might throw at us
            }
            res.set('Content-length', assetLength(asset));
            res.send(asset);
        };
    }

    //Need an absolute path to the working directory, not one relative to this file
    directory = path.resolve(directory || 'public');

    var cache = lru({
        length: assetLength
    });

    function cacheAsset(assetPath, asset) {
        //Ensure the path we use is relative to the public dir
        var relPath = path.relative(directory, path.resolve(assetPath));

        //Prepend a / since that's the format used by express
        relPath = path.join('/', relPath);

        //Metadata
        var type = mime.lookup(assetPath);
        var md5 = hash(asset);
        //TODO: Gzip at some point before this if client accepts it
        //We may need to maintain separate caches for gzipped and ungzipped content
        //Or have two content properties
        cache.set(relPath, {
            mime: type,
            hash: md5,
            content: asset
        });
    }

    //Need to load all files and handle synchronously; EJS helper will not work until asset cache is primed
    (function loadAssets(directory) {
        var contents;
        try {
            contents = fs.readdirSync(directory);
        }
        catch (e) {
            switch (e.code) {
                case "ENOENT":
                    console.error("Directory does not exist");
                break;
                case "ENOTDIR":
                    console.error("Not a directory");
                break;
                case "EACCES":
                    console.error("Insufficient permissions to access directory");
                break;
            }
            throw e; //Fatal
        }
        contents.forEach(function eachEntry(entry) {
            //readdir does not provide path
            var assetPath = path.join(directory, entry);
            var stat = fs.statSync(assetPath);
            if (stat.isDirectory()) {
                return loadAssets(assetPath);
            }
            var data = fs.readFileSync(assetPath);
            cacheAsset(assetPath, data);
        });
    })(directory);


    return function(req, res, next) {
        //Register helpers if we haven't already
        //Doing this at this stage because we can't access the express app from the initialization
        //without passing it in as a parameter, which would be poor API design.
        if (!req.app.locals.electricity) {
            req.app.locals.electricity = {
                url: function electricityUrl(assetPath) {
                    var asset = cache.get(path.join('/' + assetPath));
                    if (asset) {
                        return hashifyPath(assetPath, asset.hash);
                    } else {
                        return assetPath; //We don't have it, send back as entered
                    }
                }
            };
        }

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            return next();
        }

        //DehashifyPath asset filename
        var assetPath = dehashifyPath(req.path);

        //Do we have this asset in our memory cache?
        var asset = cache.get(assetPath);
        if (asset) {
            res.set({
                'Content-Type': asset.mime,
                'ETag': asset.hash
            });

            prepAndSendAsset(asset.content, req, res);
        }
        //Nope, read/cache/send
        else {
            fs.readFile(path.join(directory, assetPath), function(err, data) {
                if (err) {
                    if(err.code == "ENOENT" || err.code == "EISDIR") { //Not an asset (NOENT or ISDIR)
                        next(); //Not our problem
                    }
                    else if(err.code == "EACCES") { //EACCES
                        res.status(403);
                    } else {
                        console.log(err);
                        res.status(500); //I don't know what happened here but it's not good
                    }
                } else { //All clear
                    cacheAsset(assetPath, data);
                    res.set({
                        'Content-Type': type,
                        'ETag': md5
                    });
                    prepAndSendAsset(data, req, res);
                }
            });
        }

    };
};
// var electricity = require('electricity');
// app.use(express.static('public'), { maxAge: 31556952000 });
// app.use(electricity.static('public'));
// in views: <%= electricity.url('/public/styles/normalize.css') %>
