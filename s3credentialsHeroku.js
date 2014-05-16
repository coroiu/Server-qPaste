// Separate credentials for Amazon S3
// These are ignored by github

(function() {
	module.exports.accessKey = process.env.s3AccessKey;
	module.exports.secretKey = process.env.s3SecretKey;
	module.exports.bucketName = process.env.s3BucketName;
}());