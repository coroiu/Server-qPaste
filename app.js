var http = require("http");
var url = require("url");
var formidable = require('formidable');
var util = require('util');
var fs = require('fs');

var tokens = {};
var host = "http://localhost:1337";

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
        	guid = GUID();

        	res.writeHead(200, { 'Content-Type': 'application/json' });
    		res.end(JSON.stringify({
    			token: guid,
    			link: host + "/download/" + guid
    		}));
        	tokens[guid] = {
                filepath: '',
                filename: '',
                mimetype: ''
            };
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

                //Set timeout for filedeletion
                setTimeout(function(){ fs.unlink(tokens[token].filename); }, 30*1000);
            } else {
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.end('404: ' + url.parse(req.url).pathname);
            }
            break;
    }
}).listen(process.env.VMC_APP_PORT || 1337, null);


function GUID () {
    var S4 = function () {
        return Math.floor(
                Math.random() * 0x10000 /* 65536 */
            ).toString(16);
    };

    return (
            S4() + S4() + "-" +
            S4() + "-" +
            S4() + "-" +
            S4() + "-" +
            S4() + S4() + S4()
        );
}