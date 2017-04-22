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
var APIKey = "AIzaSyDBs20a1Nr7ZDxF7Tq8-69JheH2zeQOLkg";

/****************************************************** INIT ******************************************************/

/* Database config. Clear all tables and re-create. */
var conn = anyDB.createConnection('sqlite3://wezesha.db');
/* Temporary - won't need to drop tables every time. */
conn.query("DROP TABLE mapLocations");
conn.query("DROP TABLE users");

/* User table */
conn.query("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, userID INTEGER, username TEXT, passwordHash TEXT, isAdmin BOOLEAN)");
conn.query("INSERT INTO users (userID, username, passwordHash, isAdmin) VALUES (?, ?, ?, ?)", [1, "admin", "admin", true]);

/* Session table */
conn.query("CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, userID INTEGER, sessionID NVARCHAR(64))");

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
app.use(express.static(__dirname + "/public")); /* For client js */
app.use(express.static(__dirname + "/views")); /* For client js */
app.use(bodyParser.json()); /* Interpret JSON requests */
app.use(bodyParser.urlencoded({     
    extended: true
}));

/* TODO: Session config (Couldn't get this working) */

// app.use(session({  
//   store: new RedisStore({
//     url: config.redisStore.url
//   }),
//   secret: config.redisStore.secret,
//   resave: false,
//   saveUninitialized: false
// }))
/* Passport config */
// app.use(passport.initialize())  
// app.use(passport.session())  

var isAdmin = 0; /* TEMPORARY FOR DEMONSTRATION PURPOSES. REMOVE THIS LATER! */

/* Maps config */
var geocoder = NodeGeocoder(options);

var options = {
    provider: 'google',
    httpAdapter: 'https',
    apiKey: APIKey, /* Our Google Maps API Key */
    formatter: null
};

/****************************************************** BASIC GET REQUESTS ******************************************************/

/* GET request for top directory (http://localhost:8080) */
app.get('/',function(req, res){
    res.redirect("/index");
});

app.get('/index', function (req, res) {
    res.render('index', { title: "Home", page_name: "index", logged_in: 0});
});

/* GET request for room directory (e.g. http://localhost:8080/ABCD) */
app.get('/about', function (req, res) {
    res.render('about', { title: "About", page_name: "about"});
});

/* GET request for news page */
app.get('/news', (req, res) => {
    res.render('news', { title: "News", page_name: "news", posts: posts});
})

/* GET request for admin's version of the news page */
app.get('/admin_blog', function (req, res) {
    res.render('admin_blog', { title: "Admin Blog", page_name: "admin_blog"});
});

/* GET request for sponsors page*/
app.get('/sponsors', function (req, res) {
    res.render('sponsors', { title: "Sponsors", page_name: "sponsors"});
});

/* GET request for general map page */
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

/****************************************************** LOGIN ******************************************************/

/* Helper function to generate a unique ID and insert into the database. */
function createSessionID() {
    var sessionID = generateRandomID();
    /* Check that sessionID doesn't collide with another existing session */
    conn.query("SELECT * FROM sessions WHERE sessionID=(?)", [sessionID], function(err, rows) {
        console.log("rows length: ", rows.rows.length);
        /* Check that sessionID doesn't collide with another existing session */
        if (rows.rows.length == 0) {
            conn.query("INSERT INTO sessions (sessionID, userID) VALUES (?, ?)", [sessionID, 1], function() {
                return 1;
            });
        }
        else {
            console.log("rows: ", rows);
            return 0;
        }
    });
}

app.post('/login', function(request, response) {
    username = request.body.username;
    password = request.body.password;
    /* TODO: Check database for user authentication. Generate session ID. */

    /* Generate session ID */
    var unique = createSessionID()
    while (unique == 0) {
        /* Keep generating session IDs until we get one that is unique */
        unique = createSessionID();
    };

    /* If admin, login and then redirect to the admin version of the site */
    conn.query("SELECT isAdmin FROM users WHERE username=(?) AND passwordHash=(?)", ["admin", "admin"], function(err, rows) {
        /* TODO: Figure out if there's a better way to retrieve this data. Seems clunky to have to call "rows.rows[0].isAdmin" */
        if (rows.rows[0].isAdmin == true) {
            /* If there an admin, redirect to admin version of site */
            response.render('index', { title: "Home", page_name: "index", logged_in: 1});
        }
        else {
            /* Else, just log them in */
            response.redirect("map");
        }
    });

});

/****************************************************** MAP ******************************************************/


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
        console.log("Inserted pin into mapLocations: ", serviceType, serviceName);
        response.redirect("map");
    });
    
  /* TODO: Check validity of latitude/longitude sent to us */
  /* TODO: Check authentication of user sending request */

});

function searchServices(req, res, next) {
    /* TODO: Incorporate searching by specific location */
    var serviceType = req.body.serviceType;
    console.log("serviceType requested: ", serviceType);
    // var lat = req.body.latitude;
    // var lng = req.body.longitude;
    queryStr = "SELECT * FROM mapLocations WHERE serviceType=(?)";
    conn.query(queryStr, serviceType, function(error, rows) {
        if(rows.length !== 0) {
            req.pins = rows;
            return next();
        }
        res.render('ERROR'); /* Render the error page. */            
    });
}

function renderServices(req, res) {
    console.log("Retrieve pins: ", req.pins);
    res.render('map', {
        title: "Map",
        page_name: "map",
        pins: req.pins
    });
}

/* Finds all pins that the admin has added */
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

/* Tells the client to render these pins */
function renderPins(req, res) {
    res.render('map', {
        title: "Map",
        page_name: "map",
        pins: req.pins
    });
}

/* POST request when user looks up some services (lookup feature) */
app.post('/map', searchServices, renderServices);

/****************************************************** BLOG/NEWS ******************************************************/

Realm = require('realm');

/* TODO: Transform post schema to use this instead of the array below */
let PostSchema = {
    id: 'id',
    name: 'Post',
    properties: {
        timestamp: 'date',
        title: 'string',
        content: 'string'
    }
};

var blogRealm = new Realm({
  path: 'blog.realm',
  schema: [PostSchema]
});


/* For writing a new blog post */
/* TODO: Get this part working. Currently not doing anything with input given. */

app.get('/write', function(req, res) {
    res.render("write", { title: "Write a Post!", page_name: "write" });
});

app.post('/write', function(req, res) {
    var title = req.body['title'];
    var content = req.body['content'];
    var timestamp = new Date();
    var id = 1;
    blogRealm.write(() => { blogRealm.create('Post', {title: title, content: content, timestamp: timestamp, id: id});
  });
  res.redirect("news");
});

/* Fake posts to display for now */
const posts = [
  {
    id: 1,
    author: 'Pamela',
    title: 'Upcoming Graduation Event!',
    body: 'There is a graduation event coming up soon!',
    img: "../img/baby.jpg",
    time: "Feb 10 10:30pm"
  },
  {
    id: 2,
    author: 'Pamela',
    title: 'Recent Medical News',
    body: 'Some really cool recent medical news!',
    img: "../img/baby.jpg",
    time: "August 20 3:30pm"
  },
  {
    id: 3,
    author: 'Pamela',
    title: 'Check out these kids',
    body: 'Yeah!',
    img: "../img/baby.jpg",
    time: "Sept 5 6:00pm"
  },
  {
    id: 4,
    author: 'Pamela',
    title: 'Kids doing cool stuff',
    body: 'Awesome stuff!',
    img: "../img/baby.jpg",
    time: "April 12 9:30pm"
  }
]

/* View a single blog post */
app.get('/post/:id', (req, res) => {
  const post = posts.filter((post) => {
    return post.id == req.params.id
  })[0]

  /* render the `post.ejs` template with the post content */
  res.render('post', { title: "Post", page_name: "post", author: post.author, title: post.title, body: post.body, img: post.img });
})

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










