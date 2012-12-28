var app = require('express').createServer();
var Twit = require('twit');
var request = require('request');


/*
var database_url = 'plmongo';
var collections = ['users','tweets'];
var db = require('mongojs').connect(database_url, collections);
*/


if(process.env.VCAP_SERVICES){
	var env = JSON.parse(process.env.VCAP_SERVICES);
	var mongo = env['mongodb-1.8'][0]['credentials'];
} else {
  var mongo = {
    "hostname":"localhost",
    "port":27017,
    "username":"",
    "password":"",
    "name":"",
    "db":"image-loader"
  }
}
var generate_mongo_url = function(obj){
  obj.hostname = (obj.hostname || 'localhost');
  obj.port = (obj.port || 27017);
  obj.db = (obj.db || 'test');
  
  if(obj.username && obj.password){
    return "mongodb://" + obj.username + ":" + obj.password + "@" + obj.hostname + ":" + obj.port + "/" + obj.db;
  } else {
    return "mongodb://" + obj.hostname + ":" + obj.port + "/" + obj.db;
  }
}
var mongourl = generate_mongo_url(mongo);




var opts = {
    consumer_key:         '9DlTFe3I6rLhVi0EjAgVbQ'
  , consumer_secret:      'qPtJ7i6hmZBUDkqNv8ASl5Axt4MhU0zjvvBmbuQhE'
  , access_token:         '17104817-wL2r9D9Kmzpt0cVGfRnWN9ZdiN8NPWWSNd8303yQL'
  , access_token_secret:  '7K5q5W7Tk8DF6hPxefqRjyaqDGr2MEGJL58yvPWCjk'
};

var T = new Twit(opts);

var tweets,
		users,
		images;


var url_regex = /^https?\:\/\/((pic\.twitter|twitpic|)\.com|(instagr\.am|instagram\.com)\/p)\/(.*)/ig;

require('mongodb').connect(mongourl, function(err, conn){
  conn.collection('tweets', function(err, coll){ tweets = coll; });
  conn.collection('users', function(err, coll){ users = coll; });
	conn.collection('images', function(err, coll){ images = coll; });

	// var stream = T.stream('statuses/filter', {track: 'twitpic,instagr,pic'});
	var stream = T.stream('statuses/filter', {track: 'instagram'});
		
	stream.on('tweet', function (tweet) {
		save_tweet(tweet);
	});


	
	
	function save_tweet(tweet) {
	  var object_to_insert = {'username': tweet.user.screen_name, 'name': tweet.user.name, 'image': tweet.user.profile_image_url, 'user_id': tweet.user.id, 'text': tweet.text, 'type': 'tweet', 'social_id': tweet.id, 'timestamp': tweet.created_at};
		var urls = tweet.entities.urls;
		
	  // console.log('Inserting tweet from ' + object_to_insert.username);
		// console.log(tweet.entities);
		
		for (var u in urls) {
			var url = urls[u];
			var matches = url.expanded_url.match(url_regex);
			
			if (matches) {
				var match = matches[0];
				var domain = match.match(/https?\:\/\/[^\/]+/ig)[0].replace(/https?\:\/\//ig,'');
				
				images.find({url: match}, {safe:true}, function(err, cursor){
			    cursor.toArray(function(err, items){
						if (!items.length) {
							images.insert({url: match, domain: domain, user: tweet.user.screen_name, timestamp: new Date()}, {safe:true}, function(err, docs){
								console.log('Inserted ' + match);
								save_full_url(docs[0]);
							});
						} else {
							console.log('FOUND  ' + match);
						}
					});
				});
				
			}
		}
		
	  tweets.insert(object_to_insert, {safe:true}, function(err){});
	}

	function save_full_url(image) {
		var image_url = '';
		
		switch (image.domain.toLowerCase()) {
			case 'twitpic.com':
				image_url = image.url.replace('twitpic.com/','twitpic.com/show/thumb/');
				break;
									
			case 'instagram.com':
			case 'instagr.am':
				image_url = image.url.replace(/\/$/g,'') + '/media?s=t';
				break;
								
			default:
				return;
				break;
		}

		request(image_url, function (error, response, body) {
		  if (!error && response.statusCode == 200) {
				images.update({url: image.url}, {$set: {image_url: response.request.uri.href}}, {safe: true, multi: true}, function(err){
			    console.log('Saved ' + response.request.uri.href);
				});
		  } else {
		  	console.log(response.statusCode, error);
		  }
		})
	}
		
		
	app.get('/item/:id', function(req, res) {
		var id = req.params.id;
			
    tweets.findOne({_id: tweets.db.bson_serializer.ObjectID.createFromHexString(id)}, function(err, result) {
    	//result = [result];
    	console.log("Result: " + result);
	    	
	    res.writeHead(200, {'Content-Type': 'text/json', 'Access-Control-Allow-Origin': '*'});
	    res.write(JSON.stringify(result));
	    res.end();
    });
  });
		
	app.get('/users', function(req, res) {
    users.find({}, {limit: 30, sort:[['name','asc']]}, function(err, cursor) {
	    cursor.toArray(function(err, items){
				
		    res.writeHead(200, {'Content-Type': 'text/json', 'Access-Control-Allow-Origin': '*'});
		    res.write(JSON.stringify(items));
		    res.end();
				
	    });
    });
  });

	app.get('/images/:action', function(req, res) {
		if (req.params.action == 'approve' || req.params.action == 'reject') {
			var url = req.query.url;
			
			console.log('url: ', url);
			
			images.update({url: url}, {$set: {status: req.params.action}}, {safe: true, multi: true}, function(err){
		    res.writeHead(200, {'Content-Type': 'text/json', 'Access-Control-Allow-Origin': '*'});
		    res.write(JSON.stringify({success: true}));
		    res.end();
			});
			return;
		}
		
		var count = req.query.last_id ? 10 : 50; 
		
    images.find({timestamp: {$gt: new Date(req.query.last_id)}}, {limit: count, sort:[['timestamp','desc']]}, function(err, cursor) {
	    cursor.toArray(function(err, items){
		    res.writeHead(200, {'Content-Type': 'text/json', 'Access-Control-Allow-Origin': '*'});
		    res.write(JSON.stringify(items));
		    res.end();
	    });
    });
  });

});




app.listen(process.env.VCAP_APP_PORT || 3001);
