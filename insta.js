Instagram = require('instagram-node-lib');

Instagram.set('client_id', 'b4f7e6ff21bf4f6ca3425aab82e6802a');
Instagram.set('client_secret', 'c45720357cdf455b9afb9425ac279081');

Instagram.tags.info({
  name: 'blue',
  complete: function(data){
    console.log(data);
  }
});

