const Campaign = artifacts.require("Campaign");

// Test the Campaign contract
contract("Testing Crowdfounding Platform", accounts => {

    const orgA = accounts[1];
    const orgB = accounts[2];
    const benA = accounts[3];
    const benB = accounts[4];
    const benC = accounts[5];
    const donA = accounts[6];
    const donB = accounts[7];
    const repA = accounts[8];
    const repB = accounts[9];
    const repC = accounts[10];

    it("Testing requirements", async () => {
        const instance = await Campaign.new();

        const futureDate = new Date('July 20, 2020 00:20:18 GMT+02:00');
        const deadline = futureDate.getTime() / 1000;

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
            initDonation: 1000000000
        }, {
            orgName: "Organizer 456",
            orgAddress: orgB,
            hasInitializate: false,
            initDonation: 1000000000
        }];

        const donators = [{
            donAddress: donA,
            numDonations: 0,
            amount: 0
        },{
            donAddress: donB,
            numDonations: 0,
            amount: 0
        }];

        const donBeneficiaries = [{
            benAddress: benA,
            donAmount: 5000000
        },{
            benAddress: benB,
            donAmount: 5000000
        }, {
            benAddress: benC,
            donAmount: 5000000
        }];

        const donBeneficiaries2 = [{
            benAddress: benA,
            donAmount: 33000000
        },{
            benAddress: benB,
            donAmount: 33000000
        }, {
            benAddress: benC,
            donAmount: 0
        }];

        const rewards = [{
            reward: "T-Shirt",
            threshold: 15000000
        }, {
            reward: "Backpack",
            threshold: 66000000
        }];

        // Calling setCampaignParams, RQ-PARAMS
        console.log("==================");
        const res0 = await instance.setCampaignParams(organizers, beneficiaries, deadline, rewards, { from: orgA });
        console.log("Gas used for setCampaignParams(): " + res0.receipt.gasUsed);
        console.log("==================");

        // Calling initCampaign, RQ-INIT
        const res1 = await instance.initCampaign({ from: orgA, value: 1000000000 });
        console.log("Gas used for initCampaign(): " + res1.receipt.gasUsed);
        console.log("==================");

        // Completing the initCampaign phase
        await instance.initCampaign({ from: orgB, value: 1000000000 });

        // Try to donate with wrong total amount donated and wrong number of beneficiaries
        // await instance.donate(donBeneficiaries, { from: donA, value: 1500000 }); // Print correct error
        const res2 = await instance.donate(donBeneficiaries, { from: donA, value: 15000000 });
        console.log("Gas used for donate(): " + res2.receipt.gasUsed);
        console.log("==================");

        // Try to withdraw donators rewards
        const res3 = await instance.withdrawRewards({ from: donA });
        console.log("Gas used for withdrawRewards(): " + res3.receipt.gasUsed);
        console.log("==================");

        // Try to report the campaign
        const res4 = await instance.report({from: repA, value: 88});
        console.log("Gas used for report(): " + res4.receipt.gasUsed);
        console.log("==================");

        // Setting the deadline as past date
        const pastDate = new Date('July 20, 2019 00:20:18 GMT+02:00');
        const pastDeadline = pastDate.getTime() / 1000;
        await instance.setDeadline(pastDeadline, {from: orgA });

        // Try to withdraw correctly
        const res5 = await instance.withdrawDonations({ from: benA });
        console.log("Gas used for withdrawDonations(): " + res5.receipt.gasUsed);
        console.log("==================");

        // // Try to withdraw twice
        // // await instance.withdrawDonations({ from: benA }); // Print correct error

        await instance.withdrawDonations({ from: benB });

        await instance.withdrawDonations({ from: benC });

        // Try last phase of closing the campaign
        const res6 = await instance.closeCampaign({ from: orgA });
        console.log("Gas used for closeCampaign(): " + res6.receipt.gasUsed);
        console.log("==================");
    });
});