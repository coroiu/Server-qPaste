var express = require('express');
var formidable = require('formidable');
var util = require('util');
var uuid = require('node-uuid');
var fs = require('fs');
var cons = require('consolidate');
var app = express();

var tokens = {};
var host = process.env.host || "http://localhost:1337";
var limit = process.env.limit || '20mb';

app.use(express.static(__dirname + '/public'));
app.use(express.limit(limit));
app.engine('html', cons.hogan);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');

// VIEWS
app.get('/', function(req, res){
	res.render('index', {
		title: 'Home'
	});
});

//Main preview page
app.get('/get/:uid', function(req, res) {
	var uid = req.params.uid;
	if (tokens[uid] == undefined || tokens [uid].time == undefined) {
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
			link: '/dl/' + uid,
			available: isAvailable(uid)
		});
	}
});

//Ajax content provider
app.get('/content/:uid', function(req, res) {
	var uid = req.params.uid;
	if (tokens[uid] == undefined || tokens [uid].time == undefined) {
		res.statusCode = 404;
		res.render('get-error', {
			title: 'Not found'
		});
	} else if (tokens[uid].filepath == '') {
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
				link: '/dl-inline/' + uid
			});
			break;
		case 'embedd':
			res.render('content-embedd', {
				link: '/dl-inline/' + uid
			});
			break;
		case 'text':
			res.render('content-text', {
				text: fs.readFileSync(tokens[uid].filepath)
			});
			break;
		default: 
			res.render('content-dl', {
				link: '/dl/' + uid,
				content: '/dl/' + uid
			});
	}
}

// API 
app.get('/upload-token', function(req, res, next) {
	guid = uuid.v1();

	res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
	res.end(JSON.stringify({
		token: guid,
		link: host + "/get/" + guid
	}));
	tokens[guid] = {
        filepath: '',
        filename: '',
        mimetype: '',
        uploaded: false,
        callback: [],
        time: new Date().getTime()
    };
    //Set timeout for file deletion
    setTimeout(function(){ DeleteFile(tokens[guid]); }, 60*60*1000);
});

app.post('/upload', function (req, res, next) {
	var form = new formidable.IncomingForm();

	form.parse(req, function(err, fields, files) {
		if (!fields.token) {
			var error = new Error('Token missing');
			error.name = "Token missing";
			error.status = 400;
			return next(error);
		}

		res.writeHead(200, {'Content-type': 'text/plain'});
		res.write('received upload:\n\n');
		res.end(util.inspect({fields: fields, files: files}));

        tokens[fields.token].filepath = files.upload.path;
        tokens[fields.token].filename = files.upload.name;
        tokens[fields.token].mimetype = files.upload.type;
        tokens[fields.token].uploaded = true;

        for (i = 0; i < tokens[fields.token].callback.length; i++) {
        	tokens[fields.token].callback[i]();
        }
	});
});

//Inline file provider
app.get('/dl-inline/:uid', function (req, res, next) {
	var uid = req.params.uid;
	try {
	    var img = fs.readFileSync(tokens[uid].filepath);
	    res.writeHead(200, {
	        'Content-Type': tokens[uid].filename,
	        'Content-Disposition': 'inline; filename="'+ tokens[uid].filename +'"'
	    });
	    res.end(img, 'binary');
	} catch (exception) {
	    res.writeHead(404, {'Content-Type': 'text/plain'});
	    res.end('Woops, looks like the file cannot be served. Maybe the upload isn\'t done yet or maybe the file expired?');
	}
});

//Attachment file provider
app.get('/dl/:uid', function (req, res, next) {
	var uid = req.params.uid;
	try {
	    var img = fs.readFileSync(tokens[uid].filepath);
	    res.writeHead(200, {
	        'Content-Type': tokens[uid].filename,
	        'Content-Disposition': 'attachment; filename="'+ tokens[uid].filename +'"'
	    });
	    res.end(img, 'binary');
	} catch (ex) {
	    res.writeHead(200, {'Content-Type': 'text/plain'});
	    res.write('Woops, looks like the file cannot be served. Maybe the upload isn\'t done yet or maybe the file expired?\n\n');
	    res.end('Exception: ' + util.inspect(ex));
	}
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
    try {
        fs.unlink(tokens[token].filename);
    } catch (ex) {

    }
    tokens[token] = {};
    console.log("Removed file: " + token);
}

function isAvailable(token) {
	try {
		if (tokens[token].filepath != '') {
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
			break;
		case 'application/x-shockwave-flash':
		case 'application/pdf':
			return 'embedd';
			break;
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
		case 'text/plain':
			return 'text'
			break;
		default:
			return 'download';
	}
}
app.listen(1337);