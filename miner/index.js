var fs = require('fs');
var rsaSign = require("jsrsasign");

var Block = require("./../core/block.js");
var Blockchain = require("./..//core/blockchain.js");
var Transaction = require("./..//core/transaction.js");

var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

var blockchain;
var transactionPool = [];

function loadBlockchain(cb){
	var blockchainJson = JSON.parse(fs.readFileSync(config.storage, 'utf8'));
	
	var blocks = blockchainJson.map(function(e){
		return new Block(e.data, e.minerAddress, e.previousHash, e.hash, e.powNumber);
	});
	
	blockchain = new Blockchain(blocks);
	
	blockchain.validate();
	
	cb();
}

function mine(){
	while(true){
		let transaction = "";
		
		while(transactionPool.length > 0){
			transaction = transactionPool.shift();
			if(isTransactionValid(transaction)){
				break;
			}
			else{
				transaction = "";
			}
		}
		
		var lastBlock = blockchain.chain[blockchain.chain.length - 1];
		var newBlock = new Block(transaction, config.address, lastBlock.hash);
		console.log("Mining a block");
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