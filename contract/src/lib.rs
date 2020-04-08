use borsh::{BorshDeserialize, BorshSerialize};
use near_bindgen::{env, near_bindgen};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[derive(Serialize, Deserialize, Clone, BorshDeserialize, BorshSerialize)]
pub struct VotingOption {
    option_id: String,
    message: String,
}

#[derive(Serialize, Deserialize, Clone, BorshDeserialize, BorshSerialize)]
pub struct VotingOptions {
    // Author of the vote (account id).
    creator: String,
    // Unique voting id.
    voting_id: String,
    // Question voted on.
    question: String,
    variants: Vec<VotingOption>,
}

#[derive(Serialize, Deserialize, Clone, BorshDeserialize, BorshSerialize)]
pub struct VotingResults {
    // Unique voting id.
    voting_id: String,
    // Map of option id to the number of votes.
    variants: HashMap<String, i32>,
    // Map of voters who already voted.
    voted: HashMap<String, i32>,
}

#[cfg(feature = "std")]
impl BorshSerialize for VotingOption {
    #[inline]
    fn serialize<W: Write>(&self, writer: &mut W) -> Result<(), Error> {
        self.voting_id.serialize(writer)?;
        self.message.serialize(writer)?;
        Ok(())
    }
}

#[cfg(feature = "std")]
impl BorshDeserialize for VotingOption {
    #[inline]
    fn deserialize<R: Read>(reader: &mut R) -> Result<Self, Error> {
        let voting_id = String::deserialize(reader)?;
        let message = String::deserialize(reader)?;
        Ok(VotingOption {
            voting_id: voting_id,
            message: message,
        })
    }
}

#[cfg(feature = "std")]
impl BorshSerialize for VotingOptions {
    #[inline]
    fn serialize<W: Write>(&self, writer: &mut W) -> Result<(), Error> {
        self.creator.serialize(writer)?;
        self.voting_id.serialize(writer)?;
        self.question.serialize(writer)?;
        self.variants.serialize(writer)?;
        Ok(())
    }
}

#[cfg(feature = "std")]
impl BorshDeserialize for VotingOptions {
    #[inline]
    fn deserialize<R: Read>(reader: &mut R) -> Result<Self, Error> {
        let creator = String::deserialize(reader)?;
        let voting_id = String::deserialize(reader)?;
        let question = String::deserialize(reader)?;
        let variants = VotingOption::deserialize(reader)?;
        Ok(VotingOptions {
            creator: creator,
            voting_id: voting_id,
            question: question,
            variants: variants,
        })
    }
}

#[cfg(feature = "std")]
impl BorshSerialize for VotingResults {
    #[inline]
    fn serialize<W: Write>(&self, writer: &mut W) -> Result<(), Error> {
        self.id.serialize(writer)?;
        self.variants.serialize(writer)?;
        self.voted.serialize(writer)?;
        Ok(())
    }
}

#[cfg(feature = "std")]
impl BorshDeserialize for VotingResults {
    #[inline]
    fn deserialize<R: Read>(reader: &mut R) -> Result<Self, Error> {
        let voting_id = String::deserialize(reader)?;
        let variants = <HashMap<String, i32>>::deserialize(reader)?;
        let voted = <HashMap<String, i32>>::deserialize(reader)?;
        Ok(VotingResults {
            voting_id: voting_id,
            variants: variants,
            voted: voted,
        })
    }
}

#[near_bindgen]
#[derive(Default, BorshDeserialize, BorshSerialize)]
pub struct Voting {
    // Map of voting id to voting options.
    votings: HashMap<String, VotingOptions>,
    // Map of voting id to voting results.
    results: HashMap<String, VotingResults>,
}

#[near_bindgen]
impl Voting {
    pub fn vote(&mut self, voting_id: String, vote: String) -> bool {
        let voter_contract = env::signer_account_id();
        let owner_contract = env::current_account_id();
        env::log(
            format!("{} is voting on {} owner is {}", voter_contract, voting_id, owner_contract)
                .as_bytes(),
        );
        // Now we need to find a contract to vote for.
        match self.results.get_mut(&voting_id) {
            Some(results) => {
                match results.voted.get(&voter_contract) {
                    Some(_) => {
                        env::log(
                            format!("{} already voted in {}", voter_contract, voting_id)
                                .as_bytes(),
                        );
                        return false;
                    }
                    None => {
                        results.voted.insert(voter_contract, 1);
                    }
                }
                match results.variants.get_mut(&vote) {
                    Some(result) => {
                        *result = *result + 1;
                    }
                    None => {
                        results.variants.insert(vote, 1);
                    }
                }
                return true;
            }
            None => {
                env::log(format!("no voting known for {}", voting_id).as_bytes());
                return false;
            }
        };
    }

    pub fn create_voting(&mut self, question: String, variants: HashMap<String, String>) -> String {
        let creator_account_id = env::signer_account_id();
        let owner_account_id = env::current_account_id();
        let voting_id = bs58::encode(env::sha256(&env::random_seed())).into_string();
        let result = format!("owner={}&voting={}", owner_account_id, voting_id);
        //env::log(format!("new voting id is {}", voting_id).as_bytes());
        let mut variants_vec = <Vec<VotingOption>>::new();
        for (k, v) in variants.iter() {
            variants_vec.push(VotingOption {
                option_id: k.to_string(),
                message: v.to_string(),
            })
        }
        self.votings.insert(
            result.clone(),
            VotingOptions {
                creator: creator_account_id,
                voting_id: voting_id,
                question: question,
                variants: variants_vec,
            },
        );
        return result;
    }

    pub fn show_options(&self, voting_id: String) -> VotingOptions {
        match self.votings.get(&voting_id) {
            Some(options) => {
                env::log(b"Known voting.");
                options.clone()
            }
            None => {
                env::log(b"Unknown voting.");
                VotingOptions {
                    creator: "Bogus".to_string(),
                    voting_id: "000000000000".to_string(),
                    question: "Bogus question".to_string(),
                    variants: vec![
                        VotingOption {
                            option_id: "variant1".to_string(),
                            message: "Variant 1".to_string(),
                        },
                        VotingOption {
                            option_id: "variant2".to_string(),
                            message: "Variant2 2".to_string(),
                        },
                    ],
                }
            }
        }
    }
}

/*
#[cfg(not(target_arch = "wasm32"))]
#[cfg(test)]
mod tests {
    use super::*;
    use near_bindgen::MockedBlockchain;
    use near_bindgen::{testing_env, VMContext};

    fn get_context(input: Vec<u8>, is_view: bool) -> VMContext {
        VMContext {
            current_account_id: "alice_near".to_string(),
            signer_account_id: "bob_near".to_string(),
            signer_account_pk: vec![0, 1, 2],
            predecessor_account_id: "carol_near".to_string(),
            input,
            block_index: 0,
            block_timestamp: 0,
            account_balance: 0,
            account_locked_balance: 0,
            storage_usage: 0,
            attached_deposit: 0,
            prepaid_gas: 10u64.pow(18),
            random_seed: vec![0, 1, 2],
            is_view,
            output_data_receivers: vec![],
        }
    }

    #[test]
    fn set_get_message() {
        let context = get_context(vec![], false);
        testing_env!(context);
        let mut contract = Voting::default();
        contract.set_greeting("howdy".to_string());
        assert_eq!(
            "howdy bob_near".to_string(),
            contract.welcome("bob_near".to_string()).text
        );
    }

    #[test]
    fn get_nonexistent_message() {
        let context = get_context(vec![], true);
        testing_env!(context);
        let contract = Welcome::default();
        assert_eq!(
            "Hello francis.near".to_string(),
            contract.welcome("francis.near".to_string()).text
        );
    }
}
*/
