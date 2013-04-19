// Mongoose Model: User

(function() {
	var crypto = require("crypto");
	var uuid = require('node-uuid');

	module.exports = function (mongoose) {
		var transactionSchema = mongoose.Schema({
			date: {type: Date, 'default': new Date()},
			balance: Number,
			method: {type: String, 'default': 'paypal'}
		});
		var Transaction = mongoose.model('Transaction', transactionSchema);

		var walletSchema = mongoose.Schema({
			balance: {type: Number, 'default': 0},
			transactions: [Transaction]
		});
		var Wallet = mongoose.model('Wallet', walletSchema);

		var userSchema = mongoose.Schema({
			username: String,
			passwordHash: String,
			creationDate: {type: Date, 'default': new Date()},
			wallet: {type: Wallet, 'default': new Wallet()},
			salt: {type: String, 'default': uuid.v4()}
		});

		userSchema.virtual('password').get(function () {
			return this.passwordHash;
		});

		userSchema.virtual('password').set(function (password) {
			this.passwordHash = hashPassword(password, this.salt);
		});

		userSchema.methods.checkPassword = function (unhashed) {
			return checkPassword(unhashed, this.passwordHash, salt);
		};

		userSchema.statics.registerUser = function (username, password, callback) {
			User.findOne({ username: username }, function (err, user) {
				var error;
				if (err) {
					error = new Error('Couldn\'t search for user in database.');
					error.name = "Database error";
					error.status = 500;
					error.originalError = err;
					return callback(error);
				} else if (user !== null) {
					error = new Error('Username already exists.');
					error.name = "Duplicate username";
					error.status = 401;
					return callback(error);
				}

				user = new User();
				user.username = username;
				user.password = password;
				user.save(function (err, user) {
					if (err) {
						var error = new Error('Couldn\'t create user in database.');
						error.name = "Database error";
						error.status = 500;
						error.originalError = err;
						return callback(error);
					}

					callback(null, user);
				});
			});
		};

		userSchema.statics.authenticateUser = function (username, password, callback) {
			User.findOne({ username: username }, function (err, user) {
				var credentialsError = new Error('Wrong username or password.');
				credentialsError.name = "Credentials Denied";
				credentialsError.status = 401;

				if (err) {
					var error = new Error('Couldn\'t search for user in database.');
					error.name = "Database error";
					error.status = 500;
					error.originalError = err;
					return callback(error);
				} else if (user === null) {
					return callback(credentialsError);
				}

				if (checkPassword(password, user.password, user.salt)) {
					return callback(null, user);
				} else {
					return callback(credentialsError);
				}
			});
		};

		userSchema.statics.getUser = function (_id, callback) {
			User.findOne({ _id: new mongoose.Types.ObjectId(_id) }, function (err, user) {
				var error;
				if (err) {
					error = new Error('Couldn\'t search for user in database.');
					error.name = "Database error";
					error.status = 500;
					error.originalError = err;
					return callback(error);
				} else if (user === null) {
					error = new Error('Couldn\'t the user in the database. Very strange seeing as the user is apparently logged in.');
					error.name = "Database error";
					error.status = 500;
					error.originalError = err;
					return callback(error);
				}
				
				return callback(null, user);
			});
		};

		var User = mongoose.model('User', userSchema);
		return User;
	};

	var hashPassword = function(password, salt) {
		return crypto.createHmac('sha256', salt).update(password).digest('hex');
	};

	var checkPassword = function(unhashed, hashed, salt) {
		return hashPassword(unhashed, salt) === hashed;
	};
}());