class Blockchain{
	constructor(chain){
		this.chain = chain;
	}
	
	validate(){
		for(let i=1; i<this.chain.length; i++){
			if(this.chain[i].previousHash !== this.chain[i - 1].hash || !this.chain[i].isValid()){
				this.chain = this.chain.splice(0, i);
			}
		}
	}
}

module.exports = Blockchain;