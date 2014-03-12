var assert = require('assert');
var fs = require('fs');
var zlib = require('zlib');
var electricity = require('../lib/index');
var bufCompare = require('buffer-compare');
var req;
var res;
var next;
var midware;

function setupPassthrough() {
    //Have to set this to call done in each test for reference to work
    next = function() {
    };
    req = {
        path: '/',
        method: 'GET',
        app: {
            locals: {}
        },
        get: function() { return ''; }
    };
    res = {
        set: function() {},
        status: function(number) {
            if (number >= 400) {
                assert.fail(number, '400', 'Failing status code', '<');
            }
        },
        send: function() {
            assert.fail('called send', 'called next', 'Incorrect routing', ', instead');
        }
    };
}

describe('electricity.static', function() {
    before(function() {
        midware = electricity.static('test/public');
    });
    //Set up default mocks before each test, override as needed
    beforeEach(function() {
        setupPassthrough();
    });
    it('returns a function', function(done) {
        assert.equal(typeof midware, 'function');
        done();
    });
    it('should throw if the directory does not exist', function(done) {
        assert.throws(function() {
            electricity.static('test/nope');
        });
        done();
    });
    it('should throw if the directory is a file', function(done) {
        assert.throws(function() {
            electricity.static('package.json');
        });
        done();
    });
    it('should throw if permissions are insufficent');
    describe('with options', function() {
        it('throws an error if the hostname is not falsy or a string', function() {

            assert.throws(function() {
                electricity.static('test/public', { hostname: {} });
            });
            assert.throws(function() {
                electricity.static('test/public', { hostname: 35 });
            });
            assert.throws(function() {
                electricity.static('test/public', { hostname: function() {} });
            });
            assert.throws(function() {
                electricity.static('test/public', { hostname: [] });
            });

            //Should succeed
            electricity.static('test/public', { hostname: undefined });
        });
    });
    describe('The middleware', function() {
        it('calls next if the asset does not exist', function(done) {
            next = done;
            res.status = function(number) {
                if (number >= 400) {
                    assert.fail(number, '400', 'Failing status code', '<');
                }
            };
            midware(req, res, next);
        });
        it.skip('calls res.send with asset contents if the asset does exist', function(done) {
            req.path = '/robots.txt';
            res = {
                set: function(){},
                status: function(number) {
                    if (number >= 400) {
                        assert.fail(number, '400', 'Failing status code', '<');
                    }
                },
                send: function(asset) {
                    fs.readFile('test/public/robots.txt', function(err, data) {
                        assert.equal(bufCompare(data, asset), 0);
                        done();
                    });
                }
            };
            next = function() {
                assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
            };
            midware(req,res,next);
        });
        it('calls res.send with asset contents if the asset does exist and has its hash appended', function(done) {
            req.path = '/robots-ca121b5d03245bf82db00d14cee04e22.txt';
            res = {
                set: function(){},
                status: function(number) {
                    if (number >= 400) {
                        assert.fail(number, '400', 'Failing status code', '<');
                    }
                },
                send: function(asset) {
                    fs.readFile('test/public/robots.txt', function(err, data) {
                        assert.equal(bufCompare(data, asset), 0);
                        done();
                    });
                }
            };
            next = function() {
                assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
            };
            midware(req,res,next);
        });
        it('should only remove the hash from the path', function(done) {
            req.path = '/robots-abc1de.home-ca121b5d03245bf82db00d14cee04e22.txt';
            res = {
                set: function(){},
                status: function(number) {
                    if (number >= 400) {
                        assert.fail(number, '400', 'Failing status code', '<');
                    }
                },
                send: function(asset) {
                    fs.readFile('test/public/robots-abc1de.home.txt', function(err, data) {
                        assert.equal(bufCompare(data, asset), 0);
                        done();
                    });
                }
            };
            next = function() {
                assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
            };
            midware(req,res,next);
        });
        it('correctly serves files from subdirectories', function(done) {
            req.path = '/styles/normalize-dc691d63a0d03f7c0dba9f0eda398b5b.css';
            res = {
                set: function(){},
                status: function(number) {
                    if (number >= 400) {
                        assert.fail(number, '400', 'Failing status code', '<');
                    }
                },
                send: function(asset) {
                    fs.readFile('test/public/styles/normalize.css', function(err, data) {
                        assert.equal(bufCompare(data, asset), 0);
                        done();
                    });
                }
            };
            next = function() {
                assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
            };
            midware(req,res,next);
        });
        it('sends a 302 redirect if the hash does not match the current file', function(done) {
            var redirected = false;
            req.path = '/robots-ca121b5d03245bf82db00d1455555555.txt';
            res = {
                redirect: function(url) {
                    if (url === '/robots-ca121b5d03245bf82db00d14cee04e22.txt') {
                        redirected = true;
                    }
                    done();
                },
                send: function(asset) {
                    assert.fail(asset, '', 'Should not send');
                },
                end: function() {
                    assert(redirected, 'Redirect was not set correctly');
                }
            };
            next = function() {
                assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
            };
            midware(req,res,next);
        });

        it('should only send a status code and correct headers on HEAD request', function(done) {
            var headerSet = false;
            var statusSet = false;
            req.path = '/robots-ca121b5d03245bf82db00d14cee04e22.txt';
            req.method = 'HEAD';
            res = {
                set: function(headers) {
                    var mtime = fs.statSync('test/public/robots.txt').mtime;
                    if (headers.ETag === 'ca121b5d03245bf82db00d14cee04e22' &&
                        headers['Content-Type'] === 'text/plain' &&
                        headers['Cache-Control'] === 'public, max-age=31536000' &&
                        headers['Last-Modified'] === mtime.toUTCString() &&
                        //Hard to be exact here, so just make sure it's within a day of a year
                        Date.parse(headers.Expires) > Date.now() + 1000 * 60 * 60 * 364) {

                        headerSet = true;
                    }
                },
                status: function(number) {
                    if (number === 200) {
                        statusSet = true;
                    }
                },
                send: function(asset) {
                    assert.fail(asset, '', 'Should not send content');
                },
                end: function() {
                    assert(statusSet, 'Status was not set correctly');
                    assert(headerSet, 'Headers were not set correctly');
                    done();
                }
            };
            next = function() {
                assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
            };
            midware(req,res,next);
        });

        it('should return status 304 if the ETag matches', function(done) {
            var headerSet = false;
            var statusSet = false;
            req.path = '/robots-ca121b5d03245bf82db00d14cee04e22.txt';
            req.get = function(header) {
                if (header === 'If-None-Match') {
                    return 'ca121b5d03245bf82db00d14cee04e22';
                }
            };
            res = {
                set: function(headers) {
                    var mtime = fs.statSync('test/public/robots.txt').mtime;
                    if (headers.ETag === 'ca121b5d03245bf82db00d14cee04e22' &&
                        headers['Content-Type'] === 'text/plain' &&
                        headers['Cache-Control'] === 'public, max-age=31536000' &&
                        headers['Last-Modified'] === mtime.toUTCString()) {

                        headerSet = true;
                    }
                },
                status: function(number) {
                    assert.equal(number, 304, 'Wrong status: ' + number);
                    statusSet = true;
                },
                send: function(asset) {
                    if(asset === 304) {
                        done();
                    } else {
                        assert.fail(asset, '', 'Should not send content');
                    }
                },
                end: function() {
                    assert(statusSet, 'Status was not set correctly');
                    assert(headerSet, 'Headers were not set correctly');
                    done();
                }
            };
            next = function() {
                assert.fail('called next', 'called end', 'Incorrect routing', ', instead');
            };
            midware(req,res,next);
        });

        it('should send content if the ETag does not match', function(done) {
            var headerSet = false;
            var statusSet = false;
            req.path = '/robots-ca121b5d03245bf82db00d14cee04e22.txt';
            req.get = function(header) {
                if (header === 'If-None-Match') {
                    return 'da121b5d03245bf82db00d14cee04e22';
                }
            };
            res = {
                set: function(headers) {
                    var mtime = fs.statSync('test/public/robots.txt').mtime;
                    if (headers.ETag === 'ca121b5d03245bf82db00d14cee04e22' &&
                        headers['Content-Type'] === 'text/plain' &&
                        headers['Cache-Control'] === 'public, max-age=31536000' &&
                        headers['Last-Modified'] === mtime.toUTCString()) {

                        headerSet = true;
                    }
                },
                status: function(number) {
                    assert.equal(number, 200, 'Wrong status: ' + number);
                    statusSet = true;
                },
                send: function(asset) {
                    assert(statusSet, 'Status was not set correctly');
                    assert(headerSet, 'Headers were not set correctly');
                    done();
                },
                end: function() {
                    assert.fail(asset, '', 'Should send content');
                }
            };
            next = function() {
                assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
            };
            midware(req,res,next);
        });

        it.skip('should return status 304 if the modified date is the same as the file\'s', function(done) {
            var headerSet = false;
            var statusSet = false;
            req.path = '/robots-ca121b5d03245bf82db00d14cee04e22.txt';
            req.get = function(header) {
                var mtime = fs.statSync('test/public/robots.txt').mtime;
                if (header === 'If-Modified-Since') {
                    return mtime.toUTCString();
                }
            };
            res = {
                set: function(headers) {
                    var mtime = fs.statSync('test/public/robots.txt').mtime;
                    if (headers.ETag === 'ca121b5d03245bf82db00d14cee04e22' &&
                        headers['Content-Type'] === 'text/plain' &&
                        headers['Cache-Control'] === 'public, max-age=31536000' &&
                        headers['Last-Modified'] === mtime.toUTCString()) {

                        headerSet = true;
                    }
                },
                status: function(number) {
                    assert.equal(number, 304, 'Wrong status: ' + number);
                    statusSet = true;
                },
                send: function(asset) {
                    assert.fail(asset, '', 'Should not send content');
                },
                end: function() {
                    assert(statusSet, 'Status was not set correctly');
                    assert(headerSet, 'Headers were not set correctly');
                    done();
                }
            };
            next = function() {
                assert.fail('called next', 'called end', 'Incorrect routing', ', instead');
            };
            midware(req,res,next);
        });

        it('should return status 304 if the modified date is later than the file\'s', function(done) {
            var headerSet = false;
            var statusSet = false;
            req.path = '/robots-ca121b5d03245bf82db00d14cee04e22.txt';
            req.get = function(header) {
                var mtime = fs.statSync('test/public/robots.txt').mtime;
                mtime.setMinutes(mtime.getMinutes() + 1);
                if (header === 'If-Modified-Since') {
                    return mtime.toUTCString();
                }
            };
            res = {
                set: function(headers) {
                    var mtime = fs.statSync('test/public/robots.txt').mtime;
                    if (headers.ETag === 'ca121b5d03245bf82db00d14cee04e22' &&
                        headers['Content-Type'] === 'text/plain' &&
                        headers['Cache-Control'] === 'public, max-age=31536000' &&
                        headers['Last-Modified'] === mtime.toUTCString()) {

                        headerSet = true;
                    }
                },
                status: function(number) {
                    assert.equal(number, 304, 'Wrong status: ' + number);
                    statusSet = true;
                },
                send: function(asset) {
                    if(asset === 304) {
                        done();
                    } else {
                        assert.fail(asset, '', 'Should not send content');
                    }
                },
                end: function() {
                    assert(statusSet, 'Status was not set correctly');
                    assert(headerSet, 'Headers were not set correctly');
                    done();
                }
            };
            next = function() {
                assert.fail('called next', 'called end', 'Incorrect routing', ', instead');
            };
            midware(req,res,next);
        });

        it('should send if the modified date is earlier than the file\'s', function(done) {
            var headerSet = false;
            var statusSet = false;
            req.path = '/robots-ca121b5d03245bf82db00d14cee04e22.txt';
            req.get = function(header) {
                var mtime = fs.statSync('test/public/robots.txt').mtime;
                mtime.setMinutes(mtime.getMinutes() - 1);
                if (header === 'If-Modified-Since') {
                    return mtime.toUTCString();
                }
            };
            res = {
                set: function(headers) {
                    var mtime = fs.statSync('test/public/robots.txt').mtime;
                    if (headers.ETag === 'ca121b5d03245bf82db00d14cee04e22' &&
                        headers['Content-Type'] === 'text/plain' &&
                        headers['Cache-Control'] === 'public, max-age=31536000' &&
                        headers['Last-Modified'] === mtime.toUTCString()) {

                        headerSet = true;
                    }
                },
                status: function(number) {
                    assert.equal(number, 200, 'Wrong status: ' + number);
                    statusSet = true;
                },
                send: function(asset) {
                    assert(headerSet, 'Headers were not set correctly');
                    assert(statusSet, 'Status was not set correctly');
                    done();
                },
                end: function() {
                    assert.fail(asset, '', 'Should send content');
                }
            };
            next = function() {
                assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
            };
            midware(req,res,next);
        });

        function gzipTest(done) {
            req.path = '/robots-ca121b5d03245bf82db00d14cee04e22.txt';
            req.get = function(header) {
                if (header == 'Accept-Encoding') {
                    return 'gzip, deflate';
                }
            };
            var headerSet = false;
            res = {
                set: function(headers){
                    if (headers['Content-Encoding'] === 'gzip') {
                        headerSet = true;
                    }
                },
                status: function(number) {
                    if (number >= 400) {
                        assert.fail(number, '400', 'Failing status code', '<');
                    }
                },
                send: function(asset) {
                    fs.readFile('test/public/robots.txt', function(err, data) {
                        zlib.gzip(data, function(err, zippedAsset) {
                            assert.equal(bufCompare(zippedAsset, asset), 0);
                            assert(headerSet, 'Headers not set correctly');
                            done();
                        });
                    });
                }
            };
            next = function() {
                assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
            };
            midware(req,res,next);
        }

        it('should gzip the asset contents and send correct encoding header if the client accepts it', gzipTest);
        it('should still send gzipped contents after gzipped content is cached', gzipTest);

        it('registers an EJS helper', function(done) {
            req.app = {
                locals: {}
            };
            next = function() {
                assert.equal(typeof req.app.locals.electricity.url, 'function');
                done();
            };
            midware(req,res,next);
        });
    });

    describe('The url helper', function() {
        it('should append the hash of an asset if the asset is present', function(done) {
            midware(req, res, next);
            assert.equal(req.app.locals.electricity.url('/robots.txt'), '/robots-ca121b5d03245bf82db00d14cee04e22.txt');
            done();
        });

        it('should insert the hash in the correct place', function(done) {
            midware(req, res, next);
            assert.equal(req.app.locals.electricity.url('/robots-abc1de.home.txt'), '/robots-abc1de.home-ca121b5d03245bf82db00d14cee04e22.txt');
            done();
        });

        it('should fix relative paths to the route assets are served from', function(done) {
            midware(req, res, next);
            assert.equal(req.app.locals.electricity.url('robots.txt'), '/robots-ca121b5d03245bf82db00d14cee04e22.txt');
            done();
        });

        it('should leave the path alone if the asset is not present', function(done) {
            midware(req, res, next);
            assert.equal(req.app.locals.electricity.url('nope.gif'), 'nope.gif');
            done();
        });

        describe('with the hostname option', function() {
            it('should prepend the hostname if specified', function(done) {
                var cdnMidware = electricity.static('test/public', { hostname: 'cdn.example.com' });
                cdnMidware(req, res, next);
                assert.equal(req.app.locals.electricity.url('robots.txt'), '//cdn.example.com/robots-ca121b5d03245bf82db00d14cee04e22.txt');
                done();
            });

            it('should handle hostnames with trailing slashes', function(done) {
                var cdnMidware = electricity.static('test/public', { hostname: 'cdn.example.com/' });
                cdnMidware(req, res, next);
                assert.equal(req.app.locals.electricity.url('robots.txt'), '//cdn.example.com/robots-ca121b5d03245bf82db00d14cee04e22.txt');
                done();
            });
        });
    });
});
