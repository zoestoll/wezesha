var anyDB = require('any-db');
var express = require("express");
var hp = require("http");
var bodyParser = require("body-parser");
var socket_io = require("socket.io");
var NodeGeocoder = require('node-geocoder');

/* TODO: Update these values */
var localhost = "127.0.0.1";
var port = 8080;
var messages = [];

/* Database config. Clear all tables and re-create. */
var conn = anyDB.createConnection('sqlite3://wezesha.db');
// conn.query("DROP TABLE mapLocations");
conn.query("DROP TABLE users");

/* User table */
conn.query("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, userID INTEGER, username TEXT, isAdmin BOOLEAN)");
conn.query("INSERT INTO users (userID, username, isAdmin) VALUES (?, ?, ?)", (1, "admin", "True"));

/* Map table */
conn.query("CREATE TABLE IF NOT EXISTS mapLocations(id INTEGER PRIMARY KEY AUTOINCREMENT, serviceType TEXT, serviceName TEXT, address TEXT, latitude INTEGER, longitude INTEGER)");

/* Server config */
app = express()
http = hp.createServer(app)
io = socket_io.listen(http)
app.set("ipaddr", localhost);
app.set("port", port);
app.set("views", __dirname + "/views");
app.set('view engine', 'ejs');
app.use(express.static("public", __dirname + "/public")); /* For client js */
app.use(express.static("views", __dirname + "/views")); /* For client js */
app.use(bodyParser.json()); /* Interpret JSON requests */
app.use(bodyParser.urlencoded({     
  extended: true
}));

var isAdmin = 0; /* TEMPORARY FOR DEMONSTRATION PURPOSES. REMOVE THIS LATER! */

/* Maps config */
var geocoder = NodeGeocoder(options);

var options = {
    provider: 'google',
    httpAdapter: 'https',
    apiKey: 'AIzaSyDBs20a1Nr7ZDxF7Tq8-69JheH2zeQOLkg', /* Our Google Maps API Key */
    formatter: null
};


/****************************************************** BASIC GET REQUESTS ******************************************************/

/* GET request for top directory (http://localhost:8080) */
app.get('/',function(req, res){
    res.redirect("/index");
     // response.render('index', {nav: {'index': '/index','News': '/news'}, title: "Home", page: "index"});
});


app.get('/index', function (req, res) {
    res.render('index', { title: "Home", page_name: "index"});
});

/* GET request for room directory (e.g. http://localhost:8080/ABCD) */
app.get('/about', function (req, res) {
    res.render('about', { title: "About", page_name: "about"});
});

/* GET request for news page */
app.get('/news', function (req, res) {
    res.render('news', { title: "News", page_name: "news"});
});

/* GET request for sponsors page*/
app.get('/sponsors', function (req, res) {
    res.render('sponsors', { title: "Sponsors", page_name: "sponsors"});
});

function findPins(req, res, next) {
        var queryStr = 'SELECT * FROM mapLocations';
        conn.query(queryStr, function(error, rows) {
        if(rows.length !== 0) {
            req.pins = rows;
            return next();
        }
        res.render('ERROR'); /* Render the error page. */            
    });
}

function renderPins(req, res) {
    res.render('map', {
        title: "Map",
        page_name: "map",
        pins: req.pins
    });
}

/* GET request for map page */
app.get('/map', findPins, renderPins);

/* GET request for donations page */
app.get('/donations', function (req, res) {
    res.render('donations', { title: "Donations", page_name: "donations"});
});

/* GET request for login form */
app.get('/login', function (req, res) {
    res.render('admin_login', { title: "Login", page_name: "login"});
});

/* GET request for login form */
app.get('/admin_map', function (req, res) {
    res.render('admin_map', { title: "Admin Map", page_name: "admin_map"});
});

/****************************************************** POST REQUESTS ******************************************************/

app.post('/login', function(request, response) {
  username = request.body.username;
  password = request.body.password;
  /* TODO: Check database for user authentication. Generate session ID. */
  /* Generate session ID */
  /* If admin, redirect to the admin version of the site */
  response.redirect("admin_map");
  /* Else, just log them in */
});

app.post('/addPin', function(request, response) {
    username = request.body.username;
    /* TODO: Check session ID and CSRF token to be sure the user is logged in, and is the admin. This prevents CSRF. */

    /* Request parameters */
    serviceType = request.body.serviceType;
    serviceName = request.body.serviceName;
    address = request.body.address;
    lat = request.body.latitude;
    lng = request.body.longitude;

    console.log(lat, lng);
    queryStr = "INSERT INTO mapLocations (serviceType, serviceName, address, latitude, longitude) VALUES (?,?,?,?,?)"
    conn.query(queryStr, [serviceType, serviceName, address, lat, lng], function() {
        console.log("Successful query!");
        response.redirect("map");
    });
    
  /* TODO: Check validity of latitude/longitude sent to us */
  /* TODO: Check authentication of user sending request */

});


/* OLD CODE, IGNORE THIS! I just kept it in case we need it later. */
app.get('/maps2', function(request, response){
    // geocoder.geocode('1600 Pennsylvania Ave', function(err, res) {
    //     console.log(res);
    // });
    geocoder.reverse({lat:45.767, lon:4.833})
    .then(function(res) {
    console.log(res);
    })
    .catch(function(err) {
    console.log(err);
    });
  //  var address = req.body.address;
  //    app.get('https://maps.googleapis.com/maps/api/geocode/json?address=' + add + '&key=' + mapsAPI, function(req,res){
  //       lat = res.results.geometry.northeast.lat;
  //       long = res.results.geometry.northeast.long;
  //       console.log(lat); // no output
  //       console.log(lat); // no output
  // }, function(){
  //       console.log(lat); // no output
  //       console.log(long); // no output
  // });
  // results.send("Thanks!");
});


/****************************************************** SOCKET EVENTS ******************************************************/


/* TODO: All socket events */
io.on("connection", function(socket) {
;
});

function generateRandomID() { /* From TA suggested code */
    /* make a list of legal characters */
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var result = '';
    for (var i = 0; i < 6; i++)
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
};

function getPrettyDate() {
    /* Get current time */
    var time = new Date();
    /* Make it pretty */
    var prettyDate = time.getDate()  + "-" + (time.getMonth()+1) + "-" + time.getFullYear() + " " + ("0" + time.getHours()).slice(-2) + ":" + ("0" + time.getMinutes()).slice(-2);
    return prettyDate;
}

/* Start listening */
http.listen(app.get("port"), app.get("ipaddr"));










