var Views = {
	'None': 			0,
	'FileUpload': 		1,
	'TextUpload': 		2,
	'TextUploadDone':	3
};

var Application = new (function () {
	var self = this;
	fadetime = 150;
	uploading = false;

	self.uploads = ko.observableArray();
	self.currentView = ko.observable(Views.None);
	//self.currentView = ko.observable(Views.FileUpload);

	var getElementViewTarget = function (element) {
		return Views[$(element).attr('data-view-target')];
	}

	self.changeView = function (data, event, view) {
		if (!view) {
			view = getElementViewTarget(event.target);
			$(event.target).addClass('active');
			$(event.target).siblings().removeClass('active');
		}

		self.currentView(view);
	}

	self.hasFlash = function() {
		try {
			return (typeof navigator.plugins == "undefined" || navigator.plugins.length == 0) ? !!(new ActiveXObject("ShockwaveFlash.ShockwaveFlash")) : navigator.plugins["Shockwave Flash"];
		} catch (ex) {
			return false;
		}
	}

	self.pickFile = function () {
		var input = $('#upload-form input[type=file]');
		input.replaceWith( input = input.clone( true ) );
		input.click();
	}

	self.uploadText = function () {
		var blob = new Blob([ $('textarea#text').val() ], {
			type : 'text/plain'
		});
		blob.name = 'qpaste.txt';
		self.newUpload([blob]);
		self.currentView(Views.FileUpload);
	}

	self.newUpload = function (files) {
		var upload = new qpaste.Upload(files);
		self.uploads.push(upload);

		upload.startUpload().done(function () {

		}).fail(function () {

		}).progress(function() {
			console.log("progress");
		});
	}

})();

var qpaste = {};

qpaste.File = function (file) {
	var self = this;

	self.progress = ko.observable(0);
	self.filename = file.name;
	self.size = ko.observable(file.size);
	self.mime = file.type;
	self.file = file;

	self.readableSize = ko.computed(function () {
		var i = Math.floor(Math.log(self.size()) / Math.log(1024));
		return (self.size() / Math.pow(1024, i)).toFixed(2) * 1 + ' '+['b', 'kb', 'mb', 'gb', 'tb'][i];
	});

	self.compress = function (zipWriter, callback) {
		zipWriter.add(self.filename, new zip.BlobReader(self.file), function() {
			self.progress(100);
			callback();
		}, function (progress) {
			var percent = progress / self.size();
			self.progress(percent * 100);
		});
	}
}

qpaste.Upload = function (files) {
	var self = this;

	self.progress = ko.observable(0);
	self.status = ko.observable('Getting link...');
	self.files = [];
	self.token = ko.observable();

	for (var i = 0; i < files.length; i++) {
		self.files.push(new qpaste.File(files[i]));
	}

	//Callback = function (zipped_blob) { ... }
	self.compressFiles = function (callback) {
		self.status("Compressing files...");
		zip.createWriter(new zip.BlobWriter("application/zip"), function(zipWriter) {
			function nextFile(index, done) {
				self.files[index].compress(zipWriter, function () {
					if (++index < self.files.length) {
						nextFile(index, done);
					} else {
						done();
					}
				});
			}
			nextFile(0, function () {
				zipWriter.close(callback);
			});
		}, function (error) {
			alert('Error occurred when compressing: ' + error.toString());
		});
	}

	//Does everything regarding uploads
	self.startUpload = function () {
		var deferred = $.Deferred();

		if (files.length == 1) {
			var file = files[0];
			$('#token-form input[name="filename"]').val(file.name);
			$('#token-form input[name="mime"]').val((file.type === '' ? 'application/octet-stream' : file.type));
		} else {
			$('#token-form input[name="filename"]').val('qpaste.zip');
			$('#token-form input[name="mime"]').val('application/zip');
		}

		$.ajax({
			type: 'POST',
			url: '/upload-token',
			data: $('#token-form').serialize()
		}).done(function(data) {
			self.token(data.link);

			if (Application.hasFlash()) {
				var copyBtn = $('.copy[data-copy-link="'+ self.token() +'"]');
				copyBtn.zclip({
					path: '/swf/ZeroClipboard.swf',
					copy: self.token(),
					afterCopy:function(){
						copyBtn.addClass('btn-success');
						copyBtn.html('<span class="glyphicon glyphicon-ok"></span> Copied');
					}
				}).show();
			}

			if (files.length == 1) {
				self.files[0].progress(100);
				self.doUpload(data, self.files[0].file);
			} else {
				self.compressFiles(function (zippedBlob) {
					zippedBlob.name = 'qpaste.zip';
					self.doUpload(data, zippedBlob);
				});
			}
		});

		return deferred.promise();
	};

	//Does the actual upload of one file
	self.doUpload = function (data, file) {
		self.status("Uploading...");
		var fd = new FormData();

		fd.append('key', data.storage.s3Policy.conditions.key);
		fd.append('AWSAccessKeyId', data.storage.s3Key);
		fd.append('Policy', data.storage.s3PolicyBase64);
		fd.append('Signature', data.storage.s3Signature);
		fd.append('Bucket', data.storage.s3Policy.conditions.bucket);
		fd.append('acl', data.storage.s3Policy.conditions.acl);
		fd.append('Content-Type', data.storage.s3Policy.conditions.mime);
		fd.append('Content-Disposition', data.storage.s3Policy.conditions.disposition);

		fd.append("file", file);
		var xhr = $.ajaxSettings.xhr();

		xhr.upload.addEventListener("progress", function (e) {
			if(e.lengthComputable) {
				self.progress(Math.round((e.loaded/e.total) * 100) * 0.95);
			}
		}, false);
		xhr.addEventListener("load", function (e) {
			$.ajax({
				type: 'POST',
				url: '/upload-done',
				data: {token: data.token},
				complete: function () {
					self.status("Done!");
					self.progress(100);
				}
			})
		}, false);

		xhr.open('POST', 'http://qpaste.s3.amazonaws.com/', true); //MUST BE LAST LINE BEFORE YOU SEND
		xhr.send(fd);
	}
};

ko.applyBindings(Application);

zip.workerScriptsPath = "/js/zip/";

$(function(){
	$.event.props.push('dataTransfer');

	$(window).bind('dragover', dragover);
	$(window).bind('drop', drop);
	$('.site-overlay').bind('dragleave', dragleave);
	var dragTimeout;

	function dragover(event) {
		var e = event || window.event;
		clearTimeout(dragTimeout);
		$('.site-overlay').show();
		if (e.preventDefault) {
			e.stopPropagation();
			e.preventDefault();
		}
		return false;
	}

	function dragleave(event) {
		dragTimeout = setTimeout(function(){
			var e = event || window.event;
			$('.site-overlay').hide();
			if (e.stopPropagation) {
				e.stopPropagation();
			}
		}, 300);
	}

	function drop(event) {
		var e = event || window.event;
		Application.newUpload(e.originalEvent.dataTransfer.files);
		Application.changeView(null, null, Views.FileUpload);
		$('.site-overlay').hide();
		if (e.preventDefault) {
			e.stopPropagation();
			e.preventDefault();
		}
		return false;
	}

	$('#upload-form input[type="file"]').change(function() {
		if($(this).val() !== "") {
			Application.newUpload($(this).prop('files'));
			Application.changeView(null, null, Views.FileUpload);
		}
	});

	if (!Application.hasFlash()) {
		$('#copy').hide();
	}

	//Tab functionality
	$("textarea").keydown(function(e) {
		var $this, end, start;
		if (e.keyCode === 9) {
			start = this.selectionStart;
			end = this.selectionEnd;
			$this = $(this);
			$this.val($this.val().substring(0, start) + "\t" + $this.val().substring(end));
			this.selectionStart = this.selectionEnd = start + 1;
			return false;
		}
	});
});