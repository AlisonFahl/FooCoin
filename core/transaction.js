class Transaction{
	constructor(from, to, amount){
		this.from = from;
		this.to = to;
		this.amount = amount;
		this.hash =  "";
	}
	
	toString(){
		return this.from + this.to + this.amount;
	}
}

module.exports = Transaction;