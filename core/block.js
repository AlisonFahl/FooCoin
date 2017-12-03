var SHA256 = require("crypto-js/sha256");

const miningDifficulty = 6;

class Block{
	constructor(transaction, minerAddress, previousHash = "", hash = "", nounce = 0){		
		this.transaction = transaction;
		this.previousHash = previousHash;
		this.nounce = nounce;
		this.hash = hash;
		this.minerAddress = minerAddress;
	}
	
	calculateHash(){
		var transactionHash = this.transaction ? this.transaction.hash : "";
		return SHA256(`${this.previousHash}${transactionHash}${this.nounce}${this.minerAddress}`).toString();
	}
	
	mineBlock(){
		while(this.hash.substring(0, miningDifficulty) !== Array(miningDifficulty + 1).join("0")){
			this.nounce++;
			this.hash = this.calculateHash();
		}
	}
	
	isValid(){
		return this.calculateHash() === this.hash && this.hash.substring(0, miningDifficulty) === Array(miningDifficulty + 1).join("0");
	}
}

module.exports = Block;