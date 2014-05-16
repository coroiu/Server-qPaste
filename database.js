//Database module, encapsulates all calls to the databse

(function() {
	var mongoose = require('mongoose');

	module.exports.mongoose = function () {
		mongoose.connect(generateMongoUrl(config()));
		return mongoose;
	};

	module.exports.config = function () {
		return config();
	};

	module.exports.uri = function () {
		return generateMongoUrl(config());
	};

	var config = function () {
		var mongo;
		if (process.env.VCAP_SERVICES) {
			//Appfog
			var env = JSON.parse(process.env.VCAP_SERVICES);
			mongo = env['mongodb2-2.4.8'][0]['credentials'];
		} else if (process.env.MONGOHQ_JSON) {
			//Heroku
			mongo = JSON.parse(process.env.MONGOHQ_JSON);
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
		return mongo;
	};

	var generateMongoUrl = function(obj) {
		obj.hostname = (obj.hostname || 'localhost');
		obj.port = (obj.port || 27017);
		obj.db = (obj.db || 'test');
		if(obj.username && obj.password){
			return "mongodb://" + obj.username + ":" + obj.password + "@" + obj.hostname + ":" + obj.port + "/" + obj.db;
		} else {
			return "mongodb://" + obj.hostname + ":" + obj.port + "/" + obj.db;
		}
	};

	var hashPassword = function(password, salt) {
		return crypto.createHmac('sha256', salt).update(password).digest('hex');
	};
}());