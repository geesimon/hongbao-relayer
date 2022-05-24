# Hongbao-Relayer

Hongbao is a web3 ZKP application that anyone can setup a donation campaign while keeping the donors’ activities completely anonymous.  Relayer relay user's transfer request to hide withdraw activity from Hongbao contract to compaign contract.

## Local Setup

1. `cp .env.example .env` and change the parameters accordingly 
1. `npm  install`
1. `npm start`

Note: please also update Hongbao-UI to point to the URL of this relayer

## Function/Serverless Implementation

To avoid maintaining dedicate servers, the relayer can be implemented as a serverless function as illustrated in ` ali-fc` (Alibaba Cloud Function Compute). A production relayer is deployed to `https://relayer.redbao.me`
