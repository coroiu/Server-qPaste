var express = require('express');
var formidable = require('formidable');
var util = require('util');
var uuid = require('node-uuid');
var fs = require('fs');
var cons = require('consolidate');
var mime = require('mime');
var MongoStore = require('connect-mongo')(express);
//var passport = require('passport'), LocalStrategy = require('passport-local').Strategy;
var storage = require('./amazons3-connect');
var homepage = require('./homepage');
var database = require('./database');
var app = express();
//var sanitize = require('validator').sanitize; //Thought I'd use it, but regreted it. May come in handy later, commented untill then

var globals = {
	limit: process.env.limit || '20',
	host: process.env.host || "http://localhost:1337",
	statistics: {
		uploads: 0
	}
};

var callbacks = {};
var s3path = "http://s3.amazonaws.com/qpaste/uploads/";
var s3resourcepath = "/uploads/";

/*jslint es5: true */
app.use(express.static(__dirname + '/public'));
app.engine('html', cons.hogan);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
app.use(express.cookieParser());
app.use(express.session({
	store: new MongoStore(database.config()),
	secret: 'imissmycat',
	cookie: {  path: '/', maxAge: 2629743830 } //1 month
}));
app.use(app.router);

storage.setLimit(parseInt(globals.limit, 10));
database.connect();

//Hook homepage into express
//homepage.passport(passport);
homepage.hook(globals, app);

//Main preview page
app.get('/get/:uid', function(req, res) {
	database.getUpload(req.params.uid, function (upload) {
		if (upload === null) {
			res.statusCode = 404;
			res.render('get-error', {
				title: 'Not found'
			});
		} else {
			res.render('get', {
				title: 'Get paste',
				uid: upload.uid,
				//time: timeleft(timediff(upload.time)),
				time: timeleft(timediff(upload.expire)),
				timestamp: timediff(upload.expire),
				link: s3path + upload.uid,
				available: upload.uploaded
			});
		}
	});
});

//Ajax content provider
app.get('/content/:uid', function (req, res) {
	database.getUpload(req.params.uid, function (upload) {
		if (upload === null) {
			res.statusCode = 404;
			res.render('get-error', {
				title: 'Not found'
			});
		} else if (!upload.uploaded) {
			req.connection.setTimeout(3600000); //1 Hour timeout
			req.socket.setTimeout(3600000);
			callbacks[upload.uid].push(function () {
				ajaxContent(req, res, upload);
			});
		} else {
			ajaxContent(req, res, upload);
		}
	});
});

function ajaxContent (req, res, upload) {
	switch (filetype(upload.mimetype)) {
		case 'image':
			res.render('content-image', {
				link: upload.filepath
			});
			break;
		case 'embedd':
			res.render('content-embedd', {
				link: storage.getSignedS3Url( upload.resourcepath, 'inline;', Math.round((upload.time + 3600000)/1000) ),
				mime: upload.mimetype
			});
			break;
		case 'text':
			res.render('content-text', {
				link: upload.filepath
			});
			break;
		case 'audio':
			res.render('content-audio', {
				link: upload.filepath,
				mime: upload.mimetype
			});
			break;
		default:
			res.render('content-dl', {
				link: upload.filepath,
				content: upload.filepath
			});
	}
}

// API
app.post('/upload-token', function (req, res, next) {
	var form = new formidable.IncomingForm();

	form.parse(req, function (err, fields, files) {
		if (!fields.filename || !fields.mime) {
			var error = new Error('Fields missing.');
			error.name = "Fields missing";
			error.status = 400;
			return next(error);
		}

		uid = uuid.v4();

		res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
		res.end(JSON.stringify({
			token: uid,
			link: globals.host + "/get/" + uid,
			storage: storage.getS3Policy("uploads/" + uid, fields.filename, fields.mime)
		}));

		callbacks[uid] = [];
		/*tokens[guid] = {
			filepath: '', // URL to file
			resourcepath: '', // Relative Amazon S3 resource path (same as filepath but relative to http://s3.amazonaws.com/qpaste/...)
			filename: fields.filename, // Original filename
			mimetype: (fields.mime == 'application/octet-stream' ? mime.lookup(fields.filename) : fields.mime), // Mime-type
			uploaded: false, // Is file uploaded yet?
			callback: [], // Callbacks for when the upload is complete
			time: new Date().getTime() // Time when uploaded (epoch)
		};*/
		database.newUpload(uid, fields.filename, (fields.mime == 'application/octet-stream' ? mime.lookup(fields.filename) : fields.mime));
		//Set timeout for file deletion
		//setTimeout(function(){ DeleteFile(tokens[guid]); }, 60*60*1000);
	});
});

app.post('/upload-done', function (req, res, next) {
	var form = new formidable.IncomingForm();

	form.parse(req, function(err, formFields, files) {
		if (!formFields.token) {
			var error = new Error('Token missing.');
			error.name = "Token missing";
			error.status = 400;
			return next(error);
		}

		var updateFields = {
			filepath: s3path + formFields.token,
			resourcepath: s3resourcepath + formFields.token,
			uploaded: true
		};
		
		database.updateUpload(formFields.token, updateFields);
		for (i = 0; i < callbacks.length; i++) {
			callbacks[formFields.token][i]();
		}

		//Set timeout for file deletion
		//setTimeout(function(){ DeleteFile(tokens[guid]); }, 60*60*1000);
		globals.statistics.uploads++;
	});

	res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
	res.end("");
});

app.post('/user/login', function (req, res, next) {
	var form = new formidable.IncomingForm();
	form.parse(req, function(err, formFields, files) {
		if (!formFields.username || !formFields.password) {
			var error = new Error('Fields missing.');
			error.name = "Fields missing";
			error.status = 400;
			return next(error);
		}
		
		database.authenticateUser(formFields.username, formFields.password, function (err, user) {
			if (err) { return next(err); }
			else if (user === null) {
				var error = new Error('Wrong username or password.');
				error.name = "Wrong username or password.";
				error.status = 401;
				return next(error);
			} else {
				res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
				res.end(util.inspect(user));
				req.session.userid = user._id;
				req.session.save();
			}
		});
	});
});

app.post('/user/register', function (req, res, next) {
	var form = new formidable.IncomingForm();
	form.parse(req, function(err, formFields, files) {
		if (!formFields.username || !formFields.password) {
			var error = new Error('Fields missing.');
			error.name = "Fields missing";
			error.status = 400;
			return next(error);
		}

		database.registerUser(formFields.username, formFields.password, function (err) {
			if (err) { return next(err); }
			res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
			res.end('');
		});
	});
});

app.get('/user', function (req, res, next) {
	var id = req.session.userid;
	console.log(req.session);
	if (id) {
		database.getUser(id, function (err, user) {
			if (err) { return next(err); }
			res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
			res.end(JSON.stringify({
				logged_in: true,
				username: user.username
			}));
		});
	} else {
		res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
		res.end(JSON.stringify({
			logged_in: false
		}));
	}
});

// ERROR HANDLING
app.use(function(err, req, res, next) {
	switch (err.status) {
		case 400:
		case 401:
			res.writeHead(err.status, {'Content-type': 'text/plain'});
			res.end(err.name);
			break;
		case 413:
			res.writeHead(err.status, {'Content-type': 'text/plain'});
			res.end('File too large. Max filesize is: ' + globals.limit);
			break;
		default:
			res.writeHead(500, {'Content-type': 'text/plain'});
			res.write('Unknown error occurred: \n\n');
			res.end(util.inspect(err));
	}
});

function DeleteFile(token) {
	//Amazon S3 delete not implemented
	//Files delete themselves after 1 day

    /*try {
        fs.unlink(tokens[token].filename);
    } catch (ex) {

    }*/

    tokens[token] = {};
}

function isAvailable(token) {
	try {
		if (tokens[token].filepath !== '') {
			return true;
		}
		else
			return false;
	} catch (ex) {
		return false;
	}
}

function timediff(time) {
	now = new Date().getTime();
	kickoff = time.getTime();
	return kickoff - now;
}

function timeleft(diff) {
	days  = Math.floor( diff / (1000*60*60*24) );
	hours = Math.floor( diff / (1000*60*60) );
	mins  = Math.floor( diff / (1000*60) );
	secs  = Math.floor( diff / 1000 );

	dd = days;
	hh = hours - days  * 24;
	mm = mins  - hours * 60;
	ss = secs  - mins  * 60;

	return hh + "h " + mm + "m " + ss + "s";
}

function filetype(mimetype) {
	switch (mimetype) {
		case 'image/bmp':
		case 'image/x-windows-bmp':
		case 'image/gif':
		case 'image/jpeg':
		case 'image/png':
			return 'image';
		case 'application/x-shockwave-flash':
		case 'application/pdf':
			return 'embedd';
		case 'application/x-javascript':
		case 'application/javascript':
		case 'application/ecmascript':
		case 'text/javascript':
		case 'text/ecmascript':
		case 'text/html':
		case 'text/css':
		case 'text/x-asm':
		case 'text/asp':
		case 'text/x-c':
		case 'text/x-fortran':
		case 'text/x-h':
		case 'text/x-script':
		case 'text/webviewhtml':
		case 'text/x-pascal':
		case 'text/pascal':
		case 'text/x-script.perl':
		case 'text/x-script.perl-module':
		case 'text/x-script.phyton':
		case 'text/x-java-source':
		case 'text/x-csharp':
		case 'text/plain':
			return 'text';
		case 'audio/mp3':
		case 'audio/mpeg':
		case 'audio/ogg':
		case 'audio/wav':
			return 'audio';
		default:
			return 'download';
	}
}
app.listen(1337);