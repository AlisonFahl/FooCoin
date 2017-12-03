class Transaction{
	constructor(from, to, amount, uuid){
		this.from = from;
		this.to = to;
		this.amount = amount;
		this.uuid = uuid;
		this.hash =  "";
	}
	
	toString(){
		return this.from + this.to + this.amount + this.uuid;
	}
}

module.exports = Transaction;