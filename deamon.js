// Separate module for main homepage

(function() {
	module.exports = function (storage, Upload) {
		_constructor(storage, Upload);
		return module.exports;
	};

	module.exports.watch = function (upload) {
		watch(upload);
	};

	var storage;
	var Upload; // model
	var self = this;

	var _constructor = function (storage, Upload) {
		self.storage = storage;
		self.Upload = Upload;

		Upload.getAll(function (err, databaseUploads) {
			for (var key in databaseUploads) {
				var upload = databaseUploads[key];
				watch(upload);
			}
		});
	};

	var watch = function(upload) {
		var msToExpiry = upload.expire.getTime() - Date.now();
		if (msToExpiry < 0) {
			remove(upload);
		} else {
			setTimeout(function() {
				try {
					remove(upload);
				} catch (ex) {}
			}, msToExpiry);
		}
	};

	var remove = function(upload) {
		storage.deleteFile(upload.uid, function(statusCode) {});
		upload.remove();
	};
}());