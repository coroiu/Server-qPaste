//Database module, encapsulates all calls to the databse

(function() {
	var collections = ["uploads", "users"];
	var db = null;

	module.exports.connect = function () {
		var mongo;
		if (process.env.VCAP_SERVICES) {
			var env = JSON.parse(process.env.VCAP_SERVICES);
			mongo = env['mongodb-1.8'][0]['credentials'];
		} else {
			mongo = {
				"hostname": "localhost",
				"port": 27017,
				"username": "",
				"password": "",
				"name": "",
				"db": "db"
			};
		}
		var generate_mongo_url = function(obj) {
			obj.hostname = (obj.hostname || 'localhost');
			obj.port = (obj.port || 27017);
			obj.db = (obj.db || 'test');
			if(obj.username && obj.password){
				return "mongodb://" + obj.username + ":" + obj.password + "@" + obj.hostname + ":" + obj.port + "/" + obj.db;
			} else {
				return "mongodb://" + obj.hostname + ":" + obj.port + "/" + obj.db;
			}
		};
		var mongourl = generate_mongo_url(mongo);
		db = require('mongojs').connect(mongourl, collections);

		//1 second allows the 'expire' specify when the document should be deleted
		db.uploads.ensureIndex({expire: 1}, {expireAfterSeconds: 1});
	};

	module.exports.newUpload = function (uid, filename, mimetype) {
		var expire = new Date();
		expire.setDate(new Date().getDate() + 1);
		var upload = {
			uid: uid,
			filepath: '', // URL to file
			resourcepath: '', // Relative Amazon S3 resource path (same as filepath but relative to http://s3.amazonaws.com/qpaste/...)
			filename: filename, // Original filename
			mimetype: mimetype, // Mime-type
			uploaded: false, // Is file uploaded yet?
			callback: [], // Callbacks for when the upload is complete
			expire: expire // Datetime for expiration (auto delete from database)
		};

		db.uploads.save(upload);
	};

	//Callback should be: function(upload) {};
	//Where upload contains all information fields in function "newUpload"
	module.exports.getUpload = function (uid, callback) {
		db.uploads.find({uid: uid}, function(err, docs) {
			if (docs.length === 0)
				callback(null);
			else
				callback(docs[0]);
		});
	};

	module.exports.updateUpload = function (uid, fields) {
		db.uploads.update({uid: uid}, {$set:fields}, {multi:false}, function(err) {

		});
	};
}());