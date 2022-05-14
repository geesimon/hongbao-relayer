const express = require('express')
const cors = require('cors');
const app = express()
const port = 3000

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

app.post('/api/relay', (req, res, next) => {
    const {proofData, publicSignals, hongbaoAddress} = req.body;
    // console.log(req.body);
    console.log(proofData, publicSignals, hongbaoAddress);

    next(error(200, "ok"));
})

app.use(function(err, req, res, next){
    res.status(err.status || 500);
    res.send({ error: err.message });
  });

app.use(function(req, res){
    res.status(404);
    res.send({ error: "Sorry, can't find that" })
});

app.listen(port, () => {
  console.log(`Relayer listening on port ${port}`)
})