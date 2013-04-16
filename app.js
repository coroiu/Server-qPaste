var express = require('express');
var formidable = require('formidable');
var util = require('util');
var uuid = require('node-uuid');
var fs = require('fs');
var cons = require('consolidate');
var mime = require('mime');
var storage = require('./amazons3-connect');
var homepage = require('./homepage');
var app = express();
//var sanitize = require('validator').sanitize; //Thought I'd use it, but regreted it. May come in handy later, commented untill then

var tokens = {};
var s3path = "http://s3.amazonaws.com/qpaste/uploads/";
var s3resourcepath = "/uploads/";
var host = process.env.host || "http://localhost:1337";
var limit = process.env.limit || '20';

/*jslint es5: true */
app.use(express.static(__dirname + '/public'));
app.engine('html', cons.hogan);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');

storage.setLimit(parseInt(limit, 10));

//Statistics
var statistics = {
	uploads: 0
};

//Hook homepage into express
homepage.hook(app);

//Main preview page
app.get('/get/:uid', function(req, res) {
	var uid = req.params.uid;
	if (tokens[uid] === undefined || tokens [uid].time === undefined) {
		res.statusCode = 404;
		res.render('get-error', {
			title: 'Not found'
		});
	} else {
		res.render('get', {
			title: 'Get paste',
			uid: uid,
			time: timeleft(timediff(tokens[uid].time)),
			timestamp: timediff(tokens[uid].time),
			link: s3path + uid,
			available: isAvailable(uid)
		});
	}
});

//Ajax content provider
app.get('/content/:uid', function(req, res) {
	var uid = req.params.uid;
	if (tokens[uid] === undefined || tokens [uid].time === undefined) {
		res.statusCode = 404;
		res.render('get-error', {
			title: 'Not found'
		});
	} else if (tokens[uid].filepath === '') {
		req.connection.setTimeout(3600000); //1 Hour timeout
		req.socket.setTimeout(3600000);
		tokens[uid].callback.push(function () {
			ajaxContent(req, res, uid);
		});
	} else {
		ajaxContent(req, res, uid);
	}
});

function ajaxContent(req, res, uid) {
	switch (filetype(tokens[uid].mimetype)) {
		case 'image':
			res.render('content-image', {
				link: tokens[uid].filepath
			});
			break;
		case 'embedd':
			res.render('content-embedd', {
				link: storage.getSignedS3Url( tokens[uid].resourcepath, 'inline;', Math.round((tokens[uid].time + 3600000)/1000) ),
				mime: tokens[uid].mimetype
			});
			break;
		case 'text':
			res.render('content-text', {
				link: tokens[uid].filepath
			});
			break;
		case 'audio':
			res.render('content-audio', {
				link: tokens[uid].filepath,
				mime: tokens[uid].mimetype
			});
			break;
		default:
			res.render('content-dl', {
				link: tokens[uid].filepath,
				content: tokens[uid].filepath
			});
	}
}

// API
app.post('/upload-token', function(req, res, next) {
	var form = new formidable.IncomingForm();

	form.parse(req, function(err, fields, files) {
		if (!fields.filename || !fields.mime) {
			var error = new Error('Fields missing.');
			error.name = "Fields missing";
			error.status = 400;
			return next(error);
		}

		guid = uuid.v4();

		res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
		res.end(JSON.stringify({
			token: guid,
			link: host + "/get/" + guid,
			storage: storage.getS3Policy("uploads/" + guid, fields.filename, fields.mime)
		}));
		tokens[guid] = {
			filepath: '', // URL to file
			resourcepath: '', // Relative Amazon S3 resource path (same as filepath but relative to http://s3.amazonaws.com/qpaste/...)
			filename: fields.filename, // Original filename
			mimetype: (fields.mime == 'application/octet-stream' ? mime.lookup(fields.filename) : fields.mime), // Mime-type
			uploaded: false, // Is file uploaded yet?
			callback: [], // Callbacks for when the upload is complete
			time: new Date().getTime() // Time when uploaded (epoch)
		};
		//Set timeout for file deletion
		//setTimeout(function(){ DeleteFile(tokens[guid]); }, 60*60*1000);
	});
});

app.post('/upload-done', function(req, res, next) {
	var form = new formidable.IncomingForm();

	form.parse(req, function(err, fields, files) {
		if (!fields.token) {
			var error = new Error('Token missing.');
			error.name = "Token missing";
			error.status = 400;
			return next(error);
		}

		tokens[fields.token].filepath = s3path + fields.token;
		tokens[fields.token].resourcepath = s3resourcepath + fields.token;
		
		for (i = 0; i < tokens[fields.token].callback.length; i++) {
			tokens[fields.token].callback[i]();
		}

		//Set timeout for file deletion
		setTimeout(function(){ DeleteFile(tokens[guid]); }, 60*60*1000);
		statistics.uploads++;
	});

	res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
	res.end("");
});

// ERROR HANDLING
app.use(function(err, req, res, next) {
	switch (err.status) {
		case 400:
			res.writeHead(err.status, {'Content-type': 'text/plain'});
			res.end(err.name);
			break;
		case 413:
			res.writeHead(err.status, {'Content-type': 'text/plain'});
			res.end('File too large. Max filesize is: ' + limit);
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
	kickoff = time;
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

	return mm + "m " + ss + "s";
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