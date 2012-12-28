var request = require('request');

request('http://instagr.am/p/TwbkxhHmdJ/media?s=t', function (error, response, body) {
  if (!error && response.statusCode == 200) {
    console.log(response.request.uri);
  } else {
  	console.log(response.statusCode, error);
  }
})
