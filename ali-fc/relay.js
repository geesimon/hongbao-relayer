/*
    This HTTP request handler take withdraw request from browser, verify and store to OSS
*/
const OSS = require('ali-oss')
const fs = require('fs');
const { ethers } = require("ethers");
const snarkjs = require('snarkjs');
const {
        CHAIN_URL, 
        RELAYER_PRIVATE_KEY, 
        OSS_REGION,
        OSS_BUCKET,
        OSS_ACCESSKEY_SECRET, 
        OSS_ACCESSKEY_ID
        } = process.env;

const {ETH_HONGBAO_ADDRESSES, ETH_HONGBAO_FEES} = process.env;
const HongbaoAddress2Fee = (_addresses, _fees) =>{
  let res = {};
  const fees = _fees.split(',').map(f => f.trim());

  _addresses.split(',').forEach((addr, k) => {
    res[addr] = ethers.utils.parseEther(fees[k])
  })
  
  return res;
}

let ETHHongbaoAddress2Fee;
let RelayerAddress; 
let VerificationKey;
let OSSClient;

exports.initializer = (context, callback) => {
    console.log('initializing');
    const EtherProvider = new ethers.providers.JsonRpcProvider(CHAIN_URL);
    const RelayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, EtherProvider);

    ETHHongbaoAddress2Fee = HongbaoAddress2Fee(ETH_HONGBAO_ADDRESSES, ETH_HONGBAO_FEES);
    
    RelayerWallet.getAddress().then(_addr => {
        RelayerAddress = ethers.BigNumber.from(_addr).toString();
    })

    VerificationKey = JSON.parse(fs.readFileSync("withdraw_verification_key.json"));
    
    OSSClient = new OSS({
                            region: OSS_REGION,
                            bucket: OSS_BUCKET,
                            accessKeyId: OSS_ACCESSKEY_ID,
                            accessKeySecret: OSS_ACCESSKEY_SECRET
                        })

    callback(null, '');
};

class VerificationError extends Error {
  constructor(_code, _message) {
    super(_message);
    this.code = _code; 
  }
}

const unpackProofData = (_proofData) => {
    return {
        pi_a:[_proofData[0], _proofData[1], "1"],
        pi_b:[[_proofData[3], _proofData[2]], [_proofData[5], _proofData[4]], ["1", "0"]],
        pi_c:[_proofData[6], _proofData[7], "1"],        
        protocol: "groth16", 
        curve: "bn128"
    }
}

const isFileExist = async (_fileName, _options = {}) => {
    try {
      await OSSClient.head(_fileName, _options);
      
      return true;
   }  catch (err) {
       if (err.code === 'NoSuchKey'){
           return false;
       } else {
           throw new VerificationError(110, err.message);
       } 
   }
}

exports.handler = async (req, resp, context) => {
    const {proofData, publicSignals, hongbaoAddress} = JSON.parse(req.body.toString());
    // console.log(proofData, publicSignals, hongbaoAddress, RelayerAddress);
    let res = {code: 0, message: "OK"};

    try{
        if (!ETHHongbaoAddress2Fee.hasOwnProperty(hongbaoAddress))
            throw new VerificationError(101, 'Bad Hongbao Contract');
        // console.log(RelayerAddress, publicSignals[3]);
        if (!(RelayerAddress === publicSignals[3]))
            throw new VerificationError(102, 'Wrong Relayer');
        if (!(ETHHongbaoAddress2Fee[hongbaoAddress].toString() === publicSignals[4]))
            throw new VerificationError(103, 'Wrong Fee');

        const proof = unpackProofData(proofData);
        if (!(await snarkjs.groth16.verify(VerificationKey, publicSignals, proof)))
            throw new VerificationError(104, 'Proofdata is Invalid');

        const submitObject = {
                HongbaoAddress: hongbaoAddress,
                ProofData: proofData,
                PublicSignals: publicSignals
        }
        const fileName = 'pickup/' + publicSignals[1] + ".json";
        if (await isFileExist(fileName))
            throw new VerificationError(106, 'The proof has already been sent');
            
        try {            
            await OSSClient.put(fileName, Buffer.from(JSON.stringify(submitObject)));
        } catch (err){
            console.log(err);
            throw new VerificationError(107, 'Failed to Write OSS');
        }
        
        resp.setStatusCode(200);
    } catch(err){
        res.code = err.code;
        res.message = err.message;
        resp.setStatusCode(500);
    }

    resp.setHeader("Content-Type", "application/json");
    resp.send(JSON.stringify(res));
}