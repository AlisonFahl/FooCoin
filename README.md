# FooCoin
An experimental cryptocurrency that is worth absolutely nothing

## Setting up and running the wallet client
Go to the *wallet* folder and run `npm install`. Once it is done, you can execute `node app.js` with the following arguments:

+ **-g**

   Generates a new ECDSA private/public key pair.

+ **-b** *address*

   Check balance of the given public key *address*.

+ **-p** **--from**="sender address" **--to**="receiver address" **--amount**=coins **--secret**="sender secret"

   Makes a payment transaction, with the arguments being:

  * **from**: the sender public key
  * **to**: the receiver public key
  * **amount**: a unsigned integer representing the amount to be tranfered
  * **secret**: the sender private key used to sign the transaction

Obs: if the server is not running in the local machine, modify the *server* value in *wallet/config.json* file to match its address. 

## Setting up and running the miner (Server)
Go to the *miner* folder and open *config.json* file in a text editor. Insert your generated public key as the *address* value (for generating ECDSA keys pair, check the wallet setup).
Once the configuration file is set, run `npm install` and wait for the dependencies instalation. Run `node app.js` afterwards.
The miner will immediately load (or create a new one if none was found) the blockchain and start mining the blocks, as well as listening for transactions and balance checking.

## How does it work?
Basically, every time a new block is found, it is attached to the blockchain along with its miner address (miner's public key). Each block can or cannot contain a transaction bound to it. Every block mined with a transaction bound, rewards its miner with 10 coins. Blocks mined with no transaction bound, give 5 coins instead.
Every time a transaction is sent from a wallet client to the miner's server, it is validated and added to the transaction pool. All transactions in the pool wait to be added in a block and consequently attached to the blockchain.

## What next?
As can be seen, this implementation is far from being a truly decentralized currency. The goal is to implement a completly decentrilized peer to peer network, an approach in which this poor (dumb) developer was not abble to reach. Maybe you can help...
