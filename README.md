electricity
===========

Static assets that will make your hair stand on end

##Usage

###In your express application:

```javascript
var express = require('express');
var electricity = require('electricity'); // Shuffle feet on carpet

// Example options
var options = {
    hostname: 'cdn.example.com', // CDN hostname to retrieve assets from
    sass: { // Object passed straight to node-sass options
        imagePath: '/images', // Image path for sass image-url helper
        ignore: ['raw', /donotcompile/] // Files to skip compilation on, can be a single argument to String.prototype.match or an array
    },
    snockets: { // Object passed straight to snockets options
        ignore: ['raw', /donotcompile/] // Files to skip compilation on, can be a single argument to String.prototype.match or an array
    },
    uglify: { // Object passed straight to uglify-js options
        enabled: true // Minify Javascript
    },
    uglifycss: { // Object passed straight to uglifycss options
        enabled: true // Minify CSS
    }
}

app.use(electricity.static(__dirname + '/public', options)); // Shock express
```

Default options:

```javascript
var options = {
    hostname: '',
    sass: {},
    snockets: {},
    uglify: {
        enabled: true,
        compress: {
            sequences: false
        }
    },
    uglifycss: {
        enabled: true
    }
}
```

###In your views:

```ejs
<img src="<%= electricity.url('apple-touch-icon-precomposed.png') %>" />
<link href="<%= electricity.url('styles/include_path.css') %>" rel="Stylesheet" />
<script src="<%= electricity.url('scripts/main.js') %>"></script>
```

##License

Apache 2.0
