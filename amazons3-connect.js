// amazons3-connect.js
// external nodejs component for Amazon S3 signed POST uploading

// All code in this file (amazons3-connect.js) is free to be used by anyone.

crypto = require("crypto");
credentials = require("./s3credentials");

(function() {
	var accessKey = credentials.accessKey;
	var secretKey = credentials.secretKey;
	var bucketName = credentials.bucketName;
	var limit = 20;

	module.exports.setLimit = function (newLimit) {
		limit = newLimit;
	}

    module.exports.getS3Policy = function( key, filename, mime ) {
		var s3PolicyBase64, _date, _s3Policy;
		_date = new Date();
		s3Policy = {
		"expiration": "" + (_date.getFullYear()) + "-" + (_date.getMonth() + 1) + "-" + (_date.getDate()) + "T" + (_date.getHours() + 1) + ":" + (_date.getMinutes()) + ":" + (_date.getSeconds()) + "Z",
			"conditions": [
				{ "Content-type": mime },
				{ "key": key },
				{ "bucket": bucketName },  
				{ "acl": "public-read" },
				{ "Content-Disposition": "attachment; filename=" + filename }, 
				["content-length-range", 0, limit * 1048576] //1 MB = 1 048 576 Bytes 
			]
		};

		s3PolicyReturn = {
		"expiration": "" + (_date.getFullYear()) + "-" + (_date.getMonth() + 1) + "-" + (_date.getDate()) + "T" + (_date.getHours() + 1) + ":" + (_date.getMinutes()) + ":" + (_date.getSeconds()) + "Z",
			"conditions": {
				"key": key,
				"bucket": bucketName,  
				"acl": "public-read",
				"mime": mime,
				"disposition": "attachment; filename=" + filename
			}
		};
	  
		s3Credentials = {
			s3PolicyBase64: new Buffer( JSON.stringify( s3Policy ) ).toString( 'base64' ),
			//s3Signature: crypto.createHmac('sha1', secretKey ).update( JSON.stringify(s3Policy) ).digest( 'base64' ),
			s3Signature: b64_hmac_sha1(secretKey, new Buffer( JSON.stringify( s3Policy ) ).toString( 'base64' )),
			//s3Signature: crypto.createHmac('sha1', new Buffer(secretKey, 'utf-8') ).update( new Buffer(JSON.stringify(s3Policy), 'utf-8') ).digest( 'base64' ),
			s3Key: accessKey,
			s3Policy: s3PolicyReturn
		}
	  
		//callback(s3Credentials);
		return s3Credentials;
	};

	/*****************************************************************************
	* A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined
	* in FIPS PUB 180-1
	* Version 2.1a Copyright Paul Johnston 2000 - 2002.
	* Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
	* Distributed under the BSD License
	* See http://pajhome.org.uk/crypt/md5 for details.
	*/

	/*
	* Configurable variables. You may need to tweak these to be compatible with
	* the server-side, but the defaults work in most cases.
	*/
	var b64pad  = "="; /* base-64 pad character. "=" for strict RFC compliance   */
	var chrsz   = 8;  /* bits per input character. 8 - ASCII; 16 - Unicode      */

	b64_hmac_sha1 = function (key, data) { return binb2b64(core_hmac_sha1(key, data));}

	/*
	* Calculate the SHA-1 of an array of big-endian words, and a bit length
	*/
	core_sha1 = function (x, len)
	{
		/* append padding */
		x[len >> 5] |= 0x80 << (24 - len % 32);
		x[((len + 64 >> 9) << 4) + 15] = len;

		var w = Array(80);
		var a =  1732584193;
		var b = -271733879;
		var c = -1732584194;
		var d =  271733878;
		var e = -1009589776;

		for(var i = 0; i < x.length; i += 16)
		{
			var olda = a;
			var oldb = b;
			var oldc = c;
			var oldd = d;
			var olde = e;

			for(var j = 0; j < 80; j++)
			{
				if(j < 16) w[j] = x[i + j];
				else w[j] = rol(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);
				var t = safe_add(safe_add(rol(a, 5), sha1_ft(j, b, c, d)),
					safe_add(safe_add(e, w[j]), sha1_kt(j)));
				e = d;
				d = c;
				c = rol(b, 30);
				b = a;
				a = t;
			}

			a = safe_add(a, olda);
			b = safe_add(b, oldb);
			c = safe_add(c, oldc);
			d = safe_add(d, oldd);
			e = safe_add(e, olde);
		}
		return Array(a, b, c, d, e);

	}

	/*
	* Perform the appropriate triplet combination function for the current
	* iteration
	*/
	sha1_ft = function (t, b, c, d)
	{
		if(t < 20) return (b & c) | ((~b) & d);
		if(t < 40) return b ^ c ^ d;
		if(t < 60) return (b & c) | (b & d) | (c & d);
		return b ^ c ^ d;
	}

	/*
	* Determine the appropriate additive constant for the current iteration
	*/
	sha1_kt = function (t)
	{
		return (t < 20) ?  1518500249 : (t < 40) ?  1859775393 :
		(t < 60) ? -1894007588 : -899497514;
	}

	/*
	* Calculate the HMAC-SHA1 of a key and some data
	*/
	core_hmac_sha1 = function (key, data)
	{
		var bkey = str2binb(key);
		if(bkey.length > 16) bkey = core_sha1(bkey, key.length * chrsz);

		var ipad = Array(16), opad = Array(16);
		for(var i = 0; i < 16; i++)
		{
			ipad[i] = bkey[i] ^ 0x36363636;
			opad[i] = bkey[i] ^ 0x5C5C5C5C;
		}

		var hash = core_sha1(ipad.concat(str2binb(data)), 512 + data.length * chrsz);
		return core_sha1(opad.concat(hash), 512 + 160);
	}

	/*
	* Add integers, wrapping at 2^32. This uses 16-bit operations internally
	* to work around bugs in some JS interpreters.
	*/
	safe_add = function (x, y)
	{
		var lsw = (x & 0xFFFF) + (y & 0xFFFF);
		var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
		return (msw << 16) | (lsw & 0xFFFF);
	}

	/*
	* Bitwise rotate a 32-bit number to the left.
	*/
	rol = function (num, cnt)
	{
		return (num << cnt) | (num >>> (32 - cnt));
	}

	/*
	* Convert an 8-bit or 16-bit string to an array of big-endian words
	* In 8-bit function, characters >255 have their hi-byte silently ignored.
	*/
	str2binb = function (str)
	{
		var bin = Array();
		var mask = (1 << chrsz) - 1;
		for(var i = 0; i < str.length * chrsz; i += chrsz)
			bin[i>>5] |= (str.charCodeAt(i / chrsz) & mask) << (32 - chrsz - i%32);
		return bin;
	}

	/*
	* Convert an array of big-endian words to a base-64 string
	*/
	binb2b64 = function (binarray)
	{
		var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
		var str = "";
		for(var i = 0; i < binarray.length * 4; i += 3)
		{
			var triplet = (((binarray[i   >> 2] >> 8 * (3 -  i   %4)) & 0xFF) << 16)
			| (((binarray[i+1 >> 2] >> 8 * (3 - (i+1)%4)) & 0xFF) << 8 )
			|  ((binarray[i+2 >> 2] >> 8 * (3 - (i+2)%4)) & 0xFF);
			for(var j = 0; j < 4; j++)
			{
				if(i * 8 + j * 6 > binarray.length * 32) str += b64pad;
				else str += tab.charAt((triplet >> 6*(3-j)) & 0x3F);
			}
		}
		return str;
	}
}());