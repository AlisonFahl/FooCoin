const fs = require('fs');
const rsaSign = require("jsrsasign");
const io = require("socket.io-client");
const argv = require('minimist')(process.argv.slice(2));

var Transaction = require("./../core/transaction.js");

var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

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
	var socket = io(config.server);
	
	socket.on("connect", function(){
		console.log("Requesting balance...");
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
	if(!argv.from){
		console.error("Parameter 'from' is not valid");
		process.exit(0);
	}
	if(!argv.to){
		console.error("Parameter 'to' is not valid");
		process.exit(0);
	}
	if(!argv.amount || !Number.isInteger(argv.amount)){
		console.error("Parameter 'amount' is not valid");
		process.exit(0);
	}
	if(!argv.secret){
		console.error("Parameter 'secret' is not valid");
		process.exit(0);
	}
	
	var socket = io(config.server);
	
	socket.on("connect", function(){
		var transaction = new Transaction(argv.from, argv.to, argv.amount, require("uuid/v4")());
		
		//Sign transaction
		var ec = new rsaSign.KJUR.crypto.ECDSA({'curve': 'secp256r1'});
		transaction.hash = ec.signHex(rsaSign.KJUR.crypto.Util.sha256(transaction.toString()), argv.secret)
		
		console.log("Adding transaction to the pool.");
		socket.emit("add transaction", transaction);
	});
	
	socket.on("transaction add result", function(result){
		if(result.success){
			console.log("Transaction confirmed... Wait it to be added in a block.");
		}
		else{
			console.error(result.err);
		}
		process.exit(1);
	});
	
	socket.on("disconnect", function(){
		process.exit(0);
	});
}