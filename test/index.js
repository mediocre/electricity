const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');

const bufCompare = require('buffer-compare');
const fse = require('fs-extra');

const electricity = require('../lib/index');

var req;
var res;
var next;
var midware;

describe.skip('electricity.static', function() {
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

        describe('react support', function() {
            it('should compile jsx files', function(done) {
                var jsxMiddleware = electricity.static('test/public', {
                    jsx: { ignore: 'compiled' },
                    snockets: { enabled: false },
                    uglifyjs: { enabled: false },
                    watch: { enabled: false }
                });

                req.path = '/jsx/reactTest-f1cfa72ae9ee1f855a5ffb37bbf4fb21.js';

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

                req.path = '/jsx/reactSnockets-70d4deae25721bbf7e4df2d758eba7c4.js';

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
        it('should preserve query and targets', function(done) {
            midware(req, res, next);
            assert.equal(req.app.locals.electricity.url('/robots.txt?abc'), '/robots-ca121b5d03245bf82db00d14cee04e22.txt?abc');
            assert.equal(req.app.locals.electricity.url('/robots.txt#abc'), '/robots-ca121b5d03245bf82db00d14cee04e22.txt#abc');
            assert.equal(req.app.locals.electricity.url('/robots.txt?abc#def'), '/robots-ca121b5d03245bf82db00d14cee04e22.txt?abc#def');
            assert.equal(req.app.locals.electricity.url('/robots.txt?#def'), '/robots-ca121b5d03245bf82db00d14cee04e22.txt?#def');
            done();
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
                        req.path = '/scripts/main-9a3f45f17925fd457ca7ffb85572f139.js';

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
                                    req.path = '/scripts/main2-688c8244d9557348e169930216cf6f19.js';

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

describe('electricity.static', function() {
    it('should default to "public" if a directory isn’t specified', function(done) {
        const middleware = electricity.static();

        const req = {
            method: 'GET',
            path: '/robots.txt'
        };

        const next = function() {
            done();
        };

        middleware(req, null, next);
    });

    it('should return a function', function() {
        const middleware = electricity.static('test/public');
        assert.strictEqual(typeof middleware, 'function');
    });

    it('should call next middleware when the specified file can not be found', function(done) {
        const middleware = electricity.static('test/public');

        const req = {
            method: 'GET',
            path: '/not-found.txt'
        };

        const next = function(err) {
            assert.ifError(err);
            done();
        };

        middleware(req, null, next);
    });

    it('should call next middleware when the specified URL is a directory', function(done) {
        const middleware = electricity.static('test/public');

        const req = {
            method: 'GET',
            path: '/scripts'
        };

        const next = function(err) {
            assert.ifError(err);
            done();
        };

        middleware(req, null, next);
    });

    it('should call next middleware with an error if the specified URL is too long', function(done) {
        const middleware = electricity.static('test/public');

        const req = {
            method: 'GET',
            path: crypto.randomBytes(256).toString('hex')
        };

        const next = function(err) {
            assert(err);
            done();
        };

        middleware(req, null, next);
    });

    describe('gzip', function() {
        it('should gzip TXT files for clients that accept gzip', function(done) {
            const middleware = electricity.static('test/public');

            const req = {
                get: function() {},
                headers: {
                    'accept-encoding': 'gzip, deflate'
                },
                method: 'GET',
                path: '/lorem-ipsum-1866425c51a663f0e9c1b8214c2ba186f6c827e4.txt'
            };

            const res = {
                send: function() {},
                set: function(field, value) {
                    if (field === 'content-encoding' && value === 'gzip') {
                        done();
                    }
                }
            };

            middleware(req, res);
        });

        it('should not gzip TXT files for clients that do not accept gzip', function(done) {
            const middleware = electricity.static('test/public');

            const req = {
                get: function() {},
                headers: {},
                method: 'GET',
                path: '/lorem-ipsum-1866425c51a663f0e9c1b8214c2ba186f6c827e4.txt'
            };

            const res = {
                send: function() {
                    done();
                },
                set: function(field, value) {
                    if (field === 'content-encoding' && value === 'gzip') {
                        assert.fail();
                    }
                }
            };

            middleware(req, res);
        });

        it('should not gzip PNG files', function(done) {
            const middleware = electricity.static('test/public');

            const req = {
                get: function() {},
                method: 'GET',
                path: '/apple-touch-icon-precomposed-217316d510b3122f64bd75f2dc0dcdba6c4786d5.png'
            };

            const res = {
                send: function() {
                    done();
                },
                set: function(field, value) {
                    if (field === 'content-encoding' && value === 'gzip') {
                        assert.fail();
                    }
                }
            };

            middleware(req, res);
        });
    });

    describe('hashify', function() {
        it('should hashify by default', function(done) {
            const middleware = electricity.static('test/public');

            const req = {
                method: 'GET',
                path: '/robots.txt'
            };

            const res = {
                redirect: function(path) {
                    assert.strictEqual(path, '/robots-423251d722a53966eb9368c65bfd14b39649105d.txt');

                    const req = {
                        get: function() {},
                        method: 'GET',
                        path
                    };

                    const res = {
                        send: function(body) {
                            fs.readFile('test/public/robots.txt', function(err, expected) {
                                assert(Buffer.compare(body, expected) === 0);
                                done();
                            });
                        },
                        set: function() {}
                    };

                    middleware(req, res);
                },
                set: function() {}
            };

            middleware(req, res);
        });

        it('should not hashify if disabled', function(done) {
            const middleware = electricity.static('test/public', {
                hashify: false
            });

            const req = {
                get: function() {},
                method: 'GET',
                path: '/robots.txt'
            };

            const res = {
                set: function() {},
                status: function(code) {
                    assert.strictEqual(code, 200);
                },
                send: function(body) {
                    fs.readFile('test/public/robots.txt', function(err, expected) {
                        assert(Buffer.compare(body, expected) === 0);
                        done();
                    });
                }
            };

            middleware(req, res);
        });

        it('should not hashify if enabled', function(done) {
            const middleware = electricity.static('test/public', {
                hashify: true
            });

            const req = {
                method: 'GET',
                path: '/robots.txt'
            };

            const res = {
                redirect: function(path) {
                    assert.strictEqual(path, '/robots-423251d722a53966eb9368c65bfd14b39649105d.txt');
                    done();
                },
                set: function() {}
            };

            middleware(req, res);
        });

        it('should hashify files without extensions', function(done) {
            const middleware = electricity.static('test/public');

            const req = {
                method: 'GET',
                path: '/no-extension'
            };

            const res = {
                redirect: function(path) {
                    assert.strictEqual(path, '/no-extension-22596363b3de40b06f981fb85d82312e8c0ed511');
                    done();
                },
                set: function() {}
            };

            middleware(req, res);
        });
    });

    describe('HTTP headers', function() {
        it('should allow additional HTTP headers', function(done) {
            const middleware = electricity.static('test/public', {
                headers: {
                    'access-control-allow-origin': 'https://example.com'
                }
            });

            const req = {
                get: function() {},
                method: 'GET',
                path: '/robots-423251d722a53966eb9368c65bfd14b39649105d.txt'
            };

            const res = {
                send: function() {},
                set: function(value) {
                    if (value['access-control-allow-origin'] === 'https://example.com') {
                        done();
                    }
                }
            };

            middleware(req, res);
        });

        it('should return a 304 for a valid if-none-match header', function(done) {
            const middleware = electricity.static('test/public');

            const req = {
                get: function(field) {
                    if (field === 'if-none-match') {
                        return '"423251d722a53966eb9368c65bfd14b39649105d"';
                    }
                },
                method: 'GET',
                path: '/robots-423251d722a53966eb9368c65bfd14b39649105d.txt'
            };

            const res = {
                set: function() {},
                sendStatus: function(code) {
                    assert.strictEqual(code, 304);
                    done();
                }
            };

            middleware(req, res);
        });

        it('should return etag header for invalid if-none-match header', function(done) {
            const middleware = electricity.static('test/public');

            const req = {
                get: function(field) {
                    if (field === 'if-none-match') {
                        return '"invalid"';
                    }
                },
                method: 'GET',
                path: '/robots-423251d722a53966eb9368c65bfd14b39649105d.txt'
            };

            const res = {
                set: function(headers) {
                    if (headers.etag === '423251d722a53966eb9368c65bfd14b39649105d') {
                        done();
                    }
                },
                send: function() {}
            };

            middleware(req, res);
        });
    });

    describe('HTTP methods', function() {
        it('should handle HEAD requests', function(done) {
            const middleware = electricity.static('test/public');

            const req = {
                get: function() {},
                method: 'HEAD',
                path: '/robots-423251d722a53966eb9368c65bfd14b39649105d.txt'
            };

            const res = {
                sendStatus: function(code) {
                    assert.strictEqual(code, 200);
                    done();
                },
                set: function() {}
            };

            middleware(req, res);
        });

        it('should not handle POST requests', function(done) {
            const middleware = electricity.static('test/public');

            const req = {
                method: 'POST',
                path: '/robots.txt'
            };

            const next = function() {
                done();
            };

            middleware(req, null, next);
        });
    });

    describe('locals', function() {
        it('should register a helper function to generate URLs', function(done) {
            const middleware = electricity.static('test/public');

            const req = {
                app: {
                    locals: {}
                },
                get: function() {},
                method: 'GET',
                path: '/robots-423251d722a53966eb9368c65bfd14b39649105d.txt'
            };

            const res = {
                set: function() {},
                send: function() {
                    assert.strictEqual(typeof req.app.locals.electricity.url, 'function');
                    done();
                }
            };

            middleware(req, res);
        });

        it('should return a hashified URL for a file that was previously requested', function(done) {
            const middleware = electricity.static('test/public');

            const req = {
                app: {
                    locals: {}
                },
                get: function() {},
                method: 'GET',
                path: '/robots-423251d722a53966eb9368c65bfd14b39649105d.txt'
            };

            const res = {
                set: function() {},
                send: function() {
                    assert.strictEqual(req.app.locals.electricity.url('/robots.txt'), '/robots-423251d722a53966eb9368c65bfd14b39649105d.txt');
                    done();
                }
            };

            middleware(req, res);
        });

        it('should return original URL path when hashify is disabled', function(done) {
            const middleware = electricity.static('test/public', {
                hashify: false
            });

            const req = {
                app: {
                    locals: {}
                },
                get: function() {},
                method: 'GET',
                path: '/robots.txt'
            };

            const res = {
                set: function() {},
                send: function() {
                    assert.strictEqual(req.app.locals.electricity.url('/robots.txt'), '/robots.txt');
                    done();
                }
            };

            middleware(req, res);
        });

        it('should return original URL path when the file could not be found', function(done) {
            const middleware = electricity.static('test/public');

            const next = function() {
                assert.strictEqual(req.app.locals.electricity.url('/not-found.txt'), '/not-found.txt');
                done();
            };

            const req = {
                app: {
                    locals: {}
                },
                get: function() {},
                method: 'GET',
                path: '/not-found.txt'
            };

            middleware(req, null, next);
        });
    });

    describe('snockets', function() {
        it('should concatenate files', function(done) {
            const middleware = electricity.static('test/public', {
                snockets: {
                    async: true
                }
            });

            const req = {
                method: 'GET',
                path: '/scripts/snockets/main.js'
            };

            const res = {
                redirect: function(path) {
                    assert.strictEqual(path, '/scripts/snockets/main-07bf096ceb205e7ed26ff09542642cd27d4140e4.js');

                    const req = {
                        get: function() {},
                        method: 'GET',
                        path
                    };

                    const res = {
                        send: function(body) {
                            fs.readFile('test/public/scripts/snockets/main-concatenated.js', function(err, expected) {
                                assert.ifError(err);
                                assert.strictEqual(body, expected.toString());
                                done();
                            });
                        },
                        set: function() {}
                    };

                    middleware(req, res);
                },
                set: function() {}
            };

            middleware(req, res);
        });

        describe('errors', function() {
            let consoleWarn = console.warn;

            before(function() {
                console.warn = function() {};
            });

            it('should return file without concatenation on an error', function(done) {
                const middleware = electricity.static('test/public');

                const req = {
                    get: function() {},
                    method: 'GET',
                    path: '/scripts/snockets/invalid-71f16629fe6cf3e982d38e87ab81c421e4956c8d.js'
                };

                const res = {
                    send: function(body) {
                        fs.readFile('test/public/scripts/snockets/invalid.js', function(err, expected) {
                            assert.ifError(err);
                            assert.strictEqual(body, expected.toString());
                            done();
                        });
                    },
                    set: function() {}
                };

                middleware(req, res);
            });

            it('should call next middleware with an error if the specified URL is too long', function(done) {
                const middleware = electricity.static('test/public');

                const req = {
                    method: 'GET',
                    path: `${crypto.randomBytes(256).toString('hex')}.js`
                };

                const next = function(err) {
                    assert(err);
                    done();
                };

                middleware(req, null, next);
            });

            after(function() {
                console.warn = consoleWarn;
            });
        });
    });
});