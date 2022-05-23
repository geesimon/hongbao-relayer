/*
    This handler take scan OSS and submit withdraw request to Hongbao contract
*/
const OSS = require('ali-oss')
const fs = require('fs');
const { ethers } = require("ethers");
const {
        RELAYER_PRIVATE_KEY, 
        OSS_REGION,
        OSS_BUCKET,
        OSS_ACCESSKEY_SECRET, 
        OSS_ACCESSKEY_ID
        } = process.env;

let ETHHongbaoAbi;
let OSSClient;
let ChainURL = {};

exports.initializer = (context, callback) => {
    console.log('initializing');

    ETHHongbaoAbi = JSON.parse(fs.readFileSync('ETHHongbao.json')).abi;

    if (process.env.CHAIN_URL_MAIN !== undefined){
        ChainURL['main'] = process.env.CHAIN_URL_MAIN;
    }
    if (process.env.CHAIN_URL_TEST !== undefined){
        ChainURL['test'] = process.env.CHAIN_URL_TEST;
    }

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

        try {
            const EtherProvider = new ethers.providers.JsonRpcProvider(ChainURL[submitObject.env]);
            const RelayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, EtherProvider);
            const hongbaoContract = new ethers.Contract(submitObject.hongbaoAddress, ETHHongbaoAbi, RelayerWallet);

            const tx = await hongbaoContract.withdraw(submitObject.proofData, submitObject.publicSignals);
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