var async = require('async');
var fs = require('fs');
var path = require('path');

exports.static = function(directory) {
    directory = directory || 'public';

    (function readdir(directory, callback) {
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
    });

    return function(req, res, next) {
        if(req.method !== 'GET' && req.method !== 'HEAD') {
            return next();
        }
    }
};

// var electricity = require('electricity');
// app.use(express.static('public'), { maxAge: 31556952000 });
// app.use(electricity.static('public'));
// in views: <%= electricity.url('/public/styles/normalize.css') %>