/*
    This handler take scan OSS and submit withdraw request to Hongbao contract
*/
const OSS = require('ali-oss')
const fs = require('fs');
const { ethers } = require("ethers");
const {
        CHAIN_URL,
        RELAYER_PRIVATE_KEY, 
        OSS_REGION,
        OSS_BUCKET,
        OSS_ACCESSKEY_SECRET, 
        OSS_ACCESSKEY_ID
        } = process.env;

const {ETH_HONGBAO_ADDRESSES, ETH_HONGBAO_FEES} = process.env;

let RelayerWallet;
let ETHHongbaoAbi;
let RelayerAddress; 
let VerificationKey;
let OSSClient;

exports.initializer = (context, callback) => {
    console.log('initializing');
    const EtherProvider = new ethers.providers.JsonRpcProvider(CHAIN_URL);
    RelayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, EtherProvider);

    ETHHongbaoAbi = JSON.parse(fs.readFileSync('ETHHongbao.json')).abi;
    
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

exports.handler = async (event, context, callback) => {
    let res = {code: null, data:null};

    let fileList = await OSSClient.list({
                                        prefix: 'pickup/',
                                        });
    
    for (const file of fileList.objects) {
        if (file.name.slice(file.name.length - 4) !== 'json') continue;

        console.log("Processing:", file.name);
        const fileContent = await OSSClient.get(file.name);
        const submitObject = JSON.parse(fileContent.content.toString());

        hongbaoContract = new ethers.Contract(submitObject.HongbaoAddress, ETHHongbaoAbi, RelayerWallet);
        try {
            const tx = await hongbaoContract.withdraw(submitObject.ProofData, submitObject.PublicSignals);
            const receipt = await tx.wait();
        } catch(err){
            console.log(err);
            res.code = 'Proof Verification Failed';
            res.data = submitObject;
            await OSSClient.copy(file.name.replace('pickup', 'bad'), file.name,);
        }

        await OSSClient.copy(file.name.replace('pickup', 'good'), file.name, );
        await OSSClient.delete(file.name);
    };

    callback(res.code, res.data);
}