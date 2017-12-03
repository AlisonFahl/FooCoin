var fs = require('fs');
var rsaSign = require("jsrsasign");
var server = require('http').createServer();
var io = require('socket.io')(server);

var Block = require("./../core/block.js");
var Blockchain = require("./../core/blockchain.js");
var Transaction = require("./../core/transaction.js");

var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

var blockchain;
var transactionPool = [];

io.listen(3000);

io.on("connection", function(socket){
	socket.on("add transaction", function(data){
		var transaction = new Transaction(data.from, data.to, data.amount, data.uuid);
		transaction.hash = data.hash;
		
		if(isTransactionValid(transaction) && blockchain.getBalance(transaction.from) >= transaction.amount && blockchain.containsTransaction(transaction.hash)){
			transactionPool.push(transaction);
			console.log("Added transaction " + transaction.hash + " to the pool.");
		}
		else{
			console.log("Rejected transaction " + transaction.hash);
		}
	});
	socket.on("get balance", function(address){
		socket.emit("balance", blockchain.getBalance(address));
	});
});

function loadBlockchain(cb){
	console.log("Loading blockchain from disk");
	
	var blockchainJson = JSON.parse(fs.readFileSync(config.storage, 'utf8'));
	
	var blocks = blockchainJson.map(function(e){
		var transaction;
		if(e.transaction){
			var transaction = new Transaction(e.transaction.from, e.transaction.to, e.transaction.amount, e.transaction.uuid);
			transaction.hash = e.transaction.hash;
		}
		return new Block(transaction, e.minerAddress, e.previousHash, e.hash, e.powNumber);
	});
	
	blockchain = new Blockchain(blocks);
	
	console.log("Finished loading blockchain");
	
	cb();
}

function mine(){
	while(true){
		let transaction = "";
		
		if(transactionPool.length > 0){
			transaction = transactionPool.shift();
		}
		
		var lastBlock = blockchain.chain[blockchain.chain.length - 1];
		var newBlock = new Block(transaction, config.address, lastBlock.hash);
		console.log("Mining block " + blockchain.chain.length + "...");
		newBlock.mineBlock();
		console.log("Block mined");
		blockchain.chain.push(newBlock);
		
		var json = JSON.stringify(blockchain.chain);
		fs.writeFileSync(config.storage, json, 'utf8');
	}
}

function isTransactionValid(transaction){
	var ec = new rsaSign.KJUR.crypto.ECDSA({'curve': 'secp256r1'});
	
	return ec.verifyHex(rsaSign.KJUR.crypto.Util.sha256(transaction.toString()), transaction.hash, transaction.from);
}

loadBlockchain(function(){
	mine();
});