var express = require('express');

var electricity = require('../lib/index');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.use(
    electricity.static((__dirname + '/public'), {
        snockets: { ignore: /compiled/ }
    })
);

app.get('/', function(req, res) {
    res.render('index');
});

app.listen(3001);