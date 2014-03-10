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
            assert.fail('Called send', 'called next', 'Incorrect routing', ', instead');
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
        assert.equal('function', typeof midware);
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
                        assert.equal(0, bufCompare(data, asset));
                        done();
                    });
                }
            };
            next = function() {
                assert.fail('Called next', 'called send', 'Incorrect routing', ', instead');
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
                        assert.equal(0, bufCompare(data, asset));
                        done();
                    });
                }
            };
            next = function() {
                assert.fail('Called next', 'called send', 'Incorrect routing', ', instead');
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
                        assert.equal(0, bufCompare(data, asset));
                        done();
                    });
                }
            };
            next = function() {
                assert.fail('Called next', 'called send', 'Incorrect routing', ', instead');
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
                },
                send: function(asset) {
                    assert.fail(asset, '', 'Should not send');
                },
                end: function() {
                    assert(redirected, 'Redirect was not set correctly');
                    done();
                }
            };
            next = function() {
                assert.fail('Called next', 'called send', 'Incorrect routing', ', instead');
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
                        headers['Content-Length'] == '13' &&
                        headers['Cache-Control'] === 'public, max-age=31536000' &&
                        headers['Last-Modified'] === mtime.toUTCString()) {

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
                assert.fail('Called next', 'called send', 'Incorrect routing', ', instead');
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
                        headers['Content-Length'] == '13' &&
                        headers['Cache-Control'] === 'public, max-age=31536000' &&
                        headers['Last-Modified'] === mtime.toUTCString()) {

                            headerSet = true;
                    }
                },
                status: function(number) {
                    if (number === 304) {
                        statusSet = true;
                    }
                    else {
                        assert.fail(number, 304, 'Wrong status');
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
                assert.fail('Called next', 'called end', 'Incorrect routing', ', instead');
            };
            midware(req,res,next);
        });

        it.skip('should gzip the asset contents and send correct encoding header if the client accepts it', function(done) {
            req.path = '/robots.txt';
            req.get = function(header) {
                if (header == 'Accept-encoding') {
                    return 'gzip, deflate';
                }
            };
            var headerSet = false;
            res = {
                set: function(header, value){
                    if (header == 'Content-encoding' && value == 'gzip') {
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
                            assert.equal(0, bufCompare(zippedAsset, asset));
                            assert(headerSet);
                            done();
                        });
                    });
                }
            };
            next = function() {
                assert.fail('Called next', 'called send', 'Incorrect routing', ', instead');
            };
            midware(req,res,next);
        });

        it('registers an EJS helper', function(done) {
            req.app = {
                locals: {}
            };
            next = function() {
                assert.equal('function', typeof req.app.locals.electricity.url);
                done();
            };
            midware(req,res,next);
        });
    });
    describe('The url helper', function() {
        beforeEach(function() {
            midware(req,res,next);
        });
        it('should append the hash of an asset if the asset is present', function(done) {
            assert.equal('robots-ca121b5d03245bf82db00d14cee04e22.txt', req.app.locals.electricity.url('robots.txt'));
            done();
        });
        it('should leave the path alone if the asset is not present', function(done) {
            assert.equal('notthere.png', req.app.locals.electricity.url('notthere.png'));
            done();
        });
    });
});
