var rsaSign = require("jsrsasign");
var io = require("socket.io-client");
var argv = require('minimist')(process.argv.slice(2));

var Transaction = require("./../core/transaction.js");

//Generate new key pair
if(argv.g){
	console.log("Generating a new ECDSA key pair!");
	
	var ec = new rsaSign.KJUR.crypto.ECDSA({'curve': 'secp256r1'});
	var keypair = ec.generateKeyPairHex();
	
	console.log("Public key: " + keypair.ecpubhex);
	console.log("Private key: " + keypair.ecprvhex);
	
	process.exit(1);
}

//Check address balance
if(argv.b){
	var socket = io("http://localhost:3000");
	
	socket.on("connect", function(){
		socket.emit("get balance", argv.b);
	});
	socket.on("balance", function(balance){
		console.log("Address " +  argv.b + " has " + balance + " coins.");
		process.exit(1);
	});
	socket.on("disconnect", function(){
		process.exit(0);
	});
	socket.emit("get balance", argv.b);
}

//Send payment
if(argv.p){
	var socket = io("http://localhost:3000");
	
	socket.on("connect", function(){
		var transaction = new Transaction(argv.from, argv.to, argv.amount, require("uuid/v4")());
		
		var ec = new rsaSign.KJUR.crypto.ECDSA({'curve': 'secp256r1'});
		
		transaction.hash = ec.signHex(rsaSign.KJUR.crypto.Util.sha256(transaction.toString()), argv.secret)
		console.log("Transaction hash: " + transaction.hash);
		
		console.log("Adding transaction to the pool.");
		socket.emit("add transaction", transaction);
	});
	
	socket.on("transaction add result", function(success){
		if(success){
			console.log("Transaction confirmed... Waiting to be added in a block.");
		}
		else{
			console.log("Transaction rejected.");
		}
		process.exit(1);
	});
	
	socket.on("disconnect", function(){
		process.exit(0);
	});
}