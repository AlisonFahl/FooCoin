const fs = require('fs');
const rsaSign = require("jsrsasign");
const server = require('http').createServer();
const io = require('socket.io')(server);
const spawn = require('threads').spawn;

const core = require("./../core/index.js");

const Block = core.Block;
const Blockchain = core.Blockchain;
const Transaction = core.Transaction;

var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var storageLocation = process.env.APPDATA + "\\FooCoin\\.blockchain\\blockchain.json";

var blockchain;
var transactionPool = [];
var miningThread;

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
				
				//add to transaction pool
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

//load blockchain file from disk or create a new one
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

function prepareMiningThread(cb){
	//Mining Thread
	miningThread = spawn(function(input, done){
		const Block = require(input.__dirname + "\\..\\core\\block.js");
		const Transaction = require(input.__dirname + "\\..\\core\\transaction.js");
		
		//re-instantiate in the thread context, appending transaction if any
		let miningBlock = new Block(input.miningBlock.transaction ? new Transaction(input.miningBlock.transaction.from, input.miningBlock.transaction.to, input.miningBlock.transaction.amount, input.miningBlock.transaction.uuid) : ""
		, input.miningBlock.minerAddress, input.miningBlock.previousHash, input.miningBlock.hash, input.miningBlock.nounce);
		if(miningBlock.transaction){
			miningBlock.transaction.hash = input.miningBlock.transaction.hash;
		}
		//start mining
		miningBlock.mineBlock();
		//callback once done
		done(miningBlock);
	});

	//event called once mining is done
	miningThread.on("done", function(output){
		console.log("Block mined");
		
		//apply the nounce value found along with the hash
		let newBlock = new Block(output.transaction ? new Transaction(output.transaction.from, output.transaction.to, output.transaction.amount, output.transaction.uuid) : ""
		, output.minerAddress, output.previousHash, output.hash, output.nounce);
		if(newBlock.transaction){
			newBlock.transaction.hash = output.transaction.hash;
		}
		
		//append to the blockchain and start mining next block
		attachBlock(newBlock, mine);
	});
	
	cb();
}

//mining routine
function mine(){
	let transaction = "";
	
	//get any pending transaction
	if(transactionPool.length > 0){
		transaction = transactionPool.shift();
	}
	
	//take last block
	var lastBlock = blockchain.chain[blockchain.chain.length - 1];
	//prepare new block
	var newBlock = new Block(transaction, config.address, lastBlock.hash);
	
	//start the mining process in a separated thread
	console.log("Mining block " + blockchain.chain.length + "...");
	//send parameters to the thread context.
	miningThread.send({miningBlock: newBlock, __dirname: __dirname });
}

function attachBlock(newBlock, cb){
	//attach
	blockchain.chain.push(newBlock);
	
	//persist updated blockchain on file
	var json = JSON.stringify(blockchain.chain);
	fs.writeFileSync(storageLocation, json, 'utf8');
	
	cb();
}

//signature verification method
function isTransactionValid(transaction){
	var ec = new rsaSign.KJUR.crypto.ECDSA({'curve': 'secp256r1'});
	
	return ec.verifyHex(rsaSign.KJUR.crypto.Util.sha256(transaction.toString()), transaction.hash, transaction.from);
}

loadBlockchain(function(){
	prepareMiningThread(mine);
});