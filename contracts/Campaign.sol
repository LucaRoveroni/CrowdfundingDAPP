// Peer to Peer & Blockchain Cource 2019/20
// Author: Luca Roveroni - 606803
// BitCollect: A decentralized crowdfunding platform

// Solidity version
pragma solidity 0.5.16;

// Necessary for the memory keyword when passing
pragma experimental ABIEncoderV2;

/**
 @notice This contract describes the status of crowdfounding campaign.
 Every campaign has at least one organizer and one beneficiary.
 A campaign status can be modified by different actors.
*/
contract Campaign {

    // Events used for RQ-EVENT
    event created();                // Campaign deployed
    event initializated();          // Compaign has organizers and beneficiaries
    event ready();                  // Compaign ready for donations from users
    event reported();               // If a campaign is reported from an important amount of users
    event completed();              // All the funds has been withdrawn
    event deactivated();            // Compaign deactivated

    // Box state
    enum State {CREATED, INITIALIZATED, READY, REPORTED, COMPLETED, DEACTIVATED}

    // State of the campaign
    State public state;

    // Campaign attributes (I used global counter since mapping doesn't provide an items counter)
    uint private deadline;

    // Donor struct
    // I don't use a username just for transparency
    struct Donator {
        address donAddress;       // Address of the donor
        uint numDonations;        // Total number of donations made by this donor
        uint amount;              // Total ETH donated by this donor
        bool hasWithDrawn;        // If the donor has withdrawn its ETH if campaign is fraudolent
    }

    // Organizer struct
    struct Organizer {
        string orgName;       // Organization name (made public on the blockchain)
        address orgAddress;   // Organization address
        bool hasInitializate; // Default false in Solidity
        uint initDonation;    // Amount donated as initial donation
    }

    // Organizer struct
    struct Beneficiary {
        string benName;      // Beneficiary name (made public on the blockchain)
        address benAddress;  // Beneficiary address
        uint donationAmount; // Total of ETH this beneficiary received
        bool hasWithDrawn;   // If this beneficiary has already withdrawn its ETH
    }

    // Reward struct
    struct Reward {
        string reward;  // A name representing the reward
        uint threshold; // Value in ETH of the threshold
    }

    // Reward to claim struct
    struct ClaimReward {
        Reward gift;
        bool hasClaimed; // If the donor withdraw this reward
    }

    // Reporter struct
    struct Reporter {
        address repAddress;
        uint betAmount;
        bool hasWithDrawn;
    }

    // Three main contract actors
    mapping (address => Donator) private donators;              // RQ-HIST
    mapping (address => Organizer) private organizers;
    mapping (address => Beneficiary) private beneficiaries;
    mapping (address => ClaimReward[]) private donatorsRewards; // RQ-REWARDS
    mapping (address => Reporter) private reporters;            // RQ-REPORT

    // I should use an array of addresses since mapping doesn't provide an items getter
    address[] listBeneficiaries;
    address[] listOrganizers;
    address[] listDonators;
    address[] listReporters;
    Reward[] listRewards;

    // Temporary values used for init phase and complete phase
    uint tempOrganizers = 0;
    uint tempBeneficiaries = 0;

    // RQ-REJECT: Reject any donation after the deadline.
    modifier onlyActiveCampaign() {
        require(deadline != 0, "Error: the campaign hasn't set yet!");

        if (deadline < now) {
            state = State.COMPLETED;
            emit completed();
        }
        _;
    }

    modifier onlyIfReady() {
        require(state == State.READY, "Error: the campaign must be ready for accepting donations.");
        _;
    }

    // Check if a organizer exists in the contract hash table
    modifier onlyOrganizers() {
        require(organizers[msg.sender].orgAddress != address(0x0), "Error: only organizers can call this function!");
        _;
    }

    // Check if a beneficiary exists in the contract hash table
    modifier onlyBeneficiaries() {
        require(beneficiaries[msg.sender].benAddress != address(0x0), "Error: only beneficiaries can call this function!");
        _;
    }

    // Check if a donor exists in the contract hash table
    modifier onlyDonators() {
        require(donators[msg.sender].donAddress != address(0x0), "Error: only donors can call this function!");
        _;
    }

    modifier notDeactivated() {
        require(state != State.DEACTIVATED, "Notice: the campaign has been deactivated!");
        _;
    }

    modifier notReported() {
        require(state != State.REPORTED, "Notice: the campaign has been set as fraudolent!");
        _;
    }

    /// @notice RQ-CREATE
    // As soon as the smart contract has been deployed, no new organizers or beneficiaries can be included.
    constructor () public {
        state = State.CREATED;

        emit created();
    }

    /// @notice RQ-PARAMS & RQ-REWARD
    // Specify the organizers, beneficiaries, the campaign deadline and the rewards.
    // Both the number of organizers and that ofbeneficiaries is greater or equal than 1.
    function setCampaignParams( Organizer[] memory _organizers,
                                Beneficiary[] memory _beneficiaries,
                                uint _deadline,
                                Reward[] memory _rewards ) public notReported() notDeactivated() {

        require(state == State.CREATED, "Error: the campaign must be first created.");
        require(_organizers.length >= 1, "Error: the number of organizers must be at least 1.");
        require(_beneficiaries.length >= 1, "Error: the number of beneficiaries must be at least 1.");
        require(_deadline > now, "Error: the deadline must be a future date!");
        require(_rewards.length >= 1, "Error: the number of rewards must be at least 1.");

        deadline = _deadline;

        for (uint i = 0; i < _rewards.length - 1; i++) {
            require(_rewards[i].threshold < _rewards[i+1].threshold, "Error: the rewards must have an incremental threshold!");
        }

        for (uint i = 0; i < _rewards.length; i++) {
            listRewards.push(_rewards[i]);
        }

        for (uint i = 0; i < _organizers.length; i++) {
            listOrganizers.push(_organizers[i].orgAddress);
            organizers[_organizers[i].orgAddress] = _organizers[i];
        }

        for (uint i = 0; i < _beneficiaries.length; i++) {
            listBeneficiaries.push(_beneficiaries[i].benAddress);
            beneficiaries[_beneficiaries[i].benAddress] = _beneficiaries[i];
        }

        state = State.INITIALIZATED;

        emit initializated();
    }

    /// @notice RQ-INIT
    // Collect an initial donation from each organizer before the campaign starts.
    function initCampaign() public notReported() notDeactivated() onlyActiveCampaign() onlyOrganizers() payable {
        require(state == State.INITIALIZATED, "Error: the campaign must be initializated.");
        require(msg.value > 0, "Error: the organizer must donate a positive amount of Ether.");
        require(organizers[msg.sender].orgAddress != address(0x0), "Error: this organizer doesn't exist.");
        require(organizers[msg.sender].hasInitializate == false, "Notice: this organizer has already donated.");

        organizers[msg.sender].initDonation = msg.value;

        // Every organizer donation is splitted equally between beneficiaries and the change is given to the first one
        uint donationChunk = msg.value / listBeneficiaries.length;
        uint change = msg.value - (donationChunk * listBeneficiaries.length);

        beneficiaries[listBeneficiaries[0]].donationAmount += donationChunk + change;

        for (uint i = 1; i < listBeneficiaries.length; i++) {
            beneficiaries[listBeneficiaries[i]].donationAmount += donationChunk;
        }

        organizers[msg.sender].hasInitializate = true;

        tempOrganizers++;

        if (tempOrganizers == listOrganizers.length) {
            state = State.READY;
            emit ready();
        }
    }

    // The RQ-DONS2 will accept an array of DonBeneficiary as input parameter
    struct DonBeneficiary {
        address benAddress; // How will receive the partial donation
        uint donAmount;     // The amount of the partial donation (0.3 ETH to beneficiary A)
    }

    /// @notice RQ-DONS2
    // Allow a donor to choose how to distribute their donation among the beneficiaries.
    function donate(DonBeneficiary[] memory multiDonation) public notReported() notDeactivated() onlyActiveCampaign() onlyIfReady() payable {
        require(multiDonation.length == listBeneficiaries.length, "Error: not enough beneficiaries!");

        uint total_amount = 0;

        for (uint i = 0; i < multiDonation.length; i++) {
            total_amount += multiDonation[i].donAmount;
        }

        require(total_amount == msg.value, "Error: the donation must corrispond the sum of the partial donations!");

        // Add the donor to the donors
        if (donators[msg.sender].donAddress == address(0x0)) {
            Donator memory newDonator = Donator(msg.sender, 1, msg.value, false);

            // Add the donor the list and mapping of donors
            donators[msg.sender] = newDonator;
            listDonators.push(msg.sender);

            // Assign the reached reward to the donor
            giveRewards(msg.sender, msg.value);
        } else {
            // Increment donor attributes
            donators[msg.sender].numDonations++;
            donators[msg.sender].amount += msg.value;

            // If the donor already exists adds only new reached rewards
            giveRewards(msg.sender, donators[msg.sender].amount);
        }

        // Add the donation to the beneficiaries
        for (uint i = 0; i < multiDonation.length; i++) {
            beneficiaries[multiDonation[i].benAddress].donationAmount += multiDonation[i].donAmount;
        }
    }

    /// @notice RQ-REWARD
    function withdrawRewards() public notReported() notDeactivated() onlyDonators() onlyActiveCampaign() onlyIfReady() {
        uint withdrawRews = 0;

        for (uint i = 0; i < donatorsRewards[msg.sender].length; i++) {
            if (donatorsRewards[msg.sender][i].hasClaimed) {
                withdrawRews++;
            } else {
                donatorsRewards[msg.sender][i].hasClaimed = true;
            }
        }

        require(withdrawRews != donatorsRewards[msg.sender].length, "Notice: this donor has withdraw all of his/her rewards.");
    }

    /// @notice RQ-REPORT
    // A user can report the campaign betting an amount of ETH
    function report() public notReported() notDeactivated() onlyActiveCampaign() onlyIfReady() payable {
        require(msg.value > 0, "Error: the reporter must specify a valid amount.");

        // Verify if the campaign can be set as fraudolent
        // A campaign can be set as fraudolent if the number of reporters is at least 50% + 1 more than the donors
        // but only if the number of donors is greater than 15

        // Check if a reporter has already reported yet
        if (reporters[msg.sender].repAddress == address(0x0)) {
            Reporter memory newReporter = Reporter(msg.sender, msg.value, false);
            listReporters.push(msg.sender);
            reporters[msg.sender] = newReporter;

        } else {
            reporters[msg.sender].betAmount += msg.value;
        }

        // Assign the bet amount to the beneficiaries
        // If the campaign will be set as fraudolent the beneficiaries can't withdraw their donations
        uint chunk = msg.value / listBeneficiaries.length;
        uint change = msg.value - (chunk * listBeneficiaries.length);

        // Give the change to the first beneficiary
        beneficiaries[listBeneficiaries[0]].donationAmount += chunk + change;

        for (uint i = 1; i < listBeneficiaries.length; i++) {
            beneficiaries[listBeneficiaries[i]].donationAmount += chunk;
        }

        uint checkFraudolent = listDonators.length / 2;

        if (listReporters.length >= checkFraudolent + 1 && listDonators.length >= 15) {
            // Split the organizers initial donations to the reporters
            uint initialAmount = 0;

            for (uint i = 0; i < listOrganizers.length; i++) {
                initialAmount += organizers[listOrganizers[i]].initDonation;
            }

            uint chunkDon = initialAmount / listReporters.length;
            uint changeDon = initialAmount - (chunkDon * listReporters.length);

            // Give the change to the first reporter since his/her trust
            reporters[listReporters[0]].betAmount += chunkDon + changeDon;

            for (uint i = 1; i < listReporters.length; i++) {
                reporters[listReporters[i]].betAmount += chunkDon;
            }

            state = State.REPORTED;
            emit reported();
        }
    }

    /// @notice RQ-WITHDR
    // Allow the beneficiaries to withdraw their expected amounts after the deadline of the campaign has been reached.
    function withdrawDonations() public notReported() notDeactivated() onlyActiveCampaign() onlyBeneficiaries() {
        require(state == State.COMPLETED, "Error: the campaign is already active!");
        require(beneficiaries[msg.sender].hasWithDrawn == false, "Notice: this beneficiary has already withdrawn his/her donations.");
        require(beneficiaries[msg.sender].donationAmount > 0, "Notice: the beneficiary doesn't have any donations.");

        // Transfer money to the beneficiary
        (bool success, ) = (msg.sender).call.value(beneficiaries[msg.sender].donationAmount)("");
        require(success == true, "Error while paying the beneficiary");

        beneficiaries[msg.sender].hasWithDrawn = true;

        tempBeneficiaries++;

        if (tempBeneficiaries == listBeneficiaries.length) {
            state = State.COMPLETED;
            emit completed();
        }
    }

    /// @notice RQ-REPORT
    // Allow reporters to withdraw their donation amount
    function withdrawReporter() public notDeactivated() onlyActiveCampaign() {
        require(state == State.REPORTED, "Notice: the campaign isn't reported as fraudolent");
        require(reporters[msg.sender].repAddress != address(0x0), "Error: this reporter doesn't exist!");
        require(reporters[msg.sender].hasWithDrawn == false, "Notice: this reporter has already withdrawn his/her donations.");

        // Transfer money to the reporter
        (bool success, ) = (msg.sender).call.value(reporters[msg.sender].betAmount)("");
        require(success == true, "Error while paying the reporter");

        beneficiaries[msg.sender].hasWithDrawn = true;
    }

    // Allow donors to withdraw their donation amount
    function withdrawDonator() public notDeactivated() onlyActiveCampaign() onlyDonators() {
        require(state == State.REPORTED, "Notice: the campaign isn't reported as fraudolent");
        require(donators[msg.sender].hasWithDrawn == false, "Notice: this donor has already withdrawn his/her donations.");
        require(donators[msg.sender].amount > 0, "Notice: the donor doesn't have any donations.");

        // Transfer money to the donor
        (bool success, ) = (msg.sender).call.value(donators[msg.sender].amount)("");
        require(success == true, "Error while paying the donor");

        donators[msg.sender].hasWithDrawn = true;
    }

    /// @notice RQ-CLOSE
    // Allow the organizers to deactivate the contract afterall of its funds have been withdrawn.
    function closeCampaign() public notReported() notDeactivated() onlyOrganizers() {
        require(state == State.COMPLETED, "Error: the campaign donations must be withdrawn by the beneficiaries!");
        require(address(this).balance == 0, "Notice: not all the funds has been withdrawn.");

        state = State.DEACTIVATED;

        // Deactivate the smart contract
        // From now on the contract will return an error
        emit deactivated();
    }

    /// @notice Some usuful functions
    // Get the correct reward for a donor
    function giveRewards(address donator, uint donationAmount) private {
        // Position of the maximum reward in the contract according to the donation amount
        uint maxReward = 0;

        // Assign maximum reward by donation amount
        for (uint i = 0; i < listRewards.length; i++) {
            if (donationAmount >= listRewards[i].threshold) {
               maxReward++;
            }
        }

        // If the donor doesn't have any rewards add them
        if (donatorsRewards[donator].length == 0) {
            for (uint i = 0; i < maxReward; i++) {
                ClaimReward memory reward = ClaimReward(listRewards[i], false);
                donatorsRewards[donator].push(reward);
            }
        // If the donor has some rewards add only the new one
        } else {
            uint leftRewards = listRewards.length - donatorsRewards[donator].length;
            uint startPosition = listRewards.length - leftRewards;

            for (uint i = startPosition; i < maxReward; i++) {
                ClaimReward memory reward = ClaimReward(listRewards[i], false);
                donatorsRewards[donator].push(reward);
            }
        }
    }

    // Just some public functions to retrieve and modify the contract state
    // Returns the deadline
    function getDeadline() public returns (uint) {
        return deadline;
    }

    function setDeadline(uint _deadline) public {
        deadline = _deadline;
        state = State.COMPLETED;
        emit completed();
    }

    // Returns the current campaign balance
    function getCampaignBalance() public returns (uint) {
        return address(this).balance;
    }

    // Returns a donor
    function getDonator(uint pos) public returns (Donator memory) {
        return donators[listDonators[pos]];
    }

    // Returns an organizer
    function getOrganizer(uint pos) public returns (Organizer memory) {
        return organizers[listOrganizers[pos]];
    }

    // Returns a beneficiary
    function getBeneficiary(uint pos) public returns (Beneficiary memory) {
        return beneficiaries[listBeneficiaries[pos]];
    }

    // Returns a reward
    function getReward(uint pos) public returns (Reward memory) {
        return listRewards[pos];
    }

    // Returns a donor's reward
    function getDonatorReward(address donator) public returns (ClaimReward[] memory) {
        return donatorsRewards[donator];
    }

    // Returns a reporter
    function getReporter(uint pos) public returns (Reporter memory) {
        return reporters[listReporters[pos]];
    }

    // Set the campaign as fraudulent
    function setFraudulent() public {
        uint initialAmount = 0;

        for (uint i = 0; i < listOrganizers.length; i++) {
            initialAmount += organizers[listOrganizers[i]].initDonation;
        }

        uint chunkDon = initialAmount / listReporters.length;
        uint changeDon = initialAmount - (chunkDon * listReporters.length);

        // Give the change to the first reporter since his/her trust
        reporters[listReporters[0]].betAmount += chunkDon + changeDon;

        for (uint i = 1; i < listReporters.length; i++) {
            reporters[listReporters[i]].betAmount += chunkDon;
        }

        state = State.REPORTED;
        emit reported();
    }

    // Returns the campaign state (the value is casted to the realtive enum position)
    function getCampaignState() public returns (State) {
        return state;
    }
}