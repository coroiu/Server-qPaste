// Separate module for main homepage

(function() {
	var metatitle = 'qPaste - Instant Cloud Sharing';
	var description = 'Upload and share any file using the fast and reliable online cloud.\nDownload the desktop client to upload any clipboard data.\nEverything completely free, instantly available.';
	var author = 'Andreas Coroiu';

	module.exports.hook = function (app) {
		app.get('/', function(req, res){
			res.render('home', {
				title: 'Home',
				metatitle: metatitle,
				description: description,
				author: author,
				limit: limit,
				partials: {
					footer: 'footer',
					masthead: 'masthead'
				}
			});
		});

		app.get('/about', function(req, res){
			res.render('about', {
				title: 'About',
				metatitle: metatitle,
				description: description,
				author: author,
				limit: limit,
				partials: {
					footer: 'footer',
					masthead: 'masthead'
				}
			});
		});

		app.get('/statistics', function(req, res) {
			res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-cache' });
			res.end(util.inspect(statistics));
		});
	};
}());