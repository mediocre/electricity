const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');

const fse = require('fs-extra');

const electricity = require('../lib/index');

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
                    assert.strictEqual(path, '/no-extension-2aae6c35c94fcfb415dbe95f408b9ce91ee846ed');
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

    describe('watch', function() {
        before(function(done) {
            fs.rm('test/public/watch', { recursive: true, force: true }, done);
        });

        it('should watch for file changes', function(done) {
            const middleware = electricity.static('test/public', {
                watch: { enabled: true }
            });

            fse.outputFile('test/public/watch/foo', 'bar', function() {
                const req = {
                    method: 'GET',
                    path: '/watch/foo'
                };

                const res = {
                    redirect: function(path) {
                        assert.strictEqual(path, '/watch/foo-62cdb7020ff920e5aa642c3d4066950dd1f01f4d');

                        const req = {
                            get: function() {},
                            method: 'GET',
                            path
                        };

                        const res = {
                            send: function(body) {
                                assert.strictEqual(body.toString(), 'bar');

                                fse.outputFile('test/public/watch/foo', 'baz', function() {
                                    setTimeout(function() {
                                        const req = {
                                            method: 'GET',
                                            path: '/watch/foo'
                                        };

                                        const res = {
                                            redirect: function(path) {
                                                assert.strictEqual(path, '/watch/foo-bbe960a25ea311d21d40669e93df2003ba9b90a2');

                                                const req = {
                                                    get: function() {},
                                                    method: 'GET',
                                                    path
                                                };

                                                const res = {
                                                    send: function(body) {
                                                        assert.strictEqual(body.toString(), 'baz');
                                                        done();
                                                    },
                                                    set: function() {}
                                                };

                                                middleware(req, res);
                                            },
                                            set: function() {}
                                        };

                                        middleware(req, res);
                                    }, 1000);
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
        });

        after(function(done) {
            fs.rm('test/public/watch', { recursive: true, force: true }, done);
        });
    });
});