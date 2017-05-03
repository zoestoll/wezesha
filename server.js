var anyDB = require('any-db');
var express = require("express");
var hp = require("http");
var bodyParser = require("body-parser");
var session = require('express-session');
var socket_io = require("socket.io");
var NodeGeocoder = require('node-geocoder');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var Sequelize = require('sequelize');
var bCrypt = require("bcrypt-nodejs");
var crypto = require('crypto');
var exp = module.exports = {};


/* TODO: Update these values */
var localhost = "127.0.0.1";
var port = 8080;
var messages = [];
var APIKey = "AIzaSyDBs20a1Nr7ZDxF7Tq8-69JheH2zeQOLkg";

/****************************************************** INIT ******************************************************/

/* Database config. Clear all tables and re-create. */
var conn = anyDB.createConnection('sqlite3://wezesha.db');
/* Temporary - won't need to drop tables every time. */
// conn.query("DROP TABLE mapLocations");
// conn.query("DROP TABLE users");

/* User table */
userTableCreate = "CREATE TABLE IF NOT EXISTS 'users' ('id' INTEGER PRIMARY KEY AUTOINCREMENT, 'username' VARCHAR(255), 'password' VARCHAR(255), 'createdAt' DATETIME, 'updatedAt' DATETIME, 'salt' VARCHAR(255), 'isAdmin' BOOLEAN)"
conn.query(userTableCreate);

/* News Posts table */
newsTableCreate = "CREATE TABLE IF NOT EXISTS 'news' ('id' INTEGER PRIMARY KEY AUTOINCREMENT, 'author' VARCHAR(255), 'title' VARCHAR(255), 'body' VARCHAR(255), 'timestamp' DATETIME)";
conn.query(newsTableCreate);
var posts = [];
var sql2 = 'SELECT id, author, title, body, timestamp FROM news ORDER BY timestamp DESC';
    conn.query(sql2, function(error, result){
    posts = result.rows;
});

/* Create fake user - for testing purposes */

salt = bCrypt.genSaltSync(10);
hash = bCrypt.hashSync("admin", salt, null);
conn.query("INSERT INTO users (username, password, salt, isAdmin) VALUES (?, ?, ?, ?)", ["admin", hash, salt, true]);

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

// app.use(session({ secret: 'example' }));

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

app.use(require('express-session')({
  secret: 'keyboard cat',
  resave: true,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

var isLoggedIn = 0; /* TEMPORARY FOR DEMONSTRATION PURPOSES. REMOVE THIS LATER! */

/* Maps config */
var geocoder = NodeGeocoder(options);

var options = {
    provider: 'google',
    httpAdapter: 'https',
    apiKey: APIKey, /* Our Google Maps API Key */
    formatter: null
};

/****************************************************** AUTHENTICATION & SESSION MANAGEMENT ******************************************************/

// TODO: SESSION STUFF

// app.use(passport.session());

app.use(function (req, res, next) {
    var err = req.session.error,
        msg = req.session.success;
    delete req.session.error;
    delete req.session.success;
    res.locals.message = '';
    if (err) res.locals.message = '<p class="msg error">' + err + '</p>';
    if (msg) res.locals.message = '<p class="msg success">' + msg + '</p>';
    next();
});


/* Hashing Functions & Password Storage */
var createHash = function(password){
    return bCrypt.hashSync(password, bCrypt.genSaltSync(10), null);
}

function hashPassword(password, salt) {
    var hash = crypto.createHash('sha256');
    hash.update(password);
    hash.update(salt);
    return hash.digest('hex');
}

/* Authentication using Passport module */ 
passport.use(new LocalStrategy(function(username, password, done) {
    console.log('authenticating %s:%s', username, password);
    conn.query('SELECT * FROM users', function(err, row) {
        if (!row) {
            return done(null, false);
        }

        var hash = hashPassword(password, row.rows[0].salt);
        conn.query('SELECT * FROM users', function(err, row) {
            if (!row) {
                return done(null, false)
            }
            return done(null, row.rows[0].id);
    });
  });
}));

/* Serialize session */
passport.serializeUser(function(user, done) {
    return done(null, user);
});

passport.deserializeUser(function(id, done) {
    conn.query('SELECT id, username FROM users WHERE id = ?', id, function(err, row) {
        if (!row) {
            return done(null, false);
        }
        return done(null, row);
  });
});

/* Login */
app.get("/admin_login", function (req, res) {
    res.render('admin_login', { title: "Admin Login", page_name: "admin_login", logged_in: isLoggedIn});
});

app.post('/admin_login', passport.authenticate('local', { failureRedirect: '/admin_login' }), function(req, res) {
    isLoggedIn = 1;
    res.render('index', { title: "Home", page_name: "home", logged_in: isLoggedIn});
});

/* Signup */

app.get('/signup', function(req, res) {
    res.render('signup', { title: "Signup", page_name: "signup", logged_in: isLoggedIn});
});

app.post('/signup', function(req, res) {
    var password = req.body.password;
    var username = req.body.username;
    salt = bCrypt.genSaltSync(10);
    hash = bCrypt.hashSync(password, salt, null);
    conn.query("INSERT INTO users (id, username, password, salt, isAdmin) VALUES (?, ?, ?, ?, ?)", [1, username, hash, salt, true], function(err) {
        console.log(err);
        console.log("Signed up for a new account with username: ", username, " Password: ", password, " Password hash: ", hash, " Salt: ", salt);
        res.redirect('/admin_login');
    });
});

app.get('/logout', function (req, res) {
    req.session.destroy(function () {
        res.redirect('/');
    });
});

/****************************************************** BASIC GET REQUESTS ******************************************************/

/* GET request for top directory (http://localhost:8080) */
app.get('/',function(req, res){
    // console.log("Req session: ", req.session)
    if (req.user) {
        res.render('index', { title: "Home", page_name: "home", logged_in: 1});
    } else {
        res.render('index', { title: "Home", page_name: "home", logged_in: 0});
    }
});

/* Sign up for new account */
app.get("/signup", function (req, res) {
    if (req.session.user) {
        res.redirect("/");
    } else {
        res.render('signup', { title: "Signup", page_name: "signup", logged_in: isLoggedIn});
    }
});

app.get('/index', function (req, res) {
    if (req.user) {
        res.render('index', { title: "Home", page_name: "home", logged_in: 1});
    } else {
        res.render('index', { title: "Home", page_name: "home", logged_in: 0});
    }
});

/* GET request for room directory (e.g. http://localhost:8080/ABCD) */
app.get('/about', function (req, res) {
    if (req.user) {
        res.render('about', { title: "About", page_name: "about", logged_in: 1});
    } else {
        res.render('about', { title: "About", page_name: "about", logged_in: 0});
    }
});

/* GET request for news page */
app.get('/news', function (req, res) {
    var sql2 = 'SELECT id, author, title, body, timestamp FROM news ORDER BY timestamp DESC';
    conn.query(sql2, function(error, result){
        posts = result.rows;
    });

    res.render('news', { title: "News", page_name: "news", posts: posts, logged_in: isLoggedIn});
})

/* GET request for admin's version of the news page */
app.get('/admin_blog', function (req, res) {
    res.render('admin_blog', { title: "Admin Blog", page_name: "admin_blog", logged_in: isLoggedIn});
});

/* GET request for sponsors page*/
app.get('/sponsors', function (req, res) {
    res.render('sponsors', { title: "Sponsors", page_name: "sponsors", logged_in: isLoggedIn});
});

/* GET request for general map page */
app.get('/map', findPins, renderPins);

/* GET request for general map page */
app.get('/admin_map', findPins, renderPins);

/* GET request for donations page */
app.get('/donations', function (req, res) {
    res.render('donations', { title: "Donations", page_name: "donations", logged_in: isLoggedIn});
});

/* GET request for login form */
app.get('/login', function (req, res) {
    res.render('admin_login', { title: "Login", page_name: "login", logged_in: isLoggedIn});
});

/* GET request for login form */
app.get('/admin_map', function (req, res) {
    res.render('admin_map', { title: "Admin Map", page_name: "admin_map", logged_in: isLoggedIn});
});


/****************************************************** MAP ******************************************************/


app.post('/addPin', function(request, response) {
    // if (!request.user) {  Unauthorized to add pin. TODO: check that user is admin. 
    //     response.redirect("map");
    // }
    username = request.body.username;
    /* TODO: Check session ID and CSRF token to be sure the user is logged in, and is the admin. This prevents CSRF. */

    /* Request parameters */
    serviceType = request.body.serviceType;
    serviceName = request.body.serviceName;
    address = request.body.address;
    lat = request.body.latitude;
    lng = request.body.longitude;
    queryStr = "INSERT INTO mapLocations (serviceType, serviceName, address, latitude, longitude) VALUES (?,?,?,?,?)"
    conn.query(queryStr, [serviceType, serviceName, address, lat, lng], function() {
        // console.log("Inserted pin into mapLocations: ", serviceType, serviceName);
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
        pins: req.pins,
        logged_in: isLoggedIn
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
    console.log("Rendering pins: ", req.pins);
     if (req.user) { // TODO: Check that they're an admin
         res.render('admin_map', {
            title: "Admin Map",
            page_name: "map",
            pins: req.pins,
            logged_in: 1
        });
    } else { /* unauthorized to view admin map */
        res.render('map', {
            title: "Map",
            page_name: "map",
            pins: req.pins,
            logged_in: 0
        });
    }
}

/* POST request when user looks up some services (lookup feature) */
app.post('/map', searchServices, renderServices);

/****************************************************** BLOG/NEWS ******************************************************/

/* View a single blog post */
app.get('/post/:id', (req, res) => {
  const post = posts.filter((post) => {
    return post.id == req.params.id
  })[0];

  /* render the 'post.ejs' template with the post content */
  res.render('post', { title: "Post", page_name: "post", author: post.author, title: post.title, body: post.body, logged_in: isLoggedIn});
});

/* For writing a new blog post */

app.get('/write', function(req, res) {
    if (req.user) {
        res.render("write", { title: "Write a Post!", page_name: "write" , logged_in: 1});
    } else {
        res.redirect('news');
    }
});

app.post('/write', function(req, res) {

    if (req.user) { /* Check that they're authorized to send this request */
        var author = req.body['author'];
        var title = req.body['title'];
        var body = req.body['body'];
        var timestamp = getPrettyDate();
        var sql = 'INSERT INTO news (author, title, body, timestamp) VALUES ($1, $2, $3, $4)';
        conn.query(sql, [author, title, body, timestamp]);
        /* new posts are on top */
        var sql2 = 'SELECT id, author, title, body, timestamp FROM news ORDER BY timestamp DESC';
        conn.query(sql2, function(error, result){
            posts = result.rows;
        });
    }

    res.redirect("news");
});

/****************************************************** EDUCATION NEWS PAGE ******************************************************/

/* GET request for news page */
app.get('/education', function (req, res) {
    res.render('education', { title: "Education", page_name: "education", posts: posts, logged_in: isLoggedIn});
})

/****************************************************** MEDICAL NEWS PAGE ******************************************************/


/* GET request for news page */
app.get('/medical', function (req, res) {
    res.render('medical', { title: "Medical", page_name: "medical", posts: posts, logged_in: isLoggedIn});
})

/****************************************************** COMMUNITY NEWS PAGE ******************************************************/


/* GET request for news page */
app.get('/community', function (req, res) {
    res.render('community', { title: "Community", page_name: "community", posts: posts, logged_in: isLoggedIn});
})

/****************************************************** PARTNERS NEWS PAGE ******************************************************/


/* GET request for news page */
app.get('/partners', function (req, res) {
    res.render('partners', { title: "Partners", page_name: "partners", posts: posts, logged_in: isLoggedIn});
})

/****************************************************** SOCKET EVENTS ******************************************************/

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
    var pd = (time.getMonth()+1) + "-" + time.getDate()  + "-"; 
    pd += time.getFullYear() + " " + ("0" + time.getHours()).slice(-2);
    pd += ":" + ("0" + time.getMinutes()).slice(-2);
    return pd;
}

/* Start listening */
http.listen(app.get("port"), app.get("ipaddr"), function(){
    console.log("server listening on port " + port);
});

/* for backend testing */
exp.closeServer = function(){
    http.close();
};








