const express = require('express')
const cors = require('cors');
const { ethers } = require("ethers");
require('dotenv').config()

const {CHAIN_URL, RELAYER_PRIVATE_KEY} = process.env;
const EtherProvider = new ethers.providers.JsonRpcProvider(CHAIN_URL);
const RelayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, EtherProvider);

let RelayerAddress; 
RelayerWallet.getAddress().then(_addr => {
  RelayerAddress = ethers.BigNumber.from(_addr).toString();
})

const fs = require('fs');
const ETHHongbaoAbi = JSON.parse(fs.readFileSync('ETHHongbao.json')).abi;

const {ETH_HONGBAO_ADDRESSES, ETH_HONGBAO_FEES} = process.env;
const HongbaoAddress2Fee = (_addresses, _fees) =>{
  let res = {};
  const fees = _fees.split(',').map(f => f.trim());

  _addresses.split(',').forEach((addr, k) => {
    res[addr] = ethers.utils.parseEther(fees[k])
  })
  
  return res;
}

const ETHHongbaoAddress2Fee = HongbaoAddress2Fee(ETH_HONGBAO_ADDRESSES, ETH_HONGBAO_FEES);

const app = express();
const {PORT} = process.env;

const error = (_code, _msg) => {
    var err = new Error(_msg);
    err.code = _code;

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

app.get('/config', async (req, res) => {
  res.send(ETHHongbaoAddress2Fee);
})

app.post('/api/relay', async (req, res, next) => {
    const t_start = new Date();

    const {proofData, publicSignals, hongbaoAddress} = req.body;
    // console.log(proofData, publicSignals, hongbaoAddress);
    
    if (ETHHongbaoAddress2Fee.hasOwnProperty(hongbaoAddress)){
      if (RelayerAddress === publicSignals[3]){
        if (ETHHongbaoAddress2Fee[hongbaoAddress].toString() === publicSignals[4]){
          console.log('Start submitting proof...')
          hongbaoContract = new ethers.Contract(hongbaoAddress, ETHHongbaoAbi, RelayerWallet);
          try {
            // proofData[0] = proofData[1];
            const tx = await hongbaoContract.withdraw(proofData, publicSignals);
            const receipt = await tx.wait();
            
            // console.log(receipt);
            res.send(error(0, "OK"));
          } catch(e){
            next(error(104, "Proof Verification Failed"))
          }
        } else {
          next(error(103, "Wrong Fee"));  
        }
      } else {
        next(error(102, "Wrong Relayer"));
      }
    } else {
      next(error(101, "Bad Hongbao Contract"));
    }

    const t_end = new Date();
    console.log('Seconds Elapsed:', (t_end - t_start) / 1000);
})

app.use(function(err, req, res, next){
    res.status(500);
    res.send({ code: err.code, error: err.message });
  });

app.use(function(req, res){
    res.status(404);
    res.send({ code: 404, error: "Sorry, can't find that" })
});

app.listen(PORT, () => {
  console.log(`Relayer listening on port ${PORT}`)
})