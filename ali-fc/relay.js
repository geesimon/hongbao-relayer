/*
    This HTTP request handler take withdraw request from browser, verify and store to OSS
*/
const OSS = require('ali-oss')
const fs = require('fs');
const { ethers } = require("ethers");
const snarkjs = require('snarkjs');
const {
        RELAYER_ADDRESS, 
        OSS_REGION,
        OSS_BUCKET,
        OSS_ACCESSKEY_SECRET, 
        OSS_ACCESSKEY_ID,
        ETH_HONGBAO_FEES
        } = process.env;

const HongbaoAddress2Fee = (_addresses, _fees) =>{
  let res = {};
  const fees = _fees.split(',').map(f => f.trim());

  _addresses.split(',').forEach((addr, k) => {
    res[addr] = ethers.utils.parseEther(fees[k])
  })
  
  return res;
}

let ETHHongbaoAddress2Fee = {};
let VerificationKey;
let OSSClient;

exports.initializer = (context, callback) => {
    console.log('initializing');

    if( process.env.ETH_HONGBAO_ADDRESSES_MAIN !== undefined){
        ETHHongbaoAddress2Fee['main'] = HongbaoAddress2Fee(process.env.ETH_HONGBAO_ADDRESSES_MAIN, ETH_HONGBAO_FEES)
    }
    if (process.env.ETH_HONGBAO_ADDRESSES_TEST !== undefined){
        ETHHongbaoAddress2Fee['test'] = HongbaoAddress2Fee(process.env.ETH_HONGBAO_ADDRESSES_TEST, ETH_HONGBAO_FEES)
    }

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
    const {env, proofData, publicSignals, hongbaoAddress} = JSON.parse(req.body.toString());
    // console.log(proofData, publicSignals, hongbaoAddress, RelayerAddress);
    let res = {code: 0, message: "OK"};

    try{
        if (env === undefined || !ETHHongbaoAddress2Fee.hasOwnProperty(env))
            throw new VerificationError(100, `Specified Wrong Environment {${env}}`);
        if (!ETHHongbaoAddress2Fee[env].hasOwnProperty(hongbaoAddress))
            throw new VerificationError(101, 'Bad Hongbao Contract');
        // console.log(RelayerAddress, publicSignals[3]);
        if (!(ethers.BigNumber.from(RELAYER_ADDRESS).toString() === publicSignals[3]))
            throw new VerificationError(102, 'Wrong Relayer');
        if (!(ETHHongbaoAddress2Fee[env][hongbaoAddress].toString() === publicSignals[4]))
            throw new VerificationError(103, 'Wrong Fee');

        const proof = unpackProofData(proofData);
        if (!(await snarkjs.groth16.verify(VerificationKey, publicSignals, proof)))
            throw new VerificationError(104, 'Proofdata is Invalid');

        const submitObject = {
                env: env,
                hongbaoAddress: hongbaoAddress,
                proofData: proofData,
                publicSignals: publicSignals
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
    } catch(err){
        res.code = err.code;
        res.message = err.message;
    }

    resp.setStatusCode(200);
    resp.setHeader("Content-Type", "application/json");
    resp.send(JSON.stringify(res));
}