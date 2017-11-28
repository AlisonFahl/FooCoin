var SHA256 = require("crypto-js/sha256");

const miningDifficulty = 5;

class Block{
	constructor(data, minerAddress, previousHash = "", hash = "", powNumber = 0){		
		this.data = data;
		this.previousHash = previousHash;
		this.powNumber = powNumber;
		this.hash = hash;
		this.minerAddress = minerAddress;
	}
	
	calculateHash(){
		return SHA256(`${this.previousHash}${this.data}${this.powNumber}${this.minerAddress}`).toString();
	}
	
	mineBlock(){
		while(this.hash.substring(0, miningDifficulty) !== Array(miningDifficulty + 1).join("0")){
			this.powNumber++;
			this.hash = this.calculateHash();
		}
	}
	
	isValid(){
		return this.calculateHash() === this.hash && this.hash.substring(0, miningDifficulty) === Array(miningDifficulty + 1).join("0");
	}
}

module.exports = Block;