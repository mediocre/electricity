electricity
===========

Static file serving that will make your hair stand on end

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
    uglifyjs: { // Object passed straight to uglify-js options
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
    uglifyjs: {
        enabled: true,
        compress: {
            sequences: false
        }
    },
    uglifycss: {
        enabled: true
    }
};
```

###In your views:

```ejs
<img src="<%= electricity.url('apple-touch-icon-precomposed.png') %>" />
<link href="<%= electricity.url('styles/include_path.css') %>" rel="Stylesheet" />
<script src="<%= electricity.url('scripts/main.js') %>"></script>
```

##License

Unless otherwise noted, Apache 2.0

###Test SCSS files

All .scss files in `test/public/styles` fall under the following license:

```
Copyright (c) 2013 Andrew Nesbitt

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
