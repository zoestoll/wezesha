var ENTER = 13;
var INTERVAL = 1000;

function begin() {
    window.onload = function() {
        stream = setInterval(function() {
            queryServer();
        }, INTERVAL);
    };
    /* Global variables for each client */
    var URL = document.domain;
    var socket = io.connect(URL);
    var roomName = window.location.pathname.split('/')[1];
    var username = generateRandomID();
    $('#username').val(username);
    var userID = "";
    var messageIDList = [];
    var userIDDict = {};
    var lastKeyEnter = 1;

    /****************************************************** SOCKET EVENTS *****************************************************
    /*
    Server event: connect
    Client event: newUser -> tells the socket that there's a new user
    */
    socket.on('connect', function () {
        if (roomName == "/") {
            console.log("Home page. Do nothing.");
        }
        else {
            socket.emit('joinRoom', {roomName: roomName, username: username});
        }
    });

    /*
    Server: informs client of new message
    Client: displays message
    */

    socket.on('incomingMessage', function (data) {
        var id = data.id;
        var message = data.message;
        if (messageIDList.indexOf(id) == -1) {
            addMessage(data.time, data.username, message, " wrote: ");
        }
        messageIDList.push(id);
    });

    socket.on('confirmNameChange', function (data) {
        $('#messages').prepend('<b>' + data.oldUsername + ' has changed their name username to ' + data.newUsername + '<hr />');
        $('#' + data.userID).html('<span id="' + data.userID + '">' + data.newUsername + '</span>');
    });

    socket.on("newUser", function(data) {
        /* Button feature allows for private messaging between users */
        $('#users').append('<span id="' + data.userID + '">' + data.username + ' </span>' + "<button id=button" + data.userID + ">Click to message</button>" + "<br />");
        $( "#button" + data.userID).click(function() {
            var pm = prompt('Enter a private message for ' + data.username);
            if (pm == '') {
                return;
            }
            socket.emit("privateMessage", {username: username, userID: data.userID, pm: pm});
        });
    });

    socket.on("userLeft", function(data) {
        $('#' + data.userID).remove();
    });

    socket.on("privateMessage", function(data) {
        var date = getPrettyDate();
        addMessage(date, data.username, data.pm, " wrote: ");
    });

    socket.on('confirmMessage', function (data) {
        /* Our message is confirmed by server and its ID is sent back to us, so add it to the list. */
        messageIDList.push(data.messageID);
    });

    socket.on('confirmJoin', function (data) {
        /* Keep track of our own user ID. */
        userID = data.userID;
    });


    socket.on('typing', function (data) {
        addMessage(data.time, data.username, "is typing...", "");
    });

  /****************************************************** SOCKET ERROR HANDLERS ******************************************************/

    /*
    Error if unable to connect to server
    */
    socket.on('error', function (data) {
        console.log('Unable to connect to server', data);
    });

    /* This function is for when a user tries to go to a room that doesn't exist. */
    socket.on("invalidRoomError", function(data) {
        $("#messages").prepend("<h1 style='color:red;'>YOU ARE INVALID GET OUT!</h1>");
        $("#messages").prepend("You may have restarted the server and now the room IDs have been regenerated.");
    });

   /****************************************************** KEY/MOUSE FUNCTIONS ******************************************************/

    /*
    If user presses enter, call newMessage only if there
    is text in the textarea
    */

    function enter(event) {
        username = $('#username').val(); /* Always check to see if username has been changed */
        if (!checkValid(username, userID)) {
            return;
        }
        if (event.which == ENTER) { /* enter key = 13 */
            event.preventDefault();
            var message = $('#outgoing').val(); /* Get the text you are trying to send */
            if (message.trim().length <= 0) { /* Check that there is text in the comment area */
                return;
            }
            newMessage(message);
            /* The time on the server end may be slightly different from the one calculated here, depending on how long the request takes to get to the server.
            But instead of passing the server our calculated time, it is better for the server to do so, because in more security-crucial programs
            if the client can change code aroudn they might mess with the current time to do malicious things. For example, if the client on Banner could change the current date form the client side,
            they could enroll in classes after the deadline to do so has passed.
            So it's important that time be calculated server side. This one here is just for displaying our own message to ourself instantly. */
            var time = new Date(); /* Gets current time */
            var prettyDate = time.getDate()  + "-" + (time.getMonth()+1) + "-" + time.getFullYear() + " " + ("0" + time.getHours()).slice(-2) + ":" + ("0" + time.getMinutes()).slice(-2);
            addMessage(prettyDate, "You ", message, "wrote: ");
            $('#outgoing').val('');
            lastKeyEnter = 1;
        }
        else { /* Otherwise emit a typing event */
            if (lastKeyEnter) {
                socket.emit('typing', {userID: userID, username: username, roomName: roomName});
                lastKeyEnter = 0;
            }
        }
    }

    function queryServer() {
        socket.emit('updateRequest', {roomName: roomName});
    }

    /*
    Client function: update server if you change your username
    */
    function changeName() {
        var currUsername = $('#username').val();
        if (currUsername != username) {
            socket.emit('changeName', {roomName: roomName, oldUsername: username, newUsername: currUsername});
            username = currUsername;
        }

    };

    /****************************************************** HELPER FUNCTIONS ******************************************************/

    /* Helper function for displaying messages */
    function addMessage(date, username, message, messageType) {
        $('#messages').prepend('<span style="color:red; font-size:16px;" >' + date + '</span>  \n' + username + messageType + ' </b><br />' + message + '<hr />');  /* Display your own message */
    }

    /* Helper function to deal invalid users. This can happen if you are still on an old chatroom, and you restarted the server,
        since the user will no longer be in the database. This can also happen if there is an issue calling newUser. */
    function checkValid(username, userID) {
        if (username == "" || userID == "") {
            console.log("Error: Invalid username or userID.");
            return 0;
        }
        return 1;
    }

    function generateRandomID() { /* From TA suggested code */
        /* make a list of legal characters */
        var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        var result = '';
        for (var i = 0; i < 6; i++)
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        return result;
    };

    /*
    Client function: send a new message in an ajax request
    POST request for new Message.
    Using POST over GET for security since a new message will modify the database.
    */
    function newMessage(message) {
        username = $('#username').val(); /* Always check to see if username has been changed */
        if (!checkValid(username, userID)) {
            return;
        }
        if (message == '') {
            return;
        }
        socket.emit('newMessage', {message: message, username: username, userID: userID, roomName: roomName});

    }

    function getPrettyDate() {
        /* Get current time */
        var time = new Date();
        /* Make it pretty */
        var prettyDate = time.getDate()  + "-" + (time.getMonth()+1) + "-" + time.getFullYear() + " " + ("0" + time.getHours()).slice(-2) + ":" + ("0" + time.getMinutes()).slice(-2);
        return prettyDate;
    }

    /* HTML tags */
    $('#outgoing').on('keydown', enter);
    $('#username').on('focusout', changeName);
    $('#send').on('click', newMessage);
    
};


$(document).on('ready', begin);


















