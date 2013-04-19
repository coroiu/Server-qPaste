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

		/*uploadSchema.methods.url = function () {
			return 'http://s3.amazonaws.com/qpaste/' + this.resourcepath;
		};*/

		var Upload = mongoose.model('Upload', uploadSchema);
		return Upload;
	};
}());