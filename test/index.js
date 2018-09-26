const assert = require('assert');
const fs = require('fs');
const zlib = require('zlib');

const bufCompare = require('buffer-compare');
const fse = require('fs-extra');

const electricity = require('../lib/index');

var req;
var res;
var next;
var midware;

function setupPassthrough() {
    // Have to set this to call done in each test for reference to work
    next = function() {};

    req = {
        path: '/',
        method: 'GET',
        app: {
            locals: {}
        },
        get: function() { return ''; },
        headers: {}
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
    before(function(done) {
        midware = electricity.static('test/public', {
            sass: { imagePath: '/images/' },
            snockets: { ignore: /compiled/ },
            uglifyjs: { enabled: false },
            uglifycss: { enabled: false }
        });

        setImmediate(done);
    });

    // Set up default mocks before each test, override as needed
    beforeEach(function(done) {
        setupPassthrough();
        setImmediate(done);
    });

    it('returns a function', function(done) {
        assert.equal(typeof midware, 'function');

        done();
    });

    it('should default to "public" if the directory isn’t specified', function(done) {
        assert.throws(function() {
            electricity.static();
        }, /public/);

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

            // Should succeed
            electricity.static('test/public', {
                hostname: undefined,
                sass: { imagePath: '/images/' },
                snockets: { ignore: /compiled/ },
                uglifyjs: { ignore: /failure/ },
                watch: { enabled: false }
            });
        });

        it('throws an error if sass.imagePath is not falsy or a string', function() {
            assert.throws(function() {
                electricity.static('test/public', { sass: { imagePath: {} } });
            });

            assert.throws(function() {
                electricity.static('test/public', { sass: { imagePath: 35 } });
            });

            assert.throws(function() {
                electricity.static('test/public', { sass: { imagePath: function() {} } });
            });

            assert.throws(function() {
                electricity.static('test/public', { sass: { imagePath: [] } });
            });

            // Should succeed
            electricity.static('test/public', {
                sass: { imagePath: undefined },
                snockets: { ignore: /compiled/ },
                uglifyjs: { ignore: /failure/ },
                watch: { enabled: false }
            });
        });

        it('should allow sass.functions', function() {
            electricity.static('test/public', {
                sass: { functions: {} }
            });
        });

        it('should not hashify if disabled', function(done) {
            var middleware = electricity.static('test/public', {
                hashify: false
            });

            setTimeout(function() {
                req.path = '/robots.txt';

                res = {
                    redirect: function() {
                        assert.fail('called redirect', 'called send');
                    },
                    set: function() {},
                    status: function(number) {
                        if (number >= 400) {
                            assert.fail(number, '400');
                        }
                    },
                    send: function() {
                        done();
                    }
                };

                next = function() {
                    assert.fail('called next', 'called send');
                };

                middleware(req, res, next);
            }, 1000);
        });
    });

    describe('The middleware', function() {
        it('calls next if the asset does not exist', function(done) {
            midware(req, res, done);
        });

        it('calls next if the request method is not GET or HEAD', function(done) {
            req.method = 'POST';

            midware(req, res, done);
        });

        it('calls res.redirect to the hash-appeneded url if the asset does exist', function(done) {
            req.path = '/robots.txt';

            res = {
                redirect: function(url) {
                    assert.strictEqual(url, '/robots-ca121b5d03245bf82db00d14cee04e22.txt');
                    done();
                },
                set: function() {}
            };

            midware(req, res);
        });

        it('calls res.send with asset contents if the asset does exist and has its hash appended', function(done) {
            req.path = '/robots-ca121b5d03245bf82db00d14cee04e22.txt';

            res = {
                set: function() {},
                send: function(asset) {
                    fs.readFile('test/public/robots.txt', function(err, data) {
                        assert.equal(bufCompare(data, asset), 0);
                        done();
                    });
                },
                status: function() {}
            };

            midware(req, res);
        });

        it('calls res.redirect for extension-less files', function(done) {
            req.path = '/no-extension';

            res = {
                redirect: function(url) {
                    assert.strictEqual(url, '/no-extension-6f5902ac237024bdd0c176cb93063dc4');
                    done();
                },
                set: function() {}
            };

            midware(req, res);
        });

        it.skip('calls res.send for extension-less files', function(done) {
            req.path = '/no-extension-6f5902ac237024bdd0c176cb93063dc4';

            res = {
                set: function() {},
                send: function(asset) {
                    fs.readFile('test/public/no-extension-6f5902ac237024bdd0c176cb93063dc4', function(err, data) {
                        assert.equal(bufCompare(data, asset), 0);
                        done();
                    });
                }
            };

            midware(req, res);
        });

        it('calls res.send with custom headers if specified', function(done) {
            var midwareWithHeaders = electricity.static('test/public', {
                headers: { 'X-Custom': 'test' },
                sass: { imagePath: '/images/' },
                snockets: { ignore: /compiled/ },
                uglifyjs: { enabled: false },
                uglifycss: { enabled: false }
            });
            var setCustomHeader = false;
            req.path = '/robots-ca121b5d03245bf82db00d14cee04e22.txt';
            res = {
                set: function(headers){
                    if (headers['X-Custom'] === 'test') {
                        setCustomHeader = true;
                    }
                },
                status: function(number) {
                    if (number >= 400) {
                        assert.fail(number, '400', 'Failing status code', '<');
                    }
                },
                send: function(asset) {
                    assert(setCustomHeader, 'Did not set custom header');
                    fs.readFile('test/public/robots.txt', function(err, data) {
                        assert.equal(bufCompare(data, asset), 0);
                        done();
                    });
                }
            };
            next = function() {
                assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
            };
            midwareWithHeaders(req,res,next);
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
                        assert.equal(bufCompare(data.toString(), asset), 0);
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
                end: function() {
                    assert(redirected, 'Redirect was not set correctly');
                },
                redirect: function(url) {
                    if (url === '/robots-ca121b5d03245bf82db00d14cee04e22.txt') {
                        redirected = true;
                    }
                    done();
                },
                send: function(asset) {
                    assert.fail(asset, '', 'Should not send');
                },
                set: function(){}
            };
            next = function() {
                assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
            };
            midware(req,res,next);
        });

        it('correctly redirects for a file whose filename contains something looking like a hash', function(done) {
            var redirected = false;
            req.path = '/robots-3e.txt';
            res = {
                end: function() {
                    assert(redirected, 'Redirect was not set correctly');
                },
                redirect: function(url) {
                    if (url === '/robots-3e-ca121b5d03245bf82db00d14cee04e22.txt') {
                        redirected = true;
                    }
                    assert(redirected, 'Did not redirect whose filename contains something looking like a hash');
                    done();
                },
                send: function(asset) {
                    assert.fail(asset, '', 'Should not send');
                },
                set: function(){}
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
                        // Hard to be exact here, so just make sure it's within a day of a year
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
                    if (asset === 304) {
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
                send: function() {
                    assert(statusSet, 'Status was not set correctly');
                    assert(headerSet, 'Headers were not set correctly');
                    done();
                },
                end: function() {
                    assert.fail('called end', 'called send', 'Should send content');
                }
            };

            next = function() {
                assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
            };

            midware(req,res,next);
        });

        it('should return status 304 if the modified date is the same as the file’s', function(done) {
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

            midware(req, res, next);
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
                    if (asset === 304) {
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
                send: function() {
                    assert(headerSet, 'Headers were not set correctly');
                    assert(statusSet, 'Status was not set correctly');
                    done();
                },
                end: function() {
                    assert.fail('called end', 'called send', 'Should send content');
                }
            };

            next = function() {
                assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
            };

            midware(req,res,next);
        });

        it('registers an EJS helper', function(done) {
            req.app = {
                locals: {}
            };

            next = function() {
                assert.equal(typeof req.app.locals.electricity.url, 'function');
                done();
            };

            midware(req, res, next);
        });

        it('only needs to registers an EJS helper once', function(done) {
            req.app = {
                locals: {}
            };

            midware(req, res, function() {
                assert.equal(typeof req.app.locals.electricity.url, 'function');

                midware(req, res, function() {
                    assert.equal(typeof req.app.locals.electricity.url, 'function');
                    done();
                });
            });
        });

        describe('Gzip', function() {
            function gzipTest(done) {
                req.path = '/robots-ca121b5d03245bf82db00d14cee04e22.txt';

                req.get = function(header) {
                    if (header == 'Accept-Encoding') {
                        return 'gzip, deflate';
                    }
                };

                req.headers['accept-encoding'] = 'gzip, deflate';

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

            it('should not gzip non-whitelisted MIME types', function(done) {
                req.path = '/apple-touch-icon-precomposed-ed47dd1fd0256fec0480adc1c03f9ef3.png';
                req.get = function(header) {
                    if (header == 'Accept-Encoding') {
                        return 'gzip, deflate';
                    }
                };
                res = {
                    set: function(){},
                    status: function(number) {
                        if (number >= 400) {
                            assert.fail(number, '400', 'Failing status code', '<');
                        }
                    },
                    send: function(asset) {
                        fs.readFile('test/public/apple-touch-icon-precomposed.png', function(err, data) {
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

            it('should gzip blank file', function(done) {
                req.path = '/blank-d41d8cd98f00b204e9800998ecf8427e.txt';

                req.get = function(header) {
                    if (header === 'Accept-Encoding') {
                        return 'gzip, deflate';
                    }
                };

                res = {
                    set: function() {},
                    status: function(number) {
                        if (number >= 400) {
                            assert.fail(number, '400', 'Failing status code', '<');
                        }
                    },
                    send: function(asset) {
                        fs.readFile('test/public/blank.txt', function(err, data) {
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
        });

        describe('SASS support', function() {
            before(function(done) {
                fs.writeFile('test/public/styles/lib/vars.scss', '$color: red;', function(err) {
                    if (err) {
                        throw err;
                    }

                    done();
                });
            });

            it('serves compiled SASS files', function(done) {
                req.path = '/styles/sample-4d8249529cea736beb1104f82b65b904.css';

                res = {
                    set: function() {},
                    status: function(number) {
                        if (number >= 400) {
                            assert.fail(number, '400', 'Failing status code', '<');
                        }
                    },
                    send: function(asset) {
                        fs.readFile('test/public/styles/compiled/sample.css', function(err, data) {
                            assert.equal(data.toString(), asset);
                            done();
                        });
                    }
                };

                next = function() {
                    assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
                };

                midware(req, res, next);
            });

            it('correctly resolves imports', function(done) {
                req.path = '/styles/include_path-86eb0c7c324581dd9bff9832438282fd.css';

                res = {
                    set: function() {},
                    status: function(number) {
                        if (number >= 400) {
                            assert.fail(number, '400', 'Failing status code', '<');
                        }
                    },
                    send: function(asset) {
                        fs.readFile('test/public/styles/compiled/include_path.css', function(err, data) {
                            assert.equal(data.toString(), asset);
                            done();
                        });
                    }
                };

                next = function() {
                    assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
                };

                midware(req, res, next);
            });

            it('uses the Sass imagePath option for the image-url helper', function(done) {
                req.path = '/styles/image_path-4b176d19bfb77386cd6ca03378b17349.css';

                res = {
                    redirect: function(url) {
                        req.path = url;
                        midware(req,
                                {
                                    redirect: function() {
                                        assert.fail('looped redirect', 'called send', 'Incorrect redirect');
                                    },
                                    set: function() {},
                                    status: function(number) {
                                        if (number >= 400) {
                                            assert.fail(number, '400', 'Failing status code', '<');
                                        }
                                    },
                                    send: function(asset) {
                                        fs.readFile('test/public/styles/compiled/image_path.css', function(err, data) {
                                            assert.strictEqual(data.toString(), asset);
                                            done();
                                        });
                                    }
                                },
                                next);
                    },
                    set: function() {},
                    status: function(number) {
                        if (number >= 400) {
                            assert.fail(number, '400', 'Failing status code', '<');
                        }
                    },
                    send: function(asset) {
                        fs.readFile('test/public/styles/compiled/image_path.css', function(err, data) {
                            assert.equal(data.toString(), asset);
                            done();
                        });
                    }
                };

                next = function() {
                    assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
                };

                midware(req, res, next);
            });

            it('has the correct default option for the image-url helper', function(done) {
                var defaultMiddleware = electricity.static('test/public', {
                    snockets: { ignore: 'compiled' },
                    uglifycss: { enabled: true },
                    uglifyjs: { ignore: /failure/ },
                    watch: { enabled: false }
                });

                req.path = '/styles/image_path-58c7e927b74b217b2796c4cafc3e8d27.css';

                res = {
                    redirect: function(url) {
                        assert.fail(url, 'should not redirect', '', '');
                    },
                    set: function(){},
                    status: function(number) {
                        if (number >= 400) {
                            assert.fail(number, '400', 'Failing status code', '<');
                        }
                    },
                    send: function(asset) {
                        fs.readFile('test/public/styles/compiled/image_path_default.css', function(err, data) {
                            assert.equal(data.toString(), asset);
                            done();
                        });
                    }
                };

                next = function() {
                    assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
                };

                defaultMiddleware(req, res, next);
            });

            it('uses a given hostname for css url assets', function(done) {
                var defaultMiddleware = electricity.static('test/public', {
                    hostname: 'example.com',
                    snockets: { ignore: 'compiled' },
                    uglifycss: { enabled: true },
                    uglifyjs: { ignore: /failure/ },
                    watch: { enabled: false }
                });
                req.path = '/styles/image_path-0a8f38134092864f21d2cc9c558d54ab.css';

                res = {
                    redirect: function(url) {
                        assert.fail(url, 'should not redirect', '', '');
                    },
                    set: function(){},
                    status: function(number) {
                        if (number >= 400) {
                            assert.fail(number, '400', 'Failing status code', '<');
                        }
                    },
                    send: function(asset) {
                        fs.readFile('test/public/styles/compiled/image_path_hostname.css', function(err, data) {
                            assert.equal(data.toString(), asset);
                            done();
                        });
                    }
                };

                next = function() {
                    assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
                };

                defaultMiddleware(req, res, next);
            });

            it('should work with relative css url\'s', function(done) {
                var defaultMiddleware = electricity.static('test/public', {
                    snockets: { ignore: 'compiled' },
                    uglifycss: { enabled: true },
                    uglifyjs: { ignore: /failure/ },
                    watch: { enabled: false }
                });

                req.path = '/styles/image_path-58c7e927b74b217b2796c4cafc3e8d27.css';

                res = {
                    redirect: function(url) {
                        assert.fail(url, 'should not redirect', '', '');
                    },
                    set: function(){},
                    status: function(number) {
                        if (number >= 400) {
                            assert.fail(number, '400', 'Failing status code', '<');
                        }
                    },
                    send: function(asset) {
                        fs.readFile('test/public/styles/compiled/image_path_default.css', function(err, data) {
                            assert.equal(data.toString(), asset);
                            done();
                        });
                    }
                };

                next = function() {
                    assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
                };

                defaultMiddleware(req, res, next);
            });

            it('should not compile ignored files', function(done) {
                var ignoreWare = electricity.static('test/public', {
                    snockets: { ignore: 'compiled' },
                    sass: { ignore: 'sample' },
                    uglifyjs: { ignore: /failure/ },
                    watch: { enabled: false }
                });
                req.path = '/styles/sample-868c5b6f0d0cbcd87ceec825c2ac6e1f.scss';

                res = {
                    set: function(){},
                    status: function(number) {
                        if (number >= 400) {
                            assert.fail(number, '400', 'Failing status code', '<');
                        }
                    },
                    send: function(asset) {
                        fs.readFile('test/public/styles/sample.scss', function(err, data) {
                            assert.equal(data.toString(), asset);
                            done();
                        });
                    }
                };

                next = function() {
                    assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
                };

                ignoreWare(req, res, next);
            });

            it('should support arrays of ignore parameters', function(done) {
                var ignoreWare = electricity.static('test/public', {
                    snockets: { ignore: 'compiled' },
                    sass: { ignore: ['sample'] },
                    uglifyjs: { ignore: /failure/ },
                    watch: { enabled: false }
                });

                req.path = '/styles/sample-868c5b6f0d0cbcd87ceec825c2ac6e1f.scss';

                res = {
                    set: function() {},
                    status: function(number) {
                        if (number >= 400) {
                            assert.fail(number, '400', 'Failing status code', '<');
                        }
                    },
                    send: function(asset) {
                        fs.readFile('test/public/styles/sample.scss', function(err, data) {
                            assert.equal(data.toString(), asset);
                            done();
                        });
                    }
                };

                next = function() {
                    assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
                };

                ignoreWare(req, res, next);
            });
        });

        describe('snockets support', function() {
            it('should serve Javascript with required files included', function(done) {
                req.path = '/scripts/main-c6c2afd452d98199939fb7c292c5474b.js';

                res = {
                    set: function() {},
                    status: function(number) {
                        if (number >= 400) {
                            assert.fail(number, '400', 'Failing status code', '<');
                        }
                    },
                    send: function(asset) {
                        fs.readFile('test/public/scripts/compiled/main.js', function(err, data) {
                            assert.equal(asset.trim(), data.toString().trim());
                            done();
                        });
                    },
                    redirect: function(url) {
                        assert.fail('called redirect to ' + url, 'called send', 'Incorrect routing', ', instead');
                    }
                };

                next = function() {
                    assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
                };

                midware(req, res, next);
            });

            it('should not compile ignored files', function(done) {
                var ignoreWare = electricity.static('test/public', {
                    snockets: { ignore: /(main|compiled)/ },
                    uglifyjs: { enabled: false },
                    watch: { enabled: false }
                });

                req.path = '/scripts/main-6bcab6c9a87f02ef40018f3302d1e918.js';

                res = {
                    set: function() {},
                    status: function(number) {
                        if (number >= 400) {
                            assert.fail(number, '400', 'Failing status code', '<');
                        }
                    },
                    send: function(asset) {
                        fs.readFile('test/public/scripts/main.js', function(err, data) {
                            assert.equal(data.toString().trim(), asset.toString().trim());
                            done();
                        });
                    },
                    redirect: function(url) {
                        assert.fail('called redirect to ' + url, 'called send', 'Incorrect routing', ', instead');
                    }
                };

                next = function() {
                    assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
                };

                ignoreWare(req, res, next);
            });

            it('should support arrays of ignore parameters', function(done) {
                var ignoreWare = electricity.static('test/public', {
                    snockets: { ignore: ['main', 'compiled'] },
                    uglifyjs: { enabled: false },
                    watch: { enabled: false }
                });

                req.path = '/scripts/main-6bcab6c9a87f02ef40018f3302d1e918.js';

                res = {
                    set: function() {},
                    status: function(number) {
                        if (number >= 400) {
                            assert.fail(number, '400', 'Failing status code', '<');
                        }
                    },
                    send: function(asset) {
                        fs.readFile('test/public/scripts/main.js', function(err, data) {
                            assert.equal(data.toString().trim(), asset.toString().trim());
                            done();
                        });
                    },
                    redirect: function(url) {
                        assert.fail('called redirect to ' + url, 'called send', 'Incorrect routing', ', instead');
                    }
                };

                next = function() {
                    assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
                };

                ignoreWare(req, res, next);
            });
        });

        describe('react support', function() {
            it('should compile jsx files', function(done) {
                var jsxMiddleware = electricity.static('test/public', {
                    jsx: { ignore: 'compiled' },
                    snockets: { enabled: false },
                    uglifyjs: { enabled: false },
                    watch: { enabled: false }
                });

                req.path = '/jsx/reactTest-185406c31a8edd01ff39d5ba7506513f.js';

                res = {
                    set: function() {},
                    status: function(number) {
                        if (number >= 400) {
                            assert.fail(number, '400', 'Failing status code', '<');
                        }
                    },
                    send: function(asset) {
                        fs.readFile('test/public/jsx/compiled/reactTest.js', function(err, data) {
                            assert.equal(asset.trim(), data.toString().trim());
                            done();
                        });
                    },
                    redirect: function(url) {
                        assert.fail('called redirect to ' + url, 'called send', 'Incorrect routing', ', instead');
                    }
                };

                next = function() {
                    assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
                };

                jsxMiddleware(req, res, next);
            });

            it('should compile jsx files with snockets includes', function(done) {
                var jsxMiddleware = electricity.static('test/public', {
                    jsx: { ignore: 'compiled' },
                    snockets: { enabled: true },
                    uglifyjs: { enabled: false },
                    watch: { enabled: false }
                });

                req.path = '/jsx/reactSnockets-a0df1fd0ccebc9227d2afe96bfd71645.js';

                res = {
                    set: function() {},
                    status: function(number) {
                        if (number >= 400) {
                            assert.fail(number, '400', 'Failing status code', '<');
                        }
                    },
                    send: function(asset) {
                        fs.readFile('test/public/jsx/compiled/reactSnockets.js', function(err, data) {
                            assert.equal(asset.trim(), data.toString().trim());
                            done();
                        });
                    },
                    redirect: function(url) {
                        assert.fail('called redirect to ' + url, 'called send', 'Incorrect routing', ', instead');
                    }
                };

                next = function() {
                    assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
                };

                jsxMiddleware(req, res, next);
            });

            it('should compile jsx files and uglify them', function(done) {
                var jsxMiddleware = electricity.static('test/public', {
                    jsx: { ignore: 'compiled' },
                    snockets: { enabled: true },
                    uglifyjs: { enabled: true },
                    watch: { enabled: false }
                });

                req.path = '/jsx/reactSnockets-672b7d0ee298f0668d4ca6372262bc43.js';

                res = {
                    set: function(){},
                    status: function(number) {
                        if (number >= 400) {
                            assert.fail(number, '400', 'Failing status code', '<');
                        }
                    },
                    send: function(asset) {
                        fs.readFile('test/public/jsx/compiled/reactSnockets.min.js', function(err, data) {
                            assert.ifError(err);
                            assert.equal(data.toString(), asset);
                            done();
                        });
                    },
                    redirect: function(url) {
                        assert.fail('called redirect to ' + url, 'called send', 'Incorrect routing', ', instead');
                    }
                };

                next = function() {
                    assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
                };

                jsxMiddleware(req, res, next);
            });
        });

        describe('uglifyjs support', function() {
            it('should minify Javascript if enabled', function(done) {
                var minWare = electricity.static('test/public', {
                    snockets: { ignore: 'compiled' },
                    uglifyjs: {
                        enabled: true,
                        ignore: /failure/,
                        compress: {
                            sequences: false
                        }
                    },
                    watch: { enabled: false }
                });

                req.path = '/scripts/main-1c84b0a70d32006b11e279660af525be.js';

                res = {
                    set: function(){},
                    status: function(number) {
                        if (number >= 400) {
                            assert.fail(number, '400', 'Failing status code', '<');
                        }
                    },
                    send: function(asset) {
                        fs.readFile('test/public/scripts/compiled/main.min.js', function(err, data) {
                            assert.equal(data.toString(), asset.toString());
                            done();
                        });
                    },
                    redirect: function(url) {
                        assert.fail('called redirect to ' + url, 'called send', 'Incorrect routing', ', instead');
                    }
                };

                next = function() {
                    assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
                };

                minWare(req, res, next);
            });

            it('should should not crash if minification fails', function(done) {
                var minWare = electricity.static('test/public', {
                    snockets: { ignore: 'compiled' },
                    uglifyjs: {
                        enabled: true,
                        compress: {
                            sequences: false
                        }
                    },
                    watch: { enabled: false }
                });
                req.path = '/scripts/main-1c84b0a70d32006b11e279660af525be.js';
                res = {
                    set: function(){},
                    status: function(number) {
                        if (number >= 400) {
                            assert.fail(number, '400', 'Failing status code', '<');
                        }
                    },
                    send: function(asset) {
                        fs.readFile('test/public/scripts/compiled/main.min.js', function(err, data) {
                            assert.equal(data.toString(), asset.toString());
                            done();
                        });
                    },
                    redirect: function(url) {
                        assert.fail('called redirect to ' + url, 'called send', 'Incorrect routing', ', instead');
                    }
                };
                next = function() {
                    assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
                };
                minWare(req, res, next);
            });

            it('should support sourcemaps', function(done) {
                var minWare = electricity.static('test/public', {
                    snockets: { ignore: 'compiled' },
                    uglifyjs: {
                        compress: {
                            sequences: false
                        },
                        enabled: true,
                        ignore: /failure/,
                        sourceMap: true
                    },
                    watch: { enabled: false }
                });

                req.path = '/scripts/main-1c84b0a70d32006b11e279660af525be.js';

                res = {
                    set: function(){},
                    status: function(number) {
                        if (number >= 400) {
                            assert.fail(number, '400', 'Failing status code', '<');
                        }
                    },
                    send: function(asset) {
                        fs.readFile('test/public/scripts/compiled/main.min.js', function(err, data) {
                            assert.equal(data.toString(), asset.toString());
                            done();
                        });
                    },
                    redirect: function(url) {
                        assert.fail('called redirect to ' + url, 'called send', 'Incorrect routing', ', instead');
                    }
                };

                next = function() {
                    assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
                };

                minWare(req, res, next);
            });
        });

        describe('uglifycss support', function() {
            it('should minify CSS if enabled', function(done) {
                var minWare = electricity.static('test/public', {
                    snockets: { ignore: 'compiled' },
                    uglifycss: {
                        enabled: true
                    },
                    uglifyjs: { ignore: /failure/ },
                    watch: { enabled: false }
                });
                req.path = '/styles/normalize-62925d221200eee3d77a6bb85cb7cf66.css';
                res = {
                    set: function(){},
                    status: function(number) {
                        if (number >= 400) {
                            assert.fail(number, '400', 'Failing status code', '<');
                        }
                    },
                    send: function(asset) {
                        fs.readFile('test/public/styles/normalize.min.css', function(err, data) {
                            assert.equal(data.toString(), asset.toString());
                            done();
                        });
                    },
                    redirect: function(url) {
                        assert.fail('called redirect to ' + url, 'called send', 'Incorrect routing', ', instead');
                    }
                };
                next = function() {
                    assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
                };
                minWare(req, res, next);
            });

            it('should minify compiled CSS if enabled', function(done) {
                var minWare = electricity.static('test/public', {
                    snockets: { ignore: 'compiled' },
                    uglifycss: {
                        enabled: true
                    },
                    uglifyjs: { ignore: /failure/ },
                    watch: { enabled: false }
                });

                req.path = '/styles/include_path-e7af6c89c241034f1dcff36e1709da1f.css';

                res = {
                    set: function(){},
                    status: function(number) {
                        if (number >= 400) {
                            assert.fail(number, '400', 'Failing status code', '<');
                        }
                    },
                    send: function(asset) {
                        fs.readFile('test/public/styles/compiled/include_path.min.css', function(err, data) {
                            assert.equal(data.toString(), asset.toString());
                            done();
                        });
                    },
                    redirect: function(url) {
                        assert.fail('called redirect to ' + url, 'called send', 'Incorrect routing', ', instead');
                    }
                };

                next = function() {
                    assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
                };

                minWare(req, res, next);
            });
        });

        describe('when hashify is set to false', function() {
            var midwareWithNoHash;

            before(function() {
                midwareWithNoHash = electricity.static('test/public', {
                    hashify: false,
                    sass: { imagePath: '/images/' },
                    snockets: { ignore: /compiled/ },
                    uglifyjs: { enabled: false },
                    uglifycss: { enabled: false }
                });
            });

            it('should not redirect an unhashed request', function(done) {
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

                midwareWithNoHash(req,res,next);
            });
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

        it('should preserve query and targets', function(done) {
            midware(req, res, next);
            assert.equal(req.app.locals.electricity.url('/robots.txt?abc'), '/robots-ca121b5d03245bf82db00d14cee04e22.txt?abc');
            assert.equal(req.app.locals.electricity.url('/robots.txt#abc'), '/robots-ca121b5d03245bf82db00d14cee04e22.txt#abc');
            assert.equal(req.app.locals.electricity.url('/robots.txt?abc#def'), '/robots-ca121b5d03245bf82db00d14cee04e22.txt?abc#def');
            assert.equal(req.app.locals.electricity.url('/robots.txt?#def'), '/robots-ca121b5d03245bf82db00d14cee04e22.txt?#def');
            done();
        });

        describe('when hashify is set to false', function() {
            var midwareWithNoHash;
            before(function() {
                midwareWithNoHash = electricity.static('test/public', {
                    hashify: false,
                    sass: { imagePath: '/images/' },
                    snockets: { ignore: /compiled/ },
                    uglifyjs: { enabled: false },
                    uglifycss: { enabled: false }
                });

            });

            it('should not append a hash', function(done) {
                midwareWithNoHash(req,res,next);
                assert.equal(req.app.locals.electricity.url('robots.txt'), '/robots.txt');
                done();
            });
        });

        describe('with the hostname option', function() {
            it('should prepend the hostname if specified', function(done) {
                var cdnMidware = electricity.static('test/public', {
                    hostname: 'cdn.example.com',
                    snockets: { ignore: /compiled/ },
                    uglifyjs: { ignore: /failure/ },
                    watch: { enabled: false }
                });
                cdnMidware(req, res, next);
                assert.equal(req.app.locals.electricity.url('robots.txt'), '//cdn.example.com/robots-ca121b5d03245bf82db00d14cee04e22.txt');
                done();
            });

            it('should handle hostnames with trailing slashes', function(done) {
                var cdnMidware = electricity.static('test/public', {
                    hostname: 'cdn.example.com/',
                    snockets: { ignore: /compiled/ },
                    uglifyjs: { ignore: /failure/ },
                    watch: { enabled: false }
                });
                cdnMidware(req, res, next);
                assert.equal(req.app.locals.electricity.url('robots.txt'), '//cdn.example.com/robots-ca121b5d03245bf82db00d14cee04e22.txt');
                done();
            });
        });
    });

    describe('The file watcher', function() {
        it('should create a cache entry when a file is created', function(done) {
            var middleware = electricity.static('test/public');

            setTimeout(function() {
                fs.writeFile('test/public/watchTest.txt', 'Hey look, a new asset!', function() {
                    setTimeout(function() {
                        req.path = '/watchTest-2d6adbc9b77b720b06aa3003511630c9.txt';

                        res = {
                            set: function() {},
                            status: function() {},
                            send: function(asset) {
                                fs.readFile('test/public/watchTest.txt', function(err, data) {
                                    assert.equal(bufCompare(data, asset), 0);
                                    done();
                                });
                            }
                        };

                        middleware(req, res);
                    }, 1000);
                });
            }, 1000);
        });

        it('should update a cache entry when a file is changed', function(done) {
            var middleware = electricity.static('test/public');

            setTimeout(function() {
                fs.appendFile('test/public/watchTest.txt', 'MORE DATA', function(err) {
                    if (err) {
                        throw err;
                    }

                    setTimeout(function() {
                        req.path = '/watchTest-e4b18591cbef3ac24e02ba0e0c44e97e.txt';

                        res = {
                            set: function() {},
                            status: function(number) {
                                if (number >= 400) {
                                    assert.fail(number, '400', 'Failing status code', '<');
                                }
                            },
                            send: function(asset) {
                                fs.readFile('test/public/watchTest.txt', function(err, data) {
                                    assert.equal(bufCompare(data, asset), 0);
                                    done();
                                });
                            }
                        };

                        next = function() {
                            assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
                        };

                        middleware(req, res, next);
                    }, 1000);
                });
            }, 1000);
        });

        it('should remove a cache entry when a file is deleted', function(done) {
            fs.unlink('test/public/watchTest.txt', function(err) {
                if (err) {
                    throw err;
                }

                setTimeout(function() {
                    setupPassthrough();
                    next = done;
                    req.path = '/watchTest-2d6adbc9b77b720b06aa3003511630c9.txt';
                    midware(req, res, next);
                }, 1000);
            });
        });

        // Make a directory, wait a while to make sure it doesn't break anything, then remove it.
        it('should not crash when a directory is added or removed', function(done) {
            fs.rmdir('test/public/watchTestDir', function() {
                assert.doesNotThrow(function() {
                    fs.mkdir('test/public/watchTestDir', function(err) {
                        if (err) {
                            throw err;
                        }

                        setTimeout(function() {
                            fs.rmdir('test/public/watchTestDir', done);
                        }, 1000);
                    });
                });
            });
        });

        it('should handle directory renames', function(done) {
            var middleware = electricity.static('test/public');

            setTimeout(function() {
                fse.remove('test/public/shouldHandleDirectoryRenames', function() {
                    fse.remove('test/public/shouldHandleDirectoryRenames2', function() {
                        fse.outputFile('test/public/shouldHandleDirectoryRenames/test.scss', 'html {}', function() {
                            fs.rename('test/public/shouldHandleDirectoryRenames', 'test/public/shouldHandleDirectoryRenames2', function() {
                                setTimeout(function() {
                                    req.path = '/shouldHandleDirectoryRenames2/test.css';

                                    res = {
                                        redirect: function(url) {
                                            assert.strictEqual(url, '/shouldHandleDirectoryRenames2/test-c1b0df53e4ec32be6e95dae8c1696440.css');
                                            done();
                                        },
                                        set: function() {}
                                    };

                                    middleware(req, res);
                                }, 1000);
                            });
                        });
                    });
                });
            }, 1000);
        });

        describe('with SASS', function() {
            it('should recompile dependents when a watched scss file changes', function(done) {
                fs.writeFile('test/public/styles/lib/vars.scss', '$color: blue;', function() {
                    setTimeout(function() {
                        req.path = '/styles/include_path-42076d4b87dddb9db5b5bc11be656c03.css';

                        res = {
                            set: function(){},
                            status: function(number) {
                                if (number >= 400) {
                                    assert.fail(number, '400', 'Failing status code', '<');
                                }
                            },
                            send: function(asset) {
                                fs.readFile('test/public/styles/compiled/include_path_blue.css', function(err, data) {
                                    assert.equal(data.toString(), asset);
                                    done();
                                });
                            },
                            redirect: function(url) {
                                assert.fail('called redirect to ' + url, 'called send', 'Incorrect routing', ', instead');
                            }
                        };

                        next = function() {
                            assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
                        };

                        midware(req, res, next);
                    }, 1000);
                });
            });

            it('should also recompile dependents for files added after load', function(done) {
                var original = fs.createReadStream('test/public/styles/include_path.scss');
                var copy = fs.createWriteStream('test/public/styles/include_path_copy.scss');

                original.on('end', function() {
                    setTimeout(function() {
                        fs.writeFile('test/public/styles/lib/vars.scss', '$color: red;', function() {
                            setTimeout(function() {
                                req.path = '/styles/include_path_copy-86eb0c7c324581dd9bff9832438282fd.css';

                                res = {
                                    send: function(asset) {
                                        fs.readFile('test/public/styles/compiled/include_path.css', function(err, data) {
                                            assert.equal(data.toString(), asset);
                                            done();
                                        });
                                    },
                                    set: function() {},
                                    status: function() {}
                                };

                                midware(req, res);
                            }, 1000);
                        });
                    }, 1000);
                });

                original.pipe(copy);
            });

            after(function(done) {
                fs.unlink('test/public/styles/include_path_copy.scss', function(err) {
                    if (err) {
                        throw err;
                    }

                    done();
                });
            });
        });

        describe('with snockets', function() {
            it('should recompile dependents when a watched js file changes', function(done) {
                fs.writeFile('test/public/scripts/dep1.js', 'console.log(\'dep1.1\');\n', function() {
                    setTimeout(function() {
                        req.path = '/scripts/main-8ebef9643de3549f70271ec51a402b26.js';

                        res = {
                            set: function() {},
                            status: function(number) {
                                if (number >= 400) {
                                    assert.fail(number, '400', 'Failing status code', '<');
                                }
                            },
                            send: function(asset) {
                                fs.readFile('test/public/scripts/compiled/main2.js', function(err, data) {
                                    assert.equal(asset.toString().trim(), data.toString().trim());
                                    done();
                                });
                            },
                            redirect: function(url) {
                                assert.fail('called redirect to ' + url, 'called send', 'Incorrect routing', ', instead');
                            }
                        };

                        next = function() {
                            assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
                        };

                        midware(req, res, next);
                    }, 5000);
                });
            });

            it('should also recompile dependents for files added after load', function(done) {
                var middleware = electricity.static('test/public', {
                    uglifyjs: { enabled: false }
                });

                setTimeout(function() {
                    var original = fs.createReadStream('test/public/scripts/main.js');
                    var copy = fs.createWriteStream('test/public/scripts/main2.js');

                    original.on('end', function() {
                        setTimeout(function() {
                            fs.writeFile('test/public/scripts/dep1.js', 'console.log(\'dep1\');\n', function() {
                                setTimeout(function() {
                                    req.path = '/scripts/main2-c6c2afd452d98199939fb7c292c5474b.js';

                                    res = {
                                        set: function() {},
                                        status: function(number) {
                                            if (number >= 400) {
                                                assert.fail(number, '400', 'Failing status code', '<');
                                            }
                                        },
                                        send: function(asset) {
                                            fs.readFile('test/public/scripts/compiled/main.js', function(err, data) {
                                                assert.equal(asset.trim(), data.toString().trim());
                                                done();
                                            });
                                        },
                                        redirect: function(url) {
                                            assert.fail('called redirect to ' + url, 'called send', 'Incorrect routing', ', instead');
                                        }
                                    };

                                    next = function() {
                                        assert.fail('called next', 'called send', 'Incorrect routing', ', instead');
                                    };

                                    middleware(req, res, next);
                                }, 1000);
                            });
                        }, 1000);
                    });

                    original.pipe(copy);
                }, 1000);
            });

            after(function(done) {
                fs.unlink('test/public/scripts/main2.js', function(err) {
                    if (err) {
                        throw err;
                    }

                    done();
                });
            });
        });
    });
});
