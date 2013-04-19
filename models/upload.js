// Mongoose Model: Upload

(function() {
	var uuid = require('node-uuid');

	module.exports = function (mongoose) {
		var expire = new Date();
		expire.setDate(new Date().getDate() + 1);

		var uploadSchema = mongoose.Schema({
			uid: {type: String, 'default': uuid.v4()}, // URL to file
			resourcepath: String, // Relative Amazon S3 resource path (same as filepath but relative to http://s3.amazonaws.com/qpaste/...)
			filename: String, // Original filename
			mimetype: String, // Mime-type
			uploaded: {type: Boolean, 'default': false}, // Is file uploaded yet?
			expire: {type: Date, 'default': expire} // Datetime for expiration (auto delete from database)
		});

		uploadSchema.virtual('url').get(function () {
			return 'http://s3.amazonaws.com/qpaste' + this.resourcepath;
		});

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

		/*uploadSchema.methods.url = function () {
			return 'http://s3.amazonaws.com/qpaste/' + this.resourcepath;
		};*/

		var Upload = mongoose.model('Upload', uploadSchema);
		return Upload;
	};
}());