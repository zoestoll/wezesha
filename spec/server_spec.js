var request = require("request");
var server = require("../server.js");
var base_url = "http://localhost:8080/";

describe("Backend Server", function(){
	/* testing the default page */
	describe("GET /", function(){

		// making sure 200 OK status is received
		it("returns status code 200", function(done){
			request.get(base_url, function(error, response, body){
				expect(response.statusCode).toBe(200);
				done();
			});
		});

		it("returns no errors", function(done){
			request.get(base_url, function(error, response, body){
				expect(error).toBe(null);
				done();
			});
		});
	});

	/* testing posting information retrieved from form */
	describe("POST /write", function(){
		url = base_url + "write";

		// making sure the site is redirecting to the right location
		it("returns status code 302", function(done){
			request.post(url, function(error, response, body){
				expect(response.statusCode).toBe(302);
				done();
			});
		});

		it("returns no errors", function(done){
			request.post(url, function(error, response, body){
				expect(error).toBe(null);
				done();
			});
		});
	});

	describe("GET /write", function(){
		url = base_url + "write";

		it("returns status code 200", function(done){
			request.get(url, function(error, response, body){
				expect(response.statusCode).toBe(200);
				done();
			});
		});

		it("returns no errors", function(done){
			request.get(url, function(error, response, body){
				expect(error).toBe(null);
				done();
			});
		});
	});

	describe("GET /admin_login", function(){
		url = base_url + "admin_login";

		it("returns status code 200", function(done){
			request.get(url, function(error, response, body){
				expect(response.statusCode).toBe(200);
				done();
			});
		});

		it("returns no errors", function(done){
			request.get(url, function(error, response, body){
				expect(error).toBe(null);
				done();
			});
		});
	});

	describe("POST /admin_login", function(){
		url = base_url + "admin_login";

		it("returns status code 302", function(done){
			request.post(url, function(error, response, body){
				expect(response.statusCode).toBe(302);
				done();
			});
		});

		it("returns no errors", function(done){
			request.post(url, function(error, response, body){
				expect(error).toBe(null);
				server.closeServer();
				done();
			});
		});
	});

});