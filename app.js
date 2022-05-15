const express = require('express')
const cors = require('cors');
const { ethers } = require("ethers");
require('dotenv').config()

const {CHAIN_URL, RELAYER_PRIVATE_KEY} = process.env;
const EtherProvider = new ethers.providers.JsonRpcProvider(CHAIN_URL);
const RelayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, EtherProvider);

let RelayerAddress; 
RelayerWallet.getAddress().then(_addr => {
  RelayerAddress = _addr;
})

const fs = require('fs');
const ETHHongbaoAbi = JSON.parse(fs.readFileSync('ETHHongbao.json')).abi;

const {ETHHongbaoAddresses, ETHHongbaoFees} = process.env;
const HongbaoAddress2Fee = (_addresses, _fees) =>{
  let res = {};
  const fees = _fees.split(',').map(f => f.trim());

  _addresses.split(',').forEach((addr, k) => {
    res[addr] = Number(fees[k]);
  })
  
  return res;
}

const ETHHongbaoAddress2Fee = HongbaoAddress2Fee(ETHHongbaoAddresses, ETHHongbaoFees);

const app = express();
const {PORT} = process.env;

const error = (_status, _msg) => {
    var err = new Error(_msg);
    err.status = _status;

    return err;
}

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Welcome to Hongbao!!!')
})

app.get('/address', async (req, res) => {
  res.send(RelayerAddress);
})

app.post('/api/relay', async (req, res, next) => {
    const {proofData, publicSignals, hongbaoAddress} = req.body;

    console.log(proofData, publicSignals, hongbaoAddress);
    if (ETHHongbaoAddress2Fee.hasOwnProperty(hongbaoAddress)){
      if (RelayerAddress === publicSignals[3]){
        if (ETHHongbaoAddress2Fee[hongbaoAddress] === Number(publicSignals[publicSignals])){
          hongbaoContract = new ethers.Contract(hongbaoAddress, ETHHongbaoAbi, RelayerWallet);
          const tx = await hongbaoContract.withdraw(proofData, publicSignals);
          const receipt = await tx.wait();
          console.log(receipt);
          next(error(200, "OK"));  
        } else {
          next(error(500, "Wrong Fee"));  
        }
      } else {
        next(error(500, "Wrong Relayer"));
      }
    } else {
      next(error(500, "Bad Hongbao Contract"));
    }
})

app.use(function(err, req, res, next){
    res.status(err.status || 500);
    res.send({ error: err.message });
  });

app.use(function(req, res){
    res.status(404);
    res.send({ error: "Sorry, can't find that" })
});

app.listen(PORT, () => {
  console.log(`Relayer listening on port ${PORT}`)
})