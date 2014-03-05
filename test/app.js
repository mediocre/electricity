var express = require('express');
var electricity = require('../lib/index');

var app = express();

app.use(electricity.static(__dirname + '/public'));
app.listen(3000);
