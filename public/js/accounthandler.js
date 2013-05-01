/*jshint supernew: true*/
var account = new (function () {
	var _user = null;

	this.login = function () {
		if ($('#login-form #username').val() === '' || $('#login-form #password').val() === '') {
			loginError('Empty fields');
		} else {
			$('#acc-login #overlay').removeClass('hide');
			login($('#login-form #username').val(), $('#login-form #password').val(), function (err) {
				$('#acc-login #overlay').addClass('hide');
				if (err) {
					if (err.status == 401) {
						loginError('Wrong username or password');
					} else {
						modal('Error occurred', JSON.stringify(err));
					}
				} else {
					updateMenuUi();
				}
			});
		}
	};

	this.logout = function () {
		logout(function (err) {
			if (err) {
				modal('Error occurred', JSON.stringify(err));
			} else {
				modal('Success', 'You have been successfully been logged out.');
			}
			updateMenuUi();
		});
	};

	this.user = function () {
		return _user;
	};

	_updateListeners = [];
	this.onUpdate = function (listener) {
		_updateListeners.push(listener);
	};

	logout = function (callback) {
		$.ajax({
			url: '/user/logout',
			dataType: 'text'
		}).done(function () {
			callback();
		}).fail(function (jqXHR, textStatus, err) {
			callback(err);
		});
	};

	login = function (username, password, callback) {
		$.ajax({
			url: '/user/login',
			type: 'POST',
			dataType: 'text',
			data: {username: username, password: password}
		}).done(function () {
			callback();
		}).fail(function (jqXHR, textStatus, err) {
			callback(jqXHR);
		});
	};

	modal = function (label, body) {
		$('#modal-label').text(label);
		$('#modal-body').text(body);
		$('#modal').modal('show');
	};

	loginError = function (body) {
		var element = $('#login-form #error');
		$(element).text(body);
		$(element).show();
	};

	checkSessionStatus = function (callback) {
		$.ajax({
			url: "/user"
		}).done(function ( data ) {
			_user = data;

			for (var i = 0; i < _updateListeners.length; i++)
				_updateListeners[i](_user);

			callback(data);
		});
	};

	updateMenuUi = function () {
		checkSessionStatus(function (data) {
			if (data.logged_in) {
				$('#acc-login').addClass('hide');
				$('#acc-menu').removeClass('hide');
				$('#text-username').text(data.username);
				_user = data;
			} else {
				$('#acc-login').removeClass('hide');
				$('#acc-menu').addClass('hide');
				_user = null;
			}
			$('#login-form #username').val('');
			$('#login-form #password').val('');
			$('#login-form #error').hide();
		});
	};

	__construct = function () {
		updateMenuUi();
	}();
})();