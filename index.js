
const fs = require('fs');

const { ethers } = require("ethers");
const {CHAIN_URL, RELAYER_PRIVATE_KEY} = process.env;

const {ETH_HONGBAO_ADDRESSES, ETH_HONGBAO_FEES} = process.env;
const HongbaoAddress2Fee = (_addresses, _fees) =>{
  let res = {};
  const fees = _fees.split(',').map(f => f.trim());

  _addresses.split(',').forEach((addr, k) => {
    res[addr] = ethers.utils.parseEther(fees[k])
  })
  
  return res;
}

let RelayerWallet;
let ETHHongbaoAddress2Fee;
let ETHHongbaoAbi;
let RelayerAddress; 

exports.initializer = (context, callback) => {
    console.log('initializing');
    const EtherProvider = new ethers.providers.JsonRpcProvider(CHAIN_URL);
    RelayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, EtherProvider);

    ETHHongbaoAddress2Fee = HongbaoAddress2Fee(ETH_HONGBAO_ADDRESSES, ETH_HONGBAO_FEES);
    ETHHongbaoAbi = JSON.parse(fs.readFileSync('ETHHongbao.json')).abi;
    
    RelayerWallet.getAddress().then(_addr => {
        RelayerAddress = ethers.BigNumber.from(_addr).toString();
    })

    callback(null, '');
};

const error = (_code, _msg) => {
    var err = new Error(_msg);
    err.code = _code;

    return err;
}

exports.handler = async (req, resp, context) => {
    let err = error(0, "OK");

    const {proofData, publicSignals, hongbaoAddress} = JSON.parse(req.body.toString());
    // console.log(proofData, publicSignals, hongbaoAddress, RelayerAddress);
    
    if (ETHHongbaoAddress2Fee.hasOwnProperty(hongbaoAddress)){
      if (RelayerAddress === publicSignals[3]){
        if (ETHHongbaoAddress2Fee[hongbaoAddress].toString() === publicSignals[4]){
          hongbaoContract = new ethers.Contract(hongbaoAddress, ETHHongbaoAbi, RelayerWallet);
          try {
            // proofData[0] = proofData[1];
            const tx = await hongbaoContract.withdraw(proofData, publicSignals);
            const receipt = await tx.wait();                        
            err = error(0, "OK");
          } catch(e){
                console.log(e);
                err = error(104, "Proof Verification Failed");
          }
        } else {
            err = error(103, "Wrong Fee");
        }
      } else {
            err = error(102, "Wrong Relayer");
      }
    } else {
        err = error(101, "Bad Hongbao Contract");
    }

    resp.setHeader("Content-Type", "application/json");
    if (err.code !== 0){
        resp.setStatusCode(500);
    } else {
        resp.setStatusCode(200);
    }
    resp.send(JSON.stringify({code: err.code, error: err.message }));
}