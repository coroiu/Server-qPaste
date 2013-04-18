/*jshint supernew: true*/
var account = new (function () {
	var _user = null;

	this.login = function () {
		$('#acc-login #overlay').removeClass('hide');
		login($('#login-form #username').val(), $('#login-form #password').val(), function (err) {
			if (err) {
				modal('Error occurred', JSON.stringify(err));
			}
			$('#acc-login #overlay').addClass('hide');
			updateMenuUi();
		});
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
			callback(err);
		});
	};

	modal = function (label, body) {
		$('#modal-label').text(label);
		$('#modal-body').text(body);
		$('#modal').modal('show');
	};

	checkSessionStatus = function (callback) {
		$.ajax({
			url: "/user"
		}).done(function ( data ) {
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
		});
	};

	__construct = function () {
		updateMenuUi();
	}();
})();