//var async = require('async');
var fs = require('fs');
var crypto = require('crypto');
var path = require('path');
var lru = require('lru-cache');
var mime = require('mime');

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

exports.static = function(directory) {

    //Need an absolute path to the working directory, not one relative to this file
    directory = path.resolve(directory || 'public');

    var cache = lru({
        length: function(item) { return item.content.length; }
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
            switch (e.errno) {
                case 34:
                    console.error("Directory does not exist");
                break;
                case 27:
                    console.error("Not a directory");
                break;
                case 3:
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
                'Content-Length': asset.content.length,
                'ETag': asset.hash
            });
            res.send(asset.content);
        }
        //Nope, read/cache/send
        else {
            fs.readFile(path.join(directory, assetPath), function(err, data) {
                if (err) {
                    if(err.errno == 34 || err.errno == 28) { //Not an asset (NOENT or ISDIR)
                        next(); //Not our problem
                    }
                    else if(err.errno == 3) { //EACCES
                        res.status(403);
                    }
                    else {
                        res.status(500); //I don't know what happened here but it's not good
                    }
                } else { //All clear
                    var md5 = hash(data);
                    var type = mime.lookup(assetPath);
                    //Cache the result
                    //TODO: Gzip at some point before this if client accepts it
                    //We may need to maintain separate caches for gzipped and ungzipped content
                    //Or have two content properties
                    cache.set(assetPath, {
                        mime: type,
                        hash: md5,
                        content: data
                    });
                    res.set({
                        'Content-Type': type,
                        'Content-Length': data.length,
                        'ETag': md5
                    });
                    res.send(data);
                }
            });
        }

    };
};
// var electricity = require('electricity');
// app.use(express.static('public'), { maxAge: 31556952000 });
// app.use(electricity.static('public'));
// in views: <%= electricity.url('/public/styles/normalize.css') %>
