require("apollo:jquery-binding").install();
var logging = require("apollo:logging");
var Cache = require("./cache.sjs").Cache;

var NewsSources = require('./news-sources');

if(logging.isEnabled(logging.VERBOSE)) {
  // in debug mode, pop up an apollo console
  require("apollo:debug").console({receivelog:false});
}

// The main app controller, initialized by angular.js
var App = exports.App = function App(route) {
  this.route = route;
  this.feeds = [];
  this.feedStore = new Cache("rss_feeds");
  route.when('/locker', {controller: NewsSources.Locker, template: "templates/basic-news.html"});
  route.when('/rss/new', {controller: RssAdder(this), template: "templates/add-rss.html"});
  route.when('/rss/:feed', {controller: NewsSources.RSS, template: "templates/basic-news.html"});
  spawn(this.run(route));
};
App.$inject=['$route'];

App.prototype.run = function() {
  this.feeds = this.feedStore.all();
  var route = this.route;
  // every time the route changes, load the appropriate
  // news type (and abort the old news loader if there is one):
  var currentStrata;
  while (true) {
    waitfor() { route.onChange(resume); }
    if(currentStrata) {
      currentStrata.abort();
      currentStrata = null;
    }
    hold(0); // scope seems to be initialized right *after* this code, so we need a delay

    if(!(route.current && route.current.scope)) {
      logging.debug("route changed with no current scope: ", null, route.current);
      continue;
    }
    logging.debug("new route:", null, route.current);

    // init the scope, and run it in the background:
    this.news = route.current.scope;

    // for debugging
    window.news = this.news;
    this.$root.$eval();
    if(this.news._init) {
      this.news._init();
      currentStrata = spawn(this.news.run());
    }
  };
};

App.prototype.addFeed = function(q) {
  if((!q)) {
    throw new Error("Please enter something");
  }
  var feed = {key: q, name:q};
  this.feeds.push(feed);
  this.feedStore.save(feed);
  //TODO: fix double-encoding requirement
  document.location.href = "#/rss/" + encodeURIComponent(encodeURIComponent(q));
};

App.prototype.removeFeed = function(feed) {
  angular.Array.remove(this.feeds, feed);
  this.feedStore.remove(feed.key);
};


function RssAdder(app) {
  // returns a class constructor with the `app` pre-bound
  var Cls = function() {
  }
  Cls.prototype = {
    save: function() {
      try {
        app.addFeed(this.q);
      } catch(e) {
        this.validationError = e;
      }
    },
    type: 'add-rss',
    title: "Search your links",
    about: "enter any keyword to add it as a tab"
  };
  return Cls;
};
