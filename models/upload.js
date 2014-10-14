// Mongoose Model: Upload

(function() {
	var uuid = require('node-uuid');

	module.exports = function (mongoose) {
		var expire = new Date();
		expire.setDate(new Date().getDate() + 1);

		var uploadSchema = mongoose.Schema({
			uid: {type: String, 'default': function() {return uuid.v4();} },
			sid: [String], // Short ids
			resourcepath: String, // Relative Amazon S3 resource path (same as filepath but relative to http://s3.amazonaws.com/qpaste/...)
			filename: String, // Original filename
			mimetype: String, // Mime-type
			uploaded: {type: Boolean, 'default': false}, // Is file uploaded yet?
			owner: String,
			//createdAt: { type: Date, expires: '1m' },
			createdAt: { type: Date, expires: '23h' },
			expire: {type: Date, 'default': function() {
				var expire = new Date();
				expire.setDate(new Date().getDate() + 1);
				return expire;
			}} // Datetime for expiration (used for displaying time left)
		});

		uploadSchema.virtual('url').get(function () {
			return 'http://s3.amazonaws.com/qpaste' + this.resourcepath;
		});

		uploadSchema.methods.remove = function () {
			Upload.remove({ _id: this._id }, function (err) {
				if (err) return err;
			});
		};

		uploadSchema.statics.getAll = function (callback) {
			Upload.find({}, function (err, uploads) {
				var error;
				if (err) {
					error = new Error('Couldn\'t get uploads.');
					error.name = "Database error";
					error.status = 500;
					error.originalError = err;
					return callback(error);
				}

				return callback(null, uploads);
			});
		};

		uploadSchema.statics.getUpload = function (uid, callback) {
			Upload.findOne({ uid: uid }, function (err, upload) {
				var error;
				if (err) {
					error = new Error('Couldn\'t search for token in database.');
					error.name = "Database error";
					error.status = 500;
					error.originalError = err;
					return callback(error);
				} else if (upload === null) {
					error = new Error('Couldn\'t find token in database.');
					error.name = "Not found";
					error.status = 404;
					return callback(error);
				}

				return callback(null, upload);
			});
		};

		uploadSchema.statics.getUploadShort = function (sid, callback) {
			Upload.findOne({ sid: sid }, function (err, upload) {
				var error;
				if (err) {
					error = new Error('Couldn\'t search for token in database.');
					error.name = "Database error";
					error.status = 500;
					error.originalError = err;
					return callback(error);
				} else if (upload === null) {
					error = new Error('Couldn\'t find token in database.');
					error.name = "Not found";
					error.status = 404;
					return callback(error);
				}

				return callback(null, upload);
			});
		};

		uploadSchema.statics.existsShort = function (sid, callback) {
			Upload.findOne({ sid: sid }, function (err, upload) {
				var error;
				if (err) {
					error = new Error('Couldn\'t search for token in database.');
					error.name = "Database error";
					error.status = 500;
					error.originalError = err;
					return callback(error);
				} else if (upload === null) {
					return callback(null, false);
				}

				return callback(null, true);
			});
		};

		/*uploadSchema.methods.url = function () {
			return 'http://s3.amazonaws.com/qpaste/' + this.resourcepath;
		};*/

		var Upload = mongoose.model('Upload', uploadSchema);
		return Upload;
	};
}());