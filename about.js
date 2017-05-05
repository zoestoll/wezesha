

/****************************************************** BLOG/NEWS ******************************************************/

/****************************************************** EDUCATION NEWS PAGE ******************************************************/

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







