// Separate module for main homepage

(function() {
	var strings = {
		metatitle: 'qPaste - Instant Cloud Sharing',
		description: 'Upload and share any file using the fast and reliable online cloud.\nDownload the desktop client to upload any clipboard data.\nEverything completely free, instantly available.',
		author: 'Andreas Coroiu'
	};

	var passport = null;

	module.exports.passport = function (_passport) {
		passport = _passport;
	};

	module.exports.hook = function (globals, app) {
		app.get('/', function(req, res){
			res.render('home', {
				title: 'Instant Cloud Sharing',
				home: true,
				strings: strings,
				globals: globals,
				partials: {
					masthead: 'partials/masthead',
					footer: 'partials/footer',
					jsimports: 'partials/jsimports'
				}
			});
		});

		app.get('/about', function(req, res){
			res.render('about', {
				title: 'About',
				about: true,
				strings: strings,
				globals: globals,
				partials: {
					masthead: 'partials/masthead',
					footer: 'partials/footer',
					jsimports: 'partials/jsimports'
				}
			});
		});

		app.get('/api', function(req, res) {
			res.render('api', {
				title: 'API Documentation',
				api: true,
				strings: strings,
				globals: globals,
				partials: {
					masthead: 'partials/masthead',
					footer: 'partials/footer',
					jsimports: 'partials/jsimports'
				}
			});
		});

		/*app.get('/statistics', function(req, res) {
			res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-cache' });
			res.end(util.inspect(statistics));
		});*/

		app.get('/newhome', function(req, res) {
			res.render('newhome', {
				title: 'New homepage',
				newhome: true,
				strings: strings,
				globals: globals,
				hideHome: true,
				partials: {
					masthead: 'partials/masthead',
					footer: 'partials/footer',
					jsimports: 'partials/jsimports',
					menu: 'partials/menu'
				}
			});
		});
	};
}());