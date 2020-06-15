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
        await instance.setCampaignParams(organizers, beneficiaries, deadline, rewards, { from: orgA });
        console.log("Organizers, beneficiaries and deadline set!");
        console.log("==================");

        // Calling initCampaign, RQ-INIT
        await instance.initCampaign({ from: orgA, value: 1000000000 });
        console.log("Organizer A initialized the campaign!");
        console.log("==================");

        // Re-Calling initCampaign with the same organizer, should get a notice
        // await instance.initCampaign({ from: orgA, value: 1000000000 }); // Print correct error

        // Try to donate as user before the inizializing from each organizers
        //await instance.donate(donBeneficiaries, { from: donA, value: 15000000 }); // Print correct error

        // Completing the initCampaign phase
        await instance.initCampaign({ from: orgB, value: 1000000000 });
        console.log("Organizer B initialized the campaign!");
        console.log("==================");

        for (let i = 0; i < rewards.length; i++) {
            const rews = await instance.getReward.call(i, { from: orgA });
            console.log("Reward " + i + ": " + rews);
        }
        console.log("==================");

        // Try to donate with wrong total amount donated and wrong number of beneficiaries
        // await instance.donate(donBeneficiaries, { from: donA, value: 1500000 }); // Print correct error
        await instance.donate(donBeneficiaries, { from: donA, value: 15000000 });
        console.log("Donator A donated!");
        console.log("==================");

        await instance.donate(donBeneficiaries, { from: donA, value: 15000000 });
        console.log("Donator A donated twice!");
        console.log("==================");

        await instance.donate(donBeneficiaries2, { from: donB, value: 66000000 });
        console.log("Donator B donated!");
        console.log("==================");

        // Try to withdraw donators rewards
        await instance.withdrawRewards({ from: donA });
        console.log("Donator A withdraw his/her reward!");
        console.log("==================");

        await instance.withdrawRewards({ from: donB });
        console.log("Donator B withdraw his/her reward!");
        console.log("==================");

        // Try to donate again and reach a new reward
        await instance.donate(donBeneficiaries2, { from: donA, value: 66000000 });
        console.log("Donator A donated for the third time!");
        console.log("==================");

        // Try again to withdraw his/her left rewards
        await instance.withdrawRewards({ from: donA });
        console.log("Donator A withdraw reward!");
        console.log("==================");

        // Try to withdraw when all his/her rewards has already withdrawn
        // await instance.withdrawRewards({ from: donA }); // Print correct error

        // Try to withdraw a beneficiary's donation before the deadline is reached and using a non-beneficiary
        // await instance.withdrawDonations({ from: orgA }); // Print correct error
        // await instance.withdrawDonations({ from: benA }); // Print correct error if the campaign still ready

        // Try to report the campaign
        await instance.report({from: repA, value: 88});
        console.log("Reporter A report!");
        console.log("==================");

        await instance.report({from: repB, value: 88});
        console.log("Reporter B report!");
        console.log("==================");

        // Donator withdraw his/her donation amount but the campaign is not fraudolent
        // await instance.withdrawDonator({ from: donA }); // Print correct error

        // Setting the deadline as past date
        const pastDate = new Date('July 20, 2019 00:20:18 GMT+02:00');
        const pastDeadline = pastDate.getTime() / 1000;
        await instance.setDeadline(pastDeadline, {from: orgA });
        console.log("Deadline set to a past date!");
        console.log("==================");

        // Try to withdraw correctly
        await instance.withdrawDonations({ from: benA });
        console.log("Beneficiary A has withdrawn!");
        console.log("==================");

        // // Try to withdraw twice
        // // await instance.withdrawDonations({ from: benA }); // Print correct error

        await instance.withdrawDonations({ from: benB });
        console.log("Beneficiary B has withdrawn!");
        console.log("==================");

        await instance.withdrawDonations({ from: benC });
        console.log("Beneficiary C has withdrawn!");
        console.log("==================");

        // Try last phase of closing the campaign
        await instance.closeCampaign({ from: orgA });
        console.log("All operations done, campaign closed!");
        console.log("==================");
        // console.log("Smart Contract internal status:\n");

        // Print Full Campaign Staus
        const stat = await instance.getCampaignState.call({ from: orgA });
        console.log("Campaign internal status: " + stat);

        const _deadline = await instance.getDeadline.call({ from: orgA });
        var d = new Date();
        d.setTime(_deadline * 1000);
        console.log("Campaign deadline: " + d);
        console.log("==================");

        for (let i = 0; i < rewards.length; i++) {
            const rews = await instance.getReward.call(i, { from: orgA });
            console.log("Reward " + i + ": " + rews);
        }

        console.log("==================");

        for (let i = 0; i < organizers.length; i++) {
            const orgs = await instance.getOrganizer.call(i, { from: orgA });
            console.log("Organizer " + i + ": " + orgs);
        }

        console.log("==================");

        for (let i = 0; i < beneficiaries.length; i++) {
            const bens = await instance.getBeneficiary.call(i, { from: orgA });
            console.log("Beneficiary " + i + ": " + bens);
        }

        console.log("==================");

        for (let i = 0; i < donators.length; i++) {
            const dons = await instance.getDonator.call(i, { from: orgA });
            console.log("Donator " + i + ": " + dons);
        }

        console.log("==================");

        const donRew1 = await instance.getDonatorReward.call(donA, { from: orgA });
        console.log("Donator A: " + donRew1);

        const donRew2 = await instance.getDonatorReward.call(donB, { from: orgA });
        console.log("Donator B: " + donRew2);
        console.log("==================");
    });
});