Electricity
===========

An alternative to the built-in Express middleware for serving static files.
Electricity follows a number of best practices for making web pages fast.

The built-in Express middleware for serving static files is great if you need basic support for serving static files.
But if you want to follow [Best Practices for Speeding Up Your Web Site](http://developer.yahoo.com/performance/rules.html) you need something that can concat, gzip, and minify your static files. Electricity does all this and more without the need to create a complicated build process using Grunt or a similar build tool.

##Basic Usage

Typically, in an Express app you'd serve static files using the built-in middleware. Like this:

```javascript
var express = require('express');

app.use(express.static(__dirname + '/public'));
```

To begin using Electricity simply replace the default static middleware:

```javascript
var express = require('express');
var electricity = require('electricity');

app.use(electricity.static(__dirname + '/public'));
```

A common best practice for serving static files is to set a far future `Expires` header: http://developer.yahoo.com/performance/rules.html#expires

When you set a far future `Expires` header you have to change the file name whenever the contents of the file change.
Electricity makes this easy for you by automatically adding an MD5 hash of the file's contents to the file name.
You have access to this file name using a view helper method that builds URLs for you.
If you're using EJS it looks something like this:

```ejs
<img src="<%= electricity.url('apple-touch-icon-precomposed.png') %>" />
<link href="<%= electricity.url('styles/style.css') %>" rel="stylesheet" />
<script src="<%= electricity.url('scripts/script.js') %>"></script>
```

Which ultimately gets rendered as something like this:

```html
<img src="/apple-touch-icon-precomposed-d131dd02c5e6eec4.png" />
<link href="/styles/style-693d9a0698aff95c.css')" rel="stylesheet" />
<script src="/scripts/script-2fcab58712467eab.js"></script>
```

##Features

Electricity comes with a variety of features to help make your web pages fast without the need to setup a complicated build process.

- **HTTP Headers:** Electricity sets proper `Cache-Control`, `ETag`, `Expires`, and `Last-Modified` headers to help avoid unnecessary HTTP requests on subsequent page views.
- **Minification of JavaScript and CSS:** Electricity minifies JavaScript and CSS files in order to improve response time by reducing file sizes.
- **Gzip:** Electricity gzips many content types (CSS, HTML, JavaScript, JSON, plaintext, XML) to reduce response sizes.
- **Snockets:** Electricity supports Snockets (A JavaScript concatenation tool for Node.js inspired by Sprockets). You can use Snockets to combine multiple JavaScript files into a single JavaScript file which helps minimize HTTP requests.
- **Sass:** Electricity supports Sass (Syntactically Awesome Style Sheets). Among other features, Sass can be used to combine multiple CSS files into a single CSS file which helps minimize HTTP requests.
- **CDN Hostname:** If you're using a CDN (Content Delivery Network) that supports a custom origin (like Amazon CloudFront) you can specify the hostname you'd like Electricity to use when generating URLs.
- **Watch:** Electricity watches for changes to your static files and automatically serves the latest content without the need to restart your web server (useful during development). Electricity also understands Sass and Snockets dependency graphs to ensure the parent file contents are updated if a child file has been modified.

##Advanced Usage

Default options look like this:

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

You can override the default options to look something like this:

```javascript
var options = {
    hostname: 'cdn.example.com', // CDN hostname
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
};
```

Pass options to the middleware like this:

```javascript
app.use(electricity.static(__dirname + '/public', options));
```

##CSS asset URL's

Electricity will automatically rewrite paths in CSS to use absolute paths, hashes, and, if specified, a CDN hostname.  For example, using the default options below, this in the public/styles directory:

```css
background-image: url('../apple-touch-icon-precomposed.png');
```

becomes this to allow caching and avoid unnecessary redirects:

```css
background-image: url('/apple-touch-icon-precomposed-d131dd02c5e6eec4.png');
```

##CDN Hostname

If you specify a hostname like this:
```javascript
var express = require('express');
var electricity = require('electricity');

var options = {
    hostname: 'cdn.example.com'
};

app.use(electricity.static(__dirname + '/public'), options);
```

Then render URLs using the view helper like this:
```ejs
<img src="<%= electricity.url('apple-touch-icon-precomposed.png') %>" />
<link href="<%= electricity.url('styles/style.css') %>" rel="stylesheet" />
<script src="<%= electricity.url('scripts/script.js') %>"></script>
```

Your HTML will ultimately get rendered using protocol-relative URLs like this:
```html
<img src="//cdn.example.com/apple-touch-icon-precomposed-d131dd02c5e6eec4.png" />
<link href="//cdn.example.com/styles/style-693d9a0698aff95c.css')" rel="stylesheet" />
<script src="//cdn.example.com/scripts/script-2fcab58712467eab.js"></script>
```
