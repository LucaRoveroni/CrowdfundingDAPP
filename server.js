const express = require('express');
const bodyParser = require("body-parser");
const Web3 = require('web3');
const path = require('path');
const url = require('url');
const CampaignAbi = require('./build/contracts/Campaign.json');

const app = express();
const web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'));

var toInit = true;
var numDonors = 0;
var numReporters = 0;
var ContractAddr = '';
var shirtHasClaimed = false;
var bpHasClaimed = false;
var numWithdrawRewards = 0;

var orgA;
var orgB;
var benA;
var benB;
var benC;
var donA;
var donB;
var repA;
var repB;
var repC;

const accounts = web3.eth.getAccounts().then(accounts => {
    orgA = accounts[0];
    orgB = accounts[1];
    benA = accounts[2];
    benB = accounts[3];
    benC = accounts[4];
    donA = accounts[5];
    donB = accounts[6];
    repA = accounts[7];
    repB = accounts[8];
    repC = accounts[9];
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: 'True' }));
app.use(bodyParser.raw({ type: 'application/json' }));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'views')));

app.get('/', async (req, res) => {
    res.render('index');
});

app.get('/campaign', async (req, res) => {
    const ContractAddress = '0x' + req.query.campaignAddress;
    ContractAddr = req.query.campaignAddress;

    const beneficiaries = [{
        benName: "Company 123",
        benAddress: benA,
        donationAmount: 0,
        hasWithDrawn: false
    }, {
        benName: "Company 456",
        benAddress: benB,
        donationAmount: 0,
        hasWithDrawn: false
    }, {
        benName: "Company 789",
        benAddress: benC,
        donationAmount: 0,
        hasWithDrawn: false
    }];

    const organizers = [{
        orgName: "Organizer 123",
        orgAddress: orgA,
        hasInitializate: false,
        initDonation: 0
    }, {
        orgName: "Organizer 456",
        orgAddress: orgB,
        hasInitializate: false,
        initDonation: 0
    }];

    const donators = [{
        donAddress: donA,
        numDonations: 0,
        amount: 0
    }];

    const rewards = [{
        reward: "T-Shirt",
        threshold: 15000000
    }, {
        reward: "Backpack",
        threshold: 66000000
    }];

    var values = {
        CampaignAddress: ContractAddress,
        listOrganizers: [],
        listBeneficiaries: [],
        listDonors: [],
        listRewards: [],
        listDonorRewards: [],
        listReporters: [],
    };

    const futureDate = new Date('July 20, 2020 00:20:18 GMT+02:00');
    const deadline = futureDate.getTime() / 1000;

    var contract = new web3.eth.Contract(CampaignAbi.abi, ContractAddress);

    // Setup the campaing
    if(toInit) {
        await contract.methods.setCampaignParams(organizers, beneficiaries, deadline, rewards).send({ from: orgA, gas: 90000000, gasPrice: 0});
        toInit = false;
    }

    values.CampaignBalance = await contract.methods.getCampaignBalance().call({ from: orgA });

    const dead = await contract.methods.getDeadline().call({ from: orgA });
    var d = new Date();
    d.setTime(dead * 1000);
    values.CampaignDeadline = d.toDateString();

    const state = await contract.methods.getCampaignState().call({ from: orgA });
    const states = ["CREATED", "INITIALIZATED", "READY", "REPORTED", "COMPLETED", "DEACTIVATED"];
    values.CampaignState = states[state];

    for (let index = 0; index < organizers.length; index++) {
        const r = await contract.methods.getOrganizer(index).call({ from: orgA });
        const org = {
            name: r[0],
            orgAddress: r[1],
            hasInit: r[2],
            initDonation: r[3]
        };
        values.listOrganizers.push(org);
    }

    for (let index = 0; index < beneficiaries.length; index++) {
        const r = await contract.methods.getBeneficiary(index).call({ from: orgA });
        const ben = {
            name: r[0],
            benAddress: r[1],
            amount: r[2],
            hasWithDrawn: r[3]
        };

        values.listBeneficiaries.push(ben);
    }

    for (let index = 0; index < rewards.length; index++) {
        const r = await contract.methods.getReward(index).call({ from: orgA });
        const rew = {
            reward: r[0],
            threshold: r[1],
        };

        values.listRewards.push(rew);
    }

    if (numDonors > 0) {
        var don = {};

        for (let index = 0; index < donators.length; index++) {
            const r = await contract.methods.getDonator(index).call({ from: orgA });
            don = {
                donAddress: r[0],
                numDons: r[1],
                amountDons: r[2],
                hasWithDrawn: r[3],
                listRewards: [],
            };
        }

        for (let i = 0; i < donators.length; i++) {
            const r = await contract.methods.getDonatorReward(donA).call({ from: orgA });

            for (let j = 0; j < r.length; j++) {
                var str = JSON.stringify(r[0]);
                var hasC = str.substring(str.length-5,str.length-1);
                if (hasC == 'alse') {
                    hasC = 'false'
                }
                var rew = {
                    gift: rewards[j].reward,
                    hasClaimed: hasC
                };

                don.listRewards.push(rew);
            }
        }
        values.listDonors.push(don);
    }

    if (numReporters > 0) {
        for (let index = 0; index < numReporters; index++) {
            const r = await contract.methods.getReporter(index).call({ from: orgA });
            rep = {
                repAddress: r[0],
                betAmount: r[1],
                hasWithDrawn: r[2],
            };
            values.listReporters.push(rep);
        }
    }

    res.render('campaign', { data: values });
});

app.get('/init', async (req, res) => {
    const orgAddress = req.query.orgAddress;

    var contract = new web3.eth.Contract(CampaignAbi.abi, ContractAddr);

    await contract.methods.initCampaign().send({ from: orgAddress, value: 1000000000, gas: 90000000, gasPrice: 0 });

    res.redirect(url.format({
        pathname:"/campaign",
        query: {
           "campaignAddress": ContractAddr,
         }
      }));
});

app.get('/donate', async (req, res) => {
    const donBeneficiaries = [{
        benAddress: benA,
        donAmount: 5000000
    }, {
        benAddress: benB,
        donAmount: 5000000
    }, {
        benAddress: benC,
        donAmount: 5000000
    }];

    var contract = new web3.eth.Contract(CampaignAbi.abi, ContractAddr);

    await contract.methods.donate(donBeneficiaries).send({ from: donA, value: 15000000, gas: 900000000, gasPrice: 0 });
    numDonors += 1;

    res.redirect(url.format({
        pathname:"/campaign",
        query: {
           "campaignAddress": ContractAddr,
         }
      }));
});

app.get('/report', async (req, res) => {
    var contract = new web3.eth.Contract(CampaignAbi.abi, ContractAddr);

    await contract.methods.report().send({ from: repA, value: 15000000, gas: 900000000, gasPrice: 0 });
    if (numReporters == 0) {
        numReporters++;
    }

    res.redirect(url.format({
        pathname:"/campaign",
        query: {
           "campaignAddress": ContractAddr,
         }
      }));
});

app.get('/report', async (req, res) => {
    var contract = new web3.eth.Contract(CampaignAbi.abi, ContractAddr);

    await contract.methods.report().send({ from: repA, value: 1000000000, gas: 90000000, gasPrice: 0 });

    res.redirect(url.format({
        pathname:"/campaign",
        query: {
           "campaignAddress": ContractAddr,
         }
      }));
});

app.get('/pastDeadline', async (req, res) => {
    const pastDate = new Date('July 20, 2019 00:20:18 GMT+02:00');
    const pastDeadline = pastDate.getTime() / 1000;
    var contract = new web3.eth.Contract(CampaignAbi.abi, ContractAddr);

    await contract.methods.setDeadline(pastDeadline).send({from: orgA });

    res.redirect(url.format({
        pathname:"/campaign",
        query: {
           "campaignAddress": ContractAddr,
         }
      }));
});

app.get('/setFraudulent', async (req, res) => {
    var contract = new web3.eth.Contract(CampaignAbi.abi, ContractAddr);

    await contract.methods.setFraudulent().send({ from: orgA, gas: 90000000, gasPrice: 0 });

    res.redirect(url.format({
        pathname:"/campaign",
        query: {
           "campaignAddress": ContractAddr,
         }
      }));
});

app.get('/withdrawDonations', async (req, res) => {
    const benAddress = req.query.benAddress;

    var contract = new web3.eth.Contract(CampaignAbi.abi, ContractAddr);
    await contract.methods.withdrawDonations().send({ from: benAddress, gas: 90000000, gasPrice: 0 });

    res.redirect(url.format({
        pathname:"/campaign",
        query: {
           "campaignAddress": ContractAddr,
         }
      }));
});

app.get('/withdrawDonDonations', async (req, res) => {
    const donAddress = req.query.donAddress;

    var contract = new web3.eth.Contract(CampaignAbi.abi, ContractAddr);
    await contract.methods.withdrawDonator().send({ from: donAddress, gas: 90000000, gasPrice: 0 });

    res.redirect(url.format({
        pathname:"/campaign",
        query: {
           "campaignAddress": ContractAddr,
         }
      }));
});

app.get('/withdrawRepDonations', async (req, res) => {
    const repAddress = req.query.repAddress;

    var contract = new web3.eth.Contract(CampaignAbi.abi, ContractAddr);
    await contract.methods.withdrawReporter().send({ from: repAddress, gas: 90000000, gasPrice: 0 });

    res.redirect(url.format({
        pathname:"/campaign",
        query: {
           "campaignAddress": ContractAddr,
         }
      }));
});

app.get('/withdrawReward', async (req, res) => {
    const donAddress = req.query.donAddress;

    var contract = new web3.eth.Contract(CampaignAbi.abi, ContractAddr);

    await contract.methods.withdrawRewards().send({ from: donAddress, gas: 90000000, gasPrice: 0 });
    numWithdrawRewards++;

    if (numWithdrawRewards == 1) {
        shirtHasClaimed = true;
    }

    if (numWithdrawRewards == 2) {
        bpHasClaimed = true;
    }

    res.redirect(url.format({
        pathname:"/campaign",
        query: {
           "campaignAddress": ContractAddr,
         }
      }));
});

app.get('/endCampaign', async (req, res) => {
    var contract = new web3.eth.Contract(CampaignAbi.abi, ContractAddr);
    await contract.methods.closeCampaign().send({ from: orgB, gas: 90000000, gasPrice: 0 });

    res.redirect(url.format({
        pathname:"/campaign",
        query: {
           "campaignAddress": ContractAddr,
         }
      }));
});

app.use((req, res, next) => {
    res.status(404);

    if (req.accepts('html')) {
        res.render('404');
        return;
    }
});

app.listen(3000, () => {
    console.log('Frontend listening on port 3000!');
});