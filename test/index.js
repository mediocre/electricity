var assert = require('assert');
var electricity = require('../lib/index');

describe('electricity.static', function() {
    it('reads files', function(done) {
        console.log(electricity.static('test/public'));
        done();
    });
});