import "regenerator-runtime/runtime";

import * as nearlib from "nearlib"
import getConfig from "./config"

const BN = require('bn.js');

let nearConfig = getConfig(process.env.NODE_ENV || "development");
window.nearConfig = nearConfig;

// Initializing contract
async function InitContract() {
    console.log('nearConfig', nearConfig);

    // Initializing connection to the NEAR DevNet.
    window.near = await nearlib.connect(Object.assign({ deps: { keyStore: new nearlib.keyStores.BrowserLocalStorageKeyStore() } }, nearConfig));

    // Initializing Wallet based Account. It can work with NEAR DevNet wallet that
    // is hosted at https://wallet.nearprotocol.com
    window.walletAccount = new nearlib.WalletAccount(window.near);

    // Getting the Account ID. If unauthorized yet, it's just empty string.
    window.accountId = window.walletAccount.getAccountId();

    const query = new URLSearchParams(window.location.search);
    const pollId = query.get('poll_id');
    window.voteState = {
        voteOwner: window.accountId,
        pollId: pollId
    };

    // Initializing our contract APIs by contract name and configuration.
    window.contract = await near.loadContract(nearConfig.contractName, { // eslint-disable-line require-atomic-updates
        // NOTE: This configuration only needed while NEAR is still in development
        // View methods are read only. They don't modify the state, but usually return some value.
        viewMethods: ['show_poll', 'show_results', 'ping'],
        // Change methods can modify the state. But you don't receive the returned value when called.
        changeMethods: ['vote', 'create_poll'],
        // Sender is the account ID to initialize transactions.
        sender: window.accountId,
    });
}

// Using initialized contract
async function doWork() {
    // Based on whether you've authorized, checking which flow we should go.
    if (!window.walletAccount.isSignedIn()) {
        signedOutFlow();
    } else {
        signedInFlow();
    }
}

// Function that initializes the signIn button using WalletAccount
function signedOutFlow() {
    // Displaying the signed out flow container.
    document.getElementById('signed-out-flow').classList.remove('d-none');
    // Adding an event to a sing-in button.
    document.getElementById('sign-in-button').addEventListener('click', () => {
        window.walletAccount.requestSignIn(
            // The contract name that would be authorized to be called by the user's account.
            window.nearConfig.contractName,
            // This is the app name. It can be anything.
            'Voting app'
        );
    });
}

// Main function for the signed-in flow (already authorized by the wallet).
function signedInFlow() {
    // Displaying the signed in flow container.
    document.getElementById('signed-in-flow').classList.remove('d-none');

    show_poll();

    // Adding an event to a sign-out button.
    document.getElementById('sign-out-button').addEventListener('click', () => {
        walletAccount.signOut();
        // Forcing redirect.
        window.location.replace(window.location.origin + window.location.pathname);
    });

    document.getElementById('vote-button').addEventListener('click', () => {
        const voteOptions = document.getElementById('vote-options');
        if (!voteOptions || voteOptions.style.display == 'none') {
            show_poll();
        } else {
            vote();
        }
    });

    document.getElementById('show-results-button').addEventListener('click', () => {
        show_vote_results();
    });

    // Adding an event to create vote.
    document.getElementById('create-poll-button').addEventListener('click', () => {
        show_create_poll();
    });

    document.getElementById('create-poll-submit').addEventListener('click', () => {
        create_poll();
    });

    document.getElementById('create-poll-cancel').addEventListener('click', () => {
        // TODO: clear state in form?
        hide_create_poll();
    });
}

async function show_poll() {
    if (!window.voteState.pollId) return;
    const response = await window.contract.show_poll( { poll_id: window.voteState.pollId } );
    if (!response) {
        status_message('No such poll ' + window.voteState.pollId);
        return;
    }
    var variants = '';
    for (var index = 0; index < response.variants.length; index++) {
        const v = response.variants[index];
        variants += '<input type="checkbox" id="' + v.option_id +'" value="' + v.option_id + '">' +
           '<label for="' + v.option_id + '">' + v.message + '</label><br>';
    }
    const options = '<form id="vote-form">' +
        '<fieldset>' +
        '<legend>' +
        "Dear @" + window.accountId + " please vote on poll by @" + response.creator + " <br/>" +
        '<div class="vote_question">' +
        response.question +
        "</div>" +
        '</legend>' +
        variants +
        '</fieldset>' +
        '</form>';
    document.getElementById('vote-options').innerHTML = options;
    document.getElementById('vote-options').style.display = 'inline';
    hide_poll_results();
    document.getElementById('vote-button').style.display = 'inline';
    document.getElementById('show-results-button').style.display = 'inline';
}

function format_variant(poll, results, index) {
    const voted = results.variants[poll.variants[index].option_id];
    return poll.variants[index].message + ' -> ' + (voted ? voted : 0);
}

async function show_vote_results() {
    if (!window.voteState.pollId) return;
    status_message("Talking to the blockchain...");
    const response = await window.contract.show_results({ poll_id: window.voteState.pollId } );
    status_message("Ready!");
    if (!response) {
        return;
    }
    show_poll_results();
    document.getElementById('result-poll-question').innerText = response.poll.question;
    document.getElementById('result-poll-v1').innerText = format_variant(response.poll, response.results, 0);
    document.getElementById('result-poll-v2').innerText = format_variant(response.poll, response.results, 1);
    document.getElementById('result-poll-v3').innerText = format_variant(response.poll, response.results, 2);
    const voted = Object.keys(response.results.voted).join(" ")
    document.getElementById('result-poll-voted').innerText = voted;
    document.getElementById('vote-options').style.display = 'none';
}

async function create_poll() {
    const question = document.getElementById("new-poll-question").value;
    const v1 = document.getElementById("new-poll-v1").value;
    const v2 = document.getElementById("new-poll-v2").value;
    const v3 = document.getElementById("new-poll-v3").value;
    // Creation of poll and voting need more gas to execute.
    status_message("Talking to the blockchain...");
    const poll = await window.contract.create_poll({question: question, variants: { v1: v1, v2: v2, v3: v3}},
        new BN(10000000000000));
    status_message("Ready, created " + poll);
    const base = document.documentURI.substr(0, document.documentURI.lastIndexOf('/'));
    const poll_address = base + "/?poll_id=" + poll;
    document.getElementById("new-poll-address").innerHTML = 'Newly created poll at <a href="' + poll_address + '">' + poll_address + '</a>';
    hide_create_poll();
}

async function vote() {
    const voteForm = document.getElementById('vote-form');
    const variants = voteForm.getElementsByTagName('input');
    const votes = {};
    for (var i = 0; i < variants.length; i++) {
        const variant = variants[i];
        votes[variant.id] = variant.checked ? 1 : 0 ;
    }
    // Creation of poll and voting needs more gas to execute.
    status_message("Talking to the blockchain...");
    const result = await window.contract.vote({poll_id: window.voteState.pollId, votes: votes},
        new BN(10000000000000));
    status_message("Your voice is " + (result ? "counted" : "NOT counted"));
}

// Loads nearlib and this contract into window scope.
window.nearInitPromise = InitContract()
    .then(doWork)
    .catch(console.error);


function show_create_poll() {
    const newPollForm = document.getElementById('new-poll-form');
    newPollForm.style.display = 'block';
    hide_poll_results();
    hide_poll_variants();
}

function hide_create_poll() {
    const newPollForm = document.getElementById('new-poll-form');
    newPollForm.style.display = 'none';
}

function show_poll_results() {
    document.getElementById('show-poll-results').style.display = 'block';
    hide_create_poll();
    hide_poll_variants();
}

function hide_poll_results() {
    document.getElementById('show-poll-results').style.display = 'none';
}

function status_message(text) {
    document.getElementById('status-message-bar').innerText = text;
}

function hide_poll_variants() {
    const vote = document.getElementById('vote-options');
    if (vote) vote.style.display = 'none';
}