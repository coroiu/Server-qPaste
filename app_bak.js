var http = require("http");
var url = require("url");
var formidable = require('formidable');
var util = require('util');
var fs = require('fs');
var uuid = require('node-uuid');

var tokens = {};
var host = process.env.host || "http://localhost:1337";

http.createServer(function (req, res) {
	// Simple path-based request dispatcher
    var path = url.parse(req.url).pathname;
    switch (path) {
        case '/':
	        res.writeHead(200, {'content-type': 'text/html'});
			res.end(
				'<form action="/upload" enctype="multipart/form-data" method="post">'+
				'<input type="text" name="title"><br>'+
				'<input type="file" name="upload" multiple="multiple"><br>'+
				'<input type="submit" value="Upload">'+
				'</form>'
			);
            break;
        case '/upload-token':
        	guid = uuid.v1();

        	res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    		res.end(JSON.stringify({
    			token: guid,
    			link: host + "/download/" + guid
    		}));
        	tokens[guid] = {
                filepath: '',
                filename: '',
                mimetype: ''
            };
            //Set timeout for filedeletion
            setTimeout(function(){ DeleteFile(tokens[guid]); }, 60*60*1000);
        break;
        case '/upload':
            var form = new formidable.IncomingForm();

			form.parse(req, function(err, fields, files) {
				res.writeHead(200, {'content-type': 'text/plain'});
				res.write('received upload:\n\n');
				res.end(util.inspect({fields: fields, files: files}));

                tokens[fields.token].filepath = files.upload.path;
                tokens[fields.token].filename = files.upload.name;
                tokens[fields.token].mimetype = files.upload.type;

                //res.end(util.inspect(tokens));
                    
				/*var img = fs.readFileSync(files.upload.path);
			     res.writeHead(200, {'Content-Type': files.upload.type });
			     res.end(img, 'binary');*/
			});
            break;
        default:
            if (path.indexOf("download") !== -1) {
                try {
                    var token = path.substr(path.lastIndexOf("/") + 1);
                    /*util.inspect(tokens);
                    res.end(token);*/
                    var img = fs.readFileSync(tokens[token].filepath);
                    res.writeHead(200, {
                        //'Content-Type': 'application/octet-stream',
                        'Content-Type': tokens[token].filename,
                        //'Content-Disposition': 'attachment; filename="'+ tokens[token].filename +'"'
                        'Content-Disposition': 'inline; filename="'+ tokens[token].filename +'"'
                    });
                    res.end(img, 'binary');

                    console.log("New file: " + token);
                } catch (exception) {
                    res.writeHead(200, {'Content-Type': 'text/html'});
                    res.end('Woops, looks like the file cannot be served. Maybe the upload isn\'t done yet or maybe the file expired?');
                }
            } else {
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.end('404: ' + url.parse(req.url).pathname);
            }
            break;
    }
}).listen(process.env.VMC_APP_PORT || 1337, null);

function DeleteFile(token) {
    try {
        fs.unlink(tokens[token].filename);
    } catch (ex) {

    }
    delete tokens[token];
    console.log("Removed file: " + token);

}