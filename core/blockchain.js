class Blockchain{
	constructor(chain){
		this.chain = chain;
		this.validate();
	}
	
	validate(){
		for(let i=1; i<this.chain.length; i++){
			if(this.chain[i].previousHash !== this.chain[i - 1].hash || !this.chain[i].isValid()){
				this.chain = this.chain.splice(0, i);
			}
		}
	}
	
	getBalance(address){
		var balance = 0;
		
		for(let i=0; i<this.chain.length; i++){
			//check if this address mined this block
			if(this.chain[i].minerAddress === address){
				//5 coins rewarded for an empty block or 10 coins for a block if transaction
				if(this.chain[i].transaction && i != 0){
					balance += 10;
				}
				else{
					balance += 5;
				}
			}
			if(i > 0 && this.chain[i].transaction){//skip genesis and check if there is a tx bound to this block
				//check if this address received the coins
				if(this.chain[i].transaction.to === address){
					balance += this.chain[i].transaction.amount;
				}
				//check if this address sent the coins
				if(this.chain[i].transaction.from === address){
					balance -= this.chain[i].transaction.amount;
				}
			}
		}
		
		return balance;
	}
	
	containsTransaction(hash){
		return this.chain.slice(1).some(x => x.transaction && x.transaction.hash === hash);
	}
}

module.exports = Blockchain;