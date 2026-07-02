#![cfg(test)]
use super::*;
use crate::PredictionMarketClient;
use soroban_sdk::{testutils::Address as _, testutils::Ledger, Address, Env, String};

fn setup(env: &Env) -> (Address, PredictionMarketClient<'_>, Address) {
    env.mock_all_auths();
    let admin = Address::generate(env);
    let native_token = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let sac = token::StellarAssetClient::new(env, &native_token);
    sac.mint(&admin, &1_000_000);

    let contract_id = env.register(PredictionMarket, ());
    let client = PredictionMarketClient::new(env, &contract_id);
    (contract_id, client, native_token)
}

fn mint(env: &Env, token: &Address, to: &Address, amount: i128) {
    let sac = token::StellarAssetClient::new(env, token);
    sac.mint(to, &amount);
}

fn create_market_internal(
    client: &PredictionMarketClient,
    creator: &Address,
    question: &str,
    deadline: u64,
) {
    client.create_market(creator, &String::from_str(&client.env, question), &deadline);
}

#[test]
fn test_create_market() {
    let env = Env::default();
    let (_, client, _) = setup(&env);
    let creator = Address::generate(&env);

    create_market_internal(&client, &creator, "Will BTC hit $100K?", 9999999999);

    let count = client.get_market_count();
    assert_eq!(count, 1);

    let market = client.get_market(&0);
    assert_eq!(market.creator, creator);
    assert_eq!(market.question, String::from_str(&env, "Will BTC hit $100K?"));
    assert_eq!(market.resolved, false);
}

#[test]
#[should_panic(expected = "Deadline must be in the future")]
fn test_create_market_past_deadline() {
    let env = Env::default();
    let (_, client, _) = setup(&env);
    let creator = Address::generate(&env);
    env.ledger().set_timestamp(1000);
    create_market_internal(&client, &creator, "Test", 500);
}

#[test]
#[should_panic(expected = "Question cannot be empty")]
fn test_create_market_empty_question() {
    let env = Env::default();
    let (_, client, _) = setup(&env);
    let creator = Address::generate(&env);
    create_market_internal(&client, &creator, "", 9999999999);
}

#[test]
fn test_place_bet_yes() {
    let env = Env::default();
    let (_, client, native_token) = setup(&env);
    let creator = Address::generate(&env);
    let alice = Address::generate(&env);

    create_market_internal(&client, &creator, "Test market", 9999999999);
    mint(&env, &native_token, &alice, 1000);
    client.place_bet(&alice, &native_token, &0, &true, &500);

    let market = client.get_market(&0);
    assert_eq!(market.yes_pool, 500);
    assert_eq!(market.no_pool, 0);
    assert_eq!(market.yes_bets.len(), 1);
    assert_eq!(market.yes_bets.get(0).unwrap().amount, 500);
}

#[test]
fn test_place_bet_no() {
    let env = Env::default();
    let (_, client, native_token) = setup(&env);
    let creator = Address::generate(&env);
    let bob = Address::generate(&env);

    create_market_internal(&client, &creator, "Test market", 9999999999);
    mint(&env, &native_token, &bob, 1000);
    client.place_bet(&bob, &native_token, &0, &false, &300);

    let market = client.get_market(&0);
    assert_eq!(market.no_pool, 300);
}

#[test]
fn test_place_bet_accumulates() {
    let env = Env::default();
    let (_, client, native_token) = setup(&env);
    let creator = Address::generate(&env);
    let alice = Address::generate(&env);

    create_market_internal(&client, &creator, "Test", 9999999999);
    mint(&env, &native_token, &alice, 1000);
    client.place_bet(&alice, &native_token, &0, &true, &100);
    client.place_bet(&alice, &native_token, &0, &true, &50);

    let market = client.get_market(&0);
    assert_eq!(market.yes_pool, 150);
    assert_eq!(market.yes_bets.len(), 1);
    assert_eq!(market.yes_bets.get(0).unwrap().amount, 150);
}

#[test]
#[should_panic(expected = "Market already resolved")]
fn test_bet_on_resolved_fails() {
    let env = Env::default();
    let (_, client, native_token) = setup(&env);
    let creator = Address::generate(&env);
    let alice = Address::generate(&env);

    create_market_internal(&client, &creator, "Test", 100);
    env.ledger().set_timestamp(200);
    client.resolve_market(&creator, &native_token, &0, &true);
    mint(&env, &native_token, &alice, 100);
    client.place_bet(&alice, &native_token, &0, &true, &10);
}

#[test]
fn test_resolve_and_claim() {
    let env = Env::default();
    let (_, client, native_token) = setup(&env);
    let creator = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    create_market_internal(&client, &creator, "Test", 100);
    mint(&env, &native_token, &alice, 1000);
    mint(&env, &native_token, &bob, 1000);

    client.place_bet(&alice, &native_token, &0, &true, &500);
    client.place_bet(&bob, &native_token, &0, &false, &300);

    env.ledger().set_timestamp(200);

    client.resolve_market(&creator, &native_token, &0, &true);

    let market = client.get_market(&0);
    assert_eq!(market.resolved, true);
    assert_eq!(market.outcome, true);

    let bal_before = token::Client::new(&env, &native_token).balance(&alice);
    client.claim_winnings(&alice, &native_token, &0);
    let bal_after = token::Client::new(&env, &native_token).balance(&alice);
    assert!(bal_after > bal_before, "Winner should receive XLM");

    let after = client.get_market(&0);
    assert_eq!(after.yes_bets.get(0).unwrap().claimed, true);
}

#[test]
#[should_panic(expected = "Already resolved")]
fn test_double_resolve_fails() {
    let env = Env::default();
    let (_, client, native_token) = setup(&env);
    let creator = Address::generate(&env);
    create_market_internal(&client, &creator, "Test", 100);
    env.ledger().set_timestamp(200);
    client.resolve_market(&creator, &native_token, &0, &true);
    client.resolve_market(&creator, &native_token, &0, &false);
}

#[test]
#[should_panic(expected = "Deadline not reached")]
fn test_resolve_before_deadline_fails() {
    let env = Env::default();
    let (_, client, native_token) = setup(&env);
    let creator = Address::generate(&env);
    create_market_internal(&client, &creator, "Test", 9999999999);
    client.resolve_market(&creator, &native_token, &0, &true);
}

#[test]
#[should_panic(expected = "No winning bet found")]
fn test_claim_on_losing_side_fails() {
    let env = Env::default();
    let (_, client, native_token) = setup(&env);
    let creator = Address::generate(&env);
    let bob = Address::generate(&env);

    create_market_internal(&client, &creator, "Test", 100);
    mint(&env, &native_token, &bob, 1000);
    client.place_bet(&bob, &native_token, &0, &false, &300);
    env.ledger().set_timestamp(200);
    client.resolve_market(&creator, &native_token, &0, &true);
    client.claim_winnings(&bob, &native_token, &0);
}

#[test]
#[should_panic(expected = "Already claimed")]
fn test_double_claim_fails() {
    let env = Env::default();
    let (_, client, native_token) = setup(&env);
    let creator = Address::generate(&env);
    let alice = Address::generate(&env);

    create_market_internal(&client, &creator, "Test", 100);
    mint(&env, &native_token, &alice, 1000);
    client.place_bet(&alice, &native_token, &0, &true, &500);
    env.ledger().set_timestamp(200);
    client.resolve_market(&creator, &native_token, &0, &true);
    client.claim_winnings(&alice, &native_token, &0);
    client.claim_winnings(&alice, &native_token, &0);
}

#[test]
fn test_get_markets_returns_all() {
    let env = Env::default();
    let (_, client, _) = setup(&env);
    let creator = Address::generate(&env);

    create_market_internal(&client, &creator, "Market A", 9999999999);
    create_market_internal(&client, &creator, "Market B", 9999999999);

    let markets = client.get_markets();
    assert_eq!(markets.len(), 2);
    assert_eq!(markets.get(0).unwrap().question, String::from_str(&env, "Market A"));
    assert_eq!(markets.get(1).unwrap().question, String::from_str(&env, "Market B"));
}
