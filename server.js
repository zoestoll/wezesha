var anyDB = require('any-db');
var express = require("express");
var hp = require("http");
var bodyParser = require("body-parser");
var session = require('express-session');
var NodeGeocoder = require('node-geocoder');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var bCrypt = require("bcrypt-nodejs");
var crypto = require('crypto');
var exp = module.exports = {};

/* TODO: Update these values */
var localhost = "127.0.0.1";
var port = 8080;
var APIKey = "AIzaSyDBs20a1Nr7ZDxF7Tq8-69JheH2zeQOLkg";

/****************************************************** SETUP DB AND INITIALIZE ******************************************************/

/* Database config. Clear all tables and re-create. */
var conn = anyDB.createConnection('sqlite3://wezesha.db');

/* User table */
userTableCreate = "CREATE TABLE IF NOT EXISTS 'users' ('id' INTEGER PRIMARY KEY AUTOINCREMENT, 'username' VARCHAR(255), 'password' VARCHAR(255), 'createdAt' DATETIME, 'updatedAt' DATETIME, 'salt' VARCHAR(255), 'isAdmin' BOOLEAN)"
conn.query(userTableCreate);

/* News Posts table */
newsTableCreate = "CREATE TABLE IF NOT EXISTS 'news' (" +
    "'id' INTEGER PRIMARY KEY AUTOINCREMENT," + 
    "'author' VARCHAR(255), 'title' VARCHAR(255)," +
    "'body' VARCHAR(255)," + 
    "'timestamp' DATETIME," +
    "'education' BOOLEAN," + 
    "'community' BOOLEAN," + 
    "'medical' BOOLEAN," + 
    "'partners' BOOLEAN)";  
conn.query(newsTableCreate);

var posts = [];
var initialPosts = 'SELECT id, author, title, body, timestamp FROM news ORDER BY timestamp DESC';
conn.query(initialPosts, function(error, result){
    if (result != undefined) {
        posts = result.rows;
    }
});

donationTableCreate = "CREATE TABLE IF NOT EXISTS 'donations' ('id' INTEGER PRIMARY KEY AUTOINCREMENT, 'name' VARCHAR(255), 'amount' INTEGER, 'email' VARCHAR(255), 'address' VARCHAR(255), 'cause' VARCHAR(255), 'timestamp' DATETIME)";
conn.query(donationTableCreate);
var donations = [];
var initialDonations = 'SELECT id, name, amount, email, address, cause, timestamp FROM donations ORDER BY timestamp DESC';
conn.query(initialDonations, function(error, result){
    if (result != undefined) {
        donations = result.rows;
    }
});

/* Create fake user - for testing purposes */
salt = bCrypt.genSaltSync(10);
hash = bCrypt.hashSync("admin", salt, null);
console.log("Salt stored as ", salt);
console.log("Hash stored as ", hash);
conn.query("INSERT INTO users (username, password, salt, isAdmin) VALUES (?, ?, ?, ?)", ["admin", hash, salt, true]);

/* Session table */
conn.query("CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, userID INTEGER, sessionID NVARCHAR(64))");

/* Map table */
conn.query("CREATE TABLE IF NOT EXISTS mapLocations(id INTEGER PRIMARY KEY AUTOINCREMENT, serviceType TEXT, serviceName TEXT, description TEXT, address TEXT, latitude INTEGER, longitude INTEGER)");

/* Server config */
app = express()
http = hp.createServer(app)
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

app.use(require('express-session')({
  secret: 'keyboard cat',
  resave: true,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

/* Maps config */
var geocoder = NodeGeocoder(options);

var options = {
    provider: 'google',
    httpAdapter: 'https',
    apiKey: APIKey, /* Our Google Maps API Key */
    formatter: null
};

/****************************************************** AUTHENTICATION & SESSION MANAGEMENT ******************************************************/

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

/* Authentication using Passport module */ 
passport.use(new LocalStrategy(function(username, password, done) {
    console.log('authenticating %s:%s', username, password);
    conn.query('SELECT salt FROM users', function(err, row) {
        if (!row) {
            return done(null, false);
        }
        salt = row.rows[0].salt;
        hash = bCrypt.hashSync(password, salt, null);

        conn.query('SELECT * FROM users WHERE password=(?)', [hash], function(err, row) {
            if (row.rows[0] == undefined) {
                console.log("Incorrect password!", row);
                return done(null, false)
            }
            else {
                return done(null, true);
            }
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
    res.render('admin_login', { title: "Admin Login", page_name: "admin_login", logged_in: req.isAuthenticated()});
});

app.post('/admin_login', passport.authenticate('local', { failureRedirect: '/admin_login' }), function(req, res) {
    /* Successful login */
    res.render('index', { title: "Home", page_name: "home", logged_in: req.isAuthenticated()});
});

/* Signup */

app.get('/signup', function(req, res) {
    res.render('signup', { title: "Signup", page_name: "signup", logged_in: req.isAuthenticated()});
});

app.post('/signup', function(req, res) {
    var password = req.body.password;
    var username = req.body.username;
    salt = bCrypt.genSaltSync(10);
    hash = bCrypt.hashSync(password, salt, null);
    conn.query("INSERT INTO users (id, username, password, salt, isAdmin) VALUES (?, ?, ?, ?, ?)", [1, username, hash, salt, true], function(err) {
        console.log("Signed up for a new account with username: ", username, " Password: ", password, " Password hash: ", hash, " Salt: ", salt);
        res.redirect('/admin_login');
    });
});

app.get('/logout', function (req, res) {
    req.session.destroy(function () {
        res.redirect('/');
    });
});

/****************************************************** GET REQUESTS ******************************************************/

/* GET request for top directory (http://localhost:8080) */
app.get('/',function(req, res){
    if (req.user) {
        res.render('index', { title: "Home", page_name: "home", logged_in: req.isAuthenticated()});
    } else {
        res.render('index', { title: "Home", page_name: "home", logged_in: req.isAuthenticated()});
    }
});

/***** NAVIGATION BAR PAGES: (1) Home, (2) About, (3) News, (4) Find Us, (5) Resources *****/

/* (1) GET request for home */
app.get('/index', function (req, res) {
    res.render('index', { title: "Home", page_name: "home", logged_in: req.isAuthenticated()});
});

/* (2) GET request for about */
app.get('/about', function (req, res) {
    res.render('about', { title: "About", page_name: "about", logged_in: req.isAuthenticated()});
});

/* (3) GET request for news page */
app.get('/news', function (req, res) {
    var sql = 'SELECT id, author, title, body, timestamp FROM news ORDER BY timestamp DESC';
    conn.query(sql, function(error, result){
        var posts = [];
        if (result != undefined) {
            posts = result.rows;
        }      
        if (req.isAuthenticated()) {
            res.render('admin_news', { title: "News", page_name: "news", posts: posts, logged_in: req.isAuthenticated()});
        } else {
            res.render('news', { title: "News", page_name: "news", posts: posts, logged_in: req.isAuthenticated()});
        }
    });
})

/* GET request for admin's version of the news page */
/* (4) GET request for findus  */
app.get('/admin_news', function (req, res) {
    if (req.isAuthenticated()) {
        res.render('admin_news', { title: "News", page_name: "news", logged_in: req.isAuthenticated()});
    } else {
        res.redirect("news");
    }
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    /* Checks if req.user is available */
    return next(); }

  /* denied. redirect to login */
  res.redirect('/')
}

/* (4) GET request for findus  */
app.get('/findus', function (req, res) {
    res.render('findus', { title: "Find Us", page_name: "findus", logged_in: req.isAuthenticated()});
});

/* (5) GET request for resources page*/
app.get('/resources', function (req, res) {
    res.render('resources', { title: "Resources", page_name: "resources", logged_in: req.isAuthenticated()});
});

/***** Subpages of resources page: (a) sponsors, (b) map, (c) handouts *****/

/* (a) GET request for sponsors page*/
app.get('/sponsors', function (req, res) {
    res.render('sponsors', { title: "Sponsors", page_name: "sponsors", logged_in: req.isAuthenticated()});
});

/* (b) GET request for general (non-admin) map page */
app.get('/map', findPins, renderPins);

/* (c) GET request for handouts page*/
app.get('/handouts', function (req, res) {
    res.render('handouts', { title: "Handouts", page_name: "handouts", logged_in: req.isAuthenticated()});
});

/***** ADMIN REQUESTS *****/

/* GET request for general map page */
app.get('/admin_map', ensureAuthenticated, findPins, renderPins);

/* GET request for donations page */
app.get('/donations', function (req, res) {
    if (req.isAuthenticated()) {
        res.render('admin_donations', { title: "Donations", page_name: "admin_donations", logged_in: req.isAuthenticated()});
    } else {
        res.render('donations', { title: "Donations", page_name: "donations", logged_in: req.isAuthenticated()});
    }
});


/**************************************************** ACCOUNT REQUESTS *************************************************/

/* Sign up for new account */
app.get("/signup", function (req, res) {
    if (req.session.user) {
        res.redirect("/");
    } else {
        res.render('signup', { title: "Signup", page_name: "signup", logged_in: req.isAuthenticated()});
    }
});

/* GET request for login form */
app.get('/login', function (req, res) {
    res.render('admin_login', { title: "Login", page_name: "login", logged_in: req.isAuthenticated()});
});

/* GET request for login form */
app.get('/admin_map', function (req, res) {
    res.render('admin_map', { title: "Admin Map", page_name: "admin_map", logged_in: req.isAuthenticated()});
});

/* GET request for login form */
app.get('/admin_donations', ensureAuthenticated, function (req, res) {
    res.render('admin_donations', { title: "Donations", page_name: "admin_donations", logged_in: req.isAuthenticated()});
});


/****************************************************** MAP ******************************************************/


app.post('/addPin', function(request, response) {
    if (!request.user) {  /* Unauthorized to add pin. TODO: check that user is admin. */
        response.redirect("map");
    }
    else {
        username = request.body.username;
        /* TODO: Check session ID and CSRF token to be sure the user is logged in, and is the admin. This prevents CSRF. */
        /* Request parameters */
        serviceType = request.body.serviceType;
        serviceName = request.body.serviceName;
        description = request.body.description;
        address = request.body.address;
        lat = request.body.latitude;
        lng = request.body.longitude;
        queryStr = "INSERT INTO mapLocations (serviceType, serviceName, description, address, latitude, longitude) VALUES (?,?,?,?,?,?)"
        conn.query(queryStr, [serviceType, serviceName, description, address, lat, lng], function() {
            // console.log("Inserted pin into mapLocations: ", serviceType, serviceName);
            response.redirect("map");
        });
    }
});

function searchServices(req, res, next) {
    var serviceType = req.body.serviceType;
    // console.log("serviceType requested: ", serviceType);
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
    // console.log("Retrieve pins: ", req.pins);
    res.render('map', {
        title: "Map",
        page_name: "map",
        pins: req.pins,
        logged_in: req.isAuthenticated()
    });
}

/* Finds all pins that the admin has added */
function findPins(req, res, next) {
    var queryStr = 'SELECT * FROM mapLocations';
    conn.query(queryStr, function(error, rows) {
        console.log("rows: ", rows);
        if(rows.length !== 0) {
            req.pins = rows;
            return next();
        }
        res.render('ERROR'); /* Render the error page. */            
    });
}

/* Tells the client to render these pins */
function renderPins(req, res) {
     if (req.user) { // TODO: Check that they're an admin
         res.render('admin_map', {
            title: "Admin Map",
            page_name: "map",
            pins: req.pins,
            logged_in: req.isAuthenticated()
        });
    } else { /* unauthorized to view admin map */
        res.render('map', {
            title: "Map",
            page_name: "map",
            pins: req.pins,
            logged_in: req.isAuthenticated()
        });
    }
}

/* POST request when user looks up some services (lookup feature) */
app.post('/map', searchServices, renderServices);


/****************************************************** BLOG/NEWS ******************************************************/

/* View a single blog post */
app.get('/post/:id', (req, res) => {
    var id = req.params.id;
    var sql = 'SELECT id, author, title, body, timestamp, education, community, medical, partners FROM news WHERE id = $1';

    conn.query(sql, [id], function(error, result){
        post = result.rows[0];

        if (req.isAuthenticated()) {
            res.render('admin_post', 
                { title: "Post", 
                page_name: "admin_post", 
                post_id: post.id, 
                author: post.author, 
                title: post.title, 
                body: post.body, 
                timestamp: post.timestamp,
                logged_in: req.isAuthenticated()
            });

        } else {
            res.render('post', 
                { title: "Post", 
                page_name: "post", 
                author: post.author, 
                title: post.title, 
                body: post.body, 
                timestamp: post.timestamp,
                logged_in: req.isAuthenticated()
            });
        }
    });
});


app.get('/write', function(req, res) {
    if (req.isAuthenticated()) {
        res.render("write", { title: "Write a Post!", page_name: "write", logged_in: req.isAuthenticated()});
    } else {
        res.redirect('/news');
    }
});


function isChecked(req, category) {
    if (req.body[category] == undefined) {
        return false;
    } else {
        return true;
    }
}

app.post('/write', function(req, res) {

    /* Check that they're authorized to send this request */
    if (req.isAuthenticated()) { 
        var author = req.body['author'];
        var title = req.body['title'];
        var body = req.body['body'];
        var timestamp = getPrettyDate();

        var sql = 'INSERT INTO news (author, title, body, timestamp, education, community, medical, partners) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
        conn.query(sql, [author, title, body, timestamp,
            isChecked(req, "education"),
            isChecked(req, "community"),
            isChecked(req, "medical"),
            isChecked(req, "partners")
        ]);

        /* new posts are on top */
        var sql2 = 'SELECT id, author, title, body, timestamp FROM news ORDER BY timestamp DESC';
        conn.query(sql2, function(error, result){
            var posts = [];
            if (result != undefined) {
                posts = result.rows;
            }
        });
    }

    res.redirect("/news");
});

/****************************************************** BLOG CONTENT EDITING ******************************************************/

app.get('/edit/:id', (req, res) => {

    if (req.isAuthenticated()) {
        var id = req.params.id;
        var sql = 'SELECT id, author, title, body, timestamp FROM news WHERE id = $1';
        conn.query(sql, [id], function(error, result){
            post = result.rows[0];
            res.render('edit', { title: "Edit", page_name: "edit", post_id: post.id, author: post.author, title: post.title, body: post.body, logged_in: req.isAuthenticated()});
        });

    } else {
        res.redirect("/news");
    }
});


app.post('/edit/:id', function(req, res) {

    /* Check that they're authorized to send this request */
    if (req.isAuthenticated()) {
        var author = req.body['author'];
        var title = req.body['title'];
        var body = req.body['body'];
        var id = req.body['id'];
        var timestamp = getPrettyDate();

        var sql = "UPDATE news SET author = $1, title = $2, body = $3, timestamp = $4 WHERE id = $5";
        conn.query(sql, [author, title, body, timestamp, id]);
        
        /* new posts are on top */
        var sql2 = 'SELECT id, author, title, body, timestamp FROM news ORDER BY timestamp DESC';
        conn.query(sql2, function(error, result){
            var posts = [];
            if (result != undefined) {
                posts = result.rows;
            }
        });
    } 

    res.redirect("/news");
});


/********************************************** DONATIONS PAGE ******************************************************/

app.post('/donations', function (req, res) {
    var name = req.body.name;
    var amount = req.body.amount;
    var email = req.body.email;
    var address = req.body.address;
    var cause = req.body.cause;
    var timestamp = getPrettyDate();
    var sql = 'INSERT INTO donations (name, amount, email, address, cause, timestamp) VALUES ($1, $2, $3, $4, $5, $6)';
    conn.query(sql, [name, amount, email, address, cause, timestamp]);

    var sql2 = 'SELECT id, name, amount, email, address, cause, timestamp FROM donations ORDER BY timestamp DESC';
        conn.query(sql2, function(error, result){
        donations = result.rows;
    });
    res.redirect('https://ywamtyler.org/funddonation?uid=8c0fa911-e498-4136-afda-614268c56541');
});


app.get('/donation_data', ensureAuthenticated, function(req, res) {
    if (req.user) {
        var sql = 'SELECT id, name, amount, email, address, cause, timestamp FROM donations ORDER BY timestamp DESC';
        conn.query(sql, function(error, result){
            donations = result.rows;
        });
        res.render("donation_data", { title: "Donation Data", page_name: "donation_data", posts: donations, logged_in: req.isAuthenticated()});
    } else {
        res.redirect("donations");
    }
});

/****************************************************** EDUCATION PAGE ******************************************************/

/* GET request for news page */
app.get('/education', function (req, res) {

    /* Funding opportunities */
    var sql = 'SELECT id, author, title, body, timestamp FROM news WHERE education = $1 ORDER BY timestamp DESC';
    conn.query(sql, true, function(error, result){
        var education_posts = [];        
        if (result != undefined) {
            education_posts = result.rows;
        }
        res.render('education', { title: "Education", page_name: "education", posts: education_posts, logged_in: req.isAuthenticated()});
    });

});

/****************************************************** MEDICAL PAGE ******************************************************/

/* GET request for news page */
app.get('/medical', function (req, res) {
    var sql = 'SELECT id, author, title, body, timestamp FROM news WHERE medical = $1 ORDER BY timestamp DESC';
    conn.query(sql, true, function(error, result){
        var medical_posts = [];
        if (result != undefined) {
            medical_posts = result.rows;
        }      
        res.render('medical', { title: "Medical", page_name: "medical", posts: medical_posts, logged_in: req.isAuthenticated()});
    });
})

/****************************************************** COMMUNITY PAGE ******************************************************/

/* GET request for news page */
app.get('/community', function (req, res) {
    var sql = 'SELECT id, author, title, body, timestamp FROM news WHERE community = $1 ORDER BY timestamp DESC';
    conn.query(sql, true, function(error, result){
        var community_posts = [];
        if (result != undefined) {
            community_posts = result.rows;
        }      
        res.render('community', { title: "Community", page_name: "community", posts: community_posts, logged_in: req.isAuthenticated()});
    });
})

/****************************************************** PARTNERS PAGE ******************************************************/

/* GET request for news page */
app.get('/partners', function (req, res) {
    var sql = 'SELECT id, author, title, body, timestamp FROM news WHERE partners = $1 ORDER BY timestamp DESC';
    conn.query(sql, true, function(error, result){
        var partner_posts = [];
        if (result != undefined) {
            partner_posts = result.rows;
        }      
        res.render('partners', { title: "Partners", page_name: "partners", posts: partner_posts, logged_in: req.isAuthenticated()});
    });
})

/****************************************************** HANDOUTS PAGE ******************************************************/

/* GET request for handouts page */
app.get('/handouts', function (req, res) {
    res.render('handouts', { title: "Handouts", page_name: "handouts", logged_in: req.isAuthenticated()});
})

/* GET request for handouts swahili page */
app.get('/handouts_swahili', function (req, res) {
    res.render('handouts_swahili', { title: "Handouts Swahili", page_name: "handouts_swahili", logged_in: req.isAuthenticated()});
})

/******************************************************* HELPER FUNCTIONS ******************************************************/

function getPrettyDate() {
    /* Get current time */
    var time = new Date();
    /* Make it pretty */
    var pd = (time.getMonth()+1) + "-" + time.getDate()  + "-"; 
    pd += time.getFullYear() + " " + ("0" + time.getHours()).slice(-2);
    pd += ":" + ("0" + time.getMinutes()).slice(-2);
    return pd;
}

/* for backend testing */
exp.closeServer = function(){
    http.close();
};

/************************************************************* LISTENING ******************************************************/

http.listen(app.get("port"), app.get("ipaddr"), function(){
    console.log("server listening on port " + port);
});









