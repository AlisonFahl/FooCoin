const fs = require('fs');
const rsaSign = require("jsrsasign");
const server = require('http').createServer();
const io = require('socket.io')(server);
const spawn = require('threads').spawn;

const Block = require("./../core/block.js");
const Blockchain = require("./../core/blockchain.js");
const Transaction = require("./../core/transaction.js");

var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var storageLocation = process.env.APPDATA + "\\FooCoin\\.blockchain\\blockchain.json";

var blockchain;
var transactionPool = [];

io.listen(3001);

io.on("connection", function(socket){
	//Event for receiving transaction requests
	socket.on("add transaction", function(data){
		try{
			if(data && data.from && data.to && data.amount && data.uuid && data.hash){
				var transaction = new Transaction(data.from, data.to, Math.floor(data.amount), data.uuid);
				transaction.hash = data.hash;
				
				//Do not allow negative/zero amount
				if(transaction.amount <= 0){
					socket.emit("transaction add result", {
						success: false,
						err: "Amount cannot be negative or zero."
					});
					return;
				}
				
				//Do not allow two transactions from same sender. This is just a trick to avoid double spending
				if(transactionPool.some(x => x.from === transaction.from)){
					socket.emit("transaction add result", {
						success: false,
						err: "There is already a transaction from this address in the pool. Wait it to be concluded before sending more coins."
					});
					return;
				}
				
				//Validate transaction signature
				if(!isTransactionValid(transaction)){
					socket.emit("transaction add result", {
						success: false,
						err: "The transaction signature is not valid."
					});
					return;
				}
				
				//Assert available balance
				if(blockchain.getBalance(transaction.from) < transaction.amount){
					socket.emit("transaction add result", {
						success: false,
						err: "Insufficient founds."
					});
					return;
				}
				
				//Do not allow replayed transactions
				if(blockchain.containsTransaction(transaction.hash)){
					socket.emit("transaction add result", {
						success: false,
						err: "This transaction already exists in the ledger."
					});
					return;
				}
				
				transactionPool.push(transaction);
				socket.emit("transaction add result", {
					success: true
				});
			}
			else{
				socket.emit("transaction add result", {
					success: false,
					err: "Invalid parameters."
				});
				return;
			}
		}
		catch(err){
			console.error(err);
		}
	});
	
	//Event for checking address balance
	socket.on("get balance", function(address){
		try{
			socket.emit("balance", blockchain.getBalance(address));
		}
		catch(err){
			console.error(err);
		}
	});
});

function loadBlockchain(cb){
	console.log("Loading blockchain from disk");
	
	var blocks;
	
	if(fs.existsSync(storageLocation)){
		blocks = JSON.parse(fs.readFileSync(storageLocation, 'utf8')).map(function(e){
			var transaction = e.transaction;
			if(e.transaction && e.transaction !== "Genesis"){
				transaction = new Transaction(e.transaction.from, e.transaction.to, e.transaction.amount, e.transaction.uuid);
				transaction.hash = e.transaction.hash;
			}
			return new Block(transaction, e.minerAddress, e.previousHash, e.hash, e.nounce);
		});
	}
	else{
		console.log("No blockchain found! Generating a new one with a single genesis block");
		
		blocks = [{
			transaction: "Genesis",
			previousHash: "",
			hash: "",
			minerAddress: config.address,
			nounce: 0
		}];
		
		if (!fs.existsSync(process.env.APPDATA + "\\FooCoin")){
			fs.mkdirSync(process.env.APPDATA + "\\FooCoin");
		}
		if (!fs.existsSync(process.env.APPDATA + "\\FooCoin\\.blockchain")){
			fs.mkdirSync(process.env.APPDATA + "\\FooCoin\\.blockchain");
		}
		fs.writeFileSync(storageLocation, JSON.stringify(blocks), 'utf8');
	}
	
	blockchain = new Blockchain(blocks);
	console.log("Finished loading blockchain! Total blocks: " + blockchain.chain.length);
	
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
		fs.writeFileSync(storageLocation, json, 'utf8');
		
		mine();
	});
}

function isTransactionValid(transaction){
	var ec = new rsaSign.KJUR.crypto.ECDSA({'curve': 'secp256r1'});
	
	return ec.verifyHex(rsaSign.KJUR.crypto.Util.sha256(transaction.toString()), transaction.hash, transaction.from);
}

loadBlockchain(mine);