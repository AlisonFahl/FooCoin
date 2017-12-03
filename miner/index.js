const fs = require('fs');
const rsaSign = require("jsrsasign");
const server = require('http').createServer();
const io = require('socket.io')(server);
const spawn = require('threads').spawn;

const Block = require("./../core/block.js");
const Blockchain = require("./../core/blockchain.js");
const Transaction = require("./../core/transaction.js");

var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

var blockchain;
var transactionPool = [];

io.listen(3000);

io.on("connection", function(socket){
	socket.on("add transaction", function(data){
		console.log("Received new transaction: " + data.hash);
		
		var transaction = new Transaction(data.from, data.to, data.amount, data.uuid);
		transaction.hash = data.hash;
		
		if(!transactionPool.some(x => x.hash === transaction.hash) && isTransactionValid(transaction) && blockchain.getBalance(transaction.from) >= transaction.amount && !blockchain.containsTransaction(transaction.hash)){
			transactionPool.push(transaction);
			console.log("Added transaction " + transaction.hash + " to the pool.");
			socket.emit("transaction add result", true);
		}
		else{
			console.log("Rejected transaction " + transaction.hash);
			socket.emit("transaction add result", false);
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
			transaction = new Transaction(e.transaction.from, e.transaction.to, e.transaction.amount, e.transaction.uuid);
			transaction.hash = e.transaction.hash;
		}
		return new Block(transaction, e.minerAddress, e.previousHash, e.hash, e.nounce);
	});
	
	blockchain = new Blockchain(blocks);
	console.log("Finished loading blockchain");
	
	cb();
}

function mine(){
	let transaction = "";
		
	if(transactionPool.length > 0){
		transaction = transactionPool.shift();
	}
	
	var lastBlock = blockchain.chain[blockchain.chain.length - 1];
	var newBlock = new Block(transaction, config.address, lastBlock.hash);
	console.log("Mining block " + blockchain.chain.length + "...");
	
	var miningThread = spawn(function(input, done){
		const Block = require(input.__dirname + "\\..\\core\\block.js");
		const Transaction = require(input.__dirname + "\\..\\core\\transaction.js");

		let miningBlock = new Block(input.miningBlock.transaction ? new Transaction(input.miningBlock.transaction.from, input.miningBlock.transaction.to, input.miningBlock.transaction.amount, input.miningBlock.transaction.uuid) : ""
		, input.miningBlock.minerAddress, input.miningBlock.previousHash, input.miningBlock.hash, input.miningBlock.nounce);
		if(miningBlock.transaction){
			miningBlock.transaction.hash = input.miningBlock.transaction.hash;
		}
		miningBlock.mineBlock();
		done(miningBlock);
	});
	miningThread.send({miningBlock: newBlock, __dirname: __dirname });
	miningThread.on("done", function(output){
		newBlock.nounce = output.nounce;
		newBlock.hash = output.hash;
		
		console.log("Block mined");
		
		blockchain.chain.push(newBlock);
		
		var json = JSON.stringify(blockchain.chain);
		fs.writeFileSync(config.storage, json, 'utf8');
		
		mine();
	});
}

function isTransactionValid(transaction){
	var ec = new rsaSign.KJUR.crypto.ECDSA({'curve': 'secp256r1'});
	
	return ec.verifyHex(rsaSign.KJUR.crypto.Util.sha256(transaction.toString()), transaction.hash, transaction.from);
}

loadBlockchain(mine);