var app = require('express').createServer();
var Twit = require('twit');


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


var url_regex = /^https?\:\/\/(pic\.twitter\.com|instagr\.am\/p|twitpic\.com)\/(.*)/ig;

require('mongodb').connect(mongourl, function(err, conn){
  conn.collection('tweets', function(err, coll){ tweets = coll; });
  conn.collection('users', function(err, coll){ users = coll; });
	conn.collection('images', function(err, coll){ images = coll; });

	// var stream = T.stream('statuses/filter', {track: 'twitpic,instagr,pic'});
	var stream = T.stream('statuses/filter', {track: 'beautiful day'});
		
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
							images.insert({url: match, domain: domain, user: tweet.user.screen_name, timestamp: new Date()}, {safe:true}, function(err){
								console.log('Inserted ' + match);
							});
						} else {
							console.log('FOUND  ' + match);
						}
					});
				});
				
			}
		}
		
		  
	  tweets.insert(object_to_insert, {safe:true}, function(err){
	  	// console.log('Success!');
	  });
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

	app.get('/images', function(req, res) {
    images.find({}, {limit: 30, sort:[['_id','desc']]}, function(err, cursor) {
	    cursor.toArray(function(err, items){
		    res.writeHead(200, {'Content-Type': 'text/json', 'Access-Control-Allow-Origin': '*'});
		    res.write(JSON.stringify(items));
		    res.end();
	    });
    });
  });

});






app.listen(process.env.VCAP_APP_PORT || 3001);
