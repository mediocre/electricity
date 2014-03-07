var assert = require('assert');
var fs = require('fs');
var electricity = require('../lib/index');
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
        }
    };
    res = {
        set: function() {},
        status: function(number) {
            if (number >= 400) {
                assert.fail(number, "400", "Failing status code", "<");
            }
        },
        send: function() {
            assert.fail('Called send', 'called next', 'Incorrect routing', ', instead');
        }
    }
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
                    assert.fail(number, "400", "Failing status code", "<");
                }
            };
            midware(req, res, next);
        });
        it('calls res.send with asset contents if the asset does exist', function(done) {
            req.path = '/robots.txt';
            res = {
                set: function(){},
                status: function(number) {
                    if (number >= 400) {
                        assert.fail(number, "400", "Failing status code", "<");
                    }
                },
                send: function(asset) {
                    fs.readFile('test/public/robots.txt', function(err, data) {
                        assert(data, asset);
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
                        assert.fail(number, "400", "Failing status code", "<");
                    }
                },
                send: function(asset) {
                    fs.readFile('test/public/robots.txt', function(err, data) {
                        assert(data, asset);
                        done();
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
                assert('function', typeof req.app.locals.electricity.url);
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
            assert('robots-ca121b5d03245bf82db00d14cee04e22.txt', req.app.locals.electricity.url('robots.txt'));
            done();
        });
        it('should leave the path alone if the asset is not present', function(done) {
            assert('notthere.png', req.app.locals.electricity.url('notthere.png'));
            done();
        });
    });
});
