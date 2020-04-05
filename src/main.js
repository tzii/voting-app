import "regenerator-runtime/runtime";

import * as nearlib from "nearlib"
import getConfig from "./config"

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

    // Initializing our contract APIs by contract name and configuration.
    window.contract = await near.loadContract(nearConfig.contractName, { // eslint-disable-line require-atomic-updates
        // NOTE: This configuration only needed while NEAR is still in development
        // View methods are read only. They don't modify the state, but usually return some value.
        viewMethods: ['show_options'],
        // Change methods can modify the state. But you don't receive the returned value when called.
        changeMethods: ['vote'],
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

    show_options();

    // Adding an event to a sign-out button.
    document.getElementById('sign-out-button').addEventListener('click', () => {
        walletAccount.signOut();
        // Forcing redirect.
        window.location.replace(window.location.origin + window.location.pathname);
    });

    // Adding an event to change greeting button.
    document.getElementById('vote-button').addEventListener('click', () => {
        vote_submit();
    });
}

async function vote() {
    await window.contract.vote({option:''});
    show_options();
}

async function show_options() {
    const response = await window.contract.show_options({account_id:window.accountId});
    /*const response = {
        user: "Nik",
        question: "What is your transport?",
        variants: {
            "bike": "Bike",
            "car": "Car"
        }
    }; */
    var variants = '';
    // TODO: maybe use older ES syntax?
    for (const [key, value] of Object.entries(response.variants)) {
        variants += '<input type="checkbox" id="' + key +'" value="' + key + '">' +
           '<label for="' + name + '">' + value + '</label><br>';
    }
    const options = '<form id="voteForm">' +
        '<fieldset>' +
        '<legend>' +
        "Dear @" + response.user + " please vote on <br/><b>" + response.question + "</b>" +
        '</legend>' +
        variants +
        '</fieldset>' +
        '</form>';
    document.getElementById('vote_options').innerHTML = options;
}

async function vote_submit() {
    const voteForm = document.getElementById('voteForm');
    const variants = voteForm.getElementsByTagName("input")
    for (var i = 0; i < variants.length; i++) {
        const variant = variants[i];
        window.console.log(variant.id + " " + variant.checked);
    }
}

// Loads nearlib and this contract into window scope.
window.nearInitPromise = InitContract()
    .then(doWork)
    .catch(console.error);