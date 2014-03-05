//var async = require('async');
var fs = require('fs');
var crypto = require('crypto');
var path = require('path');
var lru = require('lru-cache');
var mime = require('mime');

function hashify(path, hash) {
    if(path.indexOf('.') != -1) {
        return path.replace('.', '-' + hash + '.');
    }
}

function dehashify(path) {
    return path.replace(/-[0-9a-f]+\./, '.');
}

var cache = lru({
    length: function(item) { return item.content.length; }
});

exports.static = function(directory) {
    directory = directory || 'public';

    /*(function readdir(directory, callback) {
        fs.readdir(directory, function(err, paths) {
            async.each(paths, function(file, callback) {
                var pathname = path.join(directory, file);

                fs.stat(pathname, function(err, stats) {
                    if(err) {
                        return callback(err);
                    }

                    if(stats.isDirectory()) {
                        readdir(pathname);
                        return callback();
                    }

                    fs.readFile(pathname, function(err, data) {
                        if(err) {
                            return callback(err);
                        }

                        var md5 = crypto.createHash('md5').update(data).digest('hex');

                        callback(null, { data: data, path: pathname, md5: md5 });
                    });
                });
            }, function(err, results) {
                if(callback) {
                    callback(err, results);
                }
            });
        });
    })(directory, function(err, results) {
        console.log(results);
    }); */

    return function(req, res, next) {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            return next();
        }

        //Dehashify asset filename
        var assetPath = dehashify(req.path);

        //Do we have this asset in our memory cache?
        var asset = cache.get(assetPath);
        if (asset) {
            console.log('From cache');
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
                        console.log('Bypass');
                        next(); //Not our problem
                    }
                    else if(err.errno == 3) { //EACCES
                        res.status(403);
                    }
                    else {
                        res.status(500); //I don't know what happened here but it's not good
                    }
                } else { //All clear
                    console.log('From file');
                    var md5 = crypto.createHash('md5').update(data).digest('hex');
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
