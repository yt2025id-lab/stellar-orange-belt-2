#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env, String, Symbol, Vec,
};

const PROTOCOL_FEE_BPS: i128 = 200;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Bet {
    pub user: Address,
    pub amount: i128,
    pub claimed: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Market {
    pub id: u32,
    pub creator: Address,
    pub question: String,
    pub deadline: u64,
    pub resolved: bool,
    pub outcome: bool,
    pub resolved_at: u64,
    pub yes_pool: i128,
    pub no_pool: i128,
    pub yes_bets: Vec<Bet>,
    pub no_bets: Vec<Bet>,
}

#[contract]
pub struct PredictionMarket;

fn find_and_accumulate(bets: &mut Vec<Bet>, user: &Address, amount: i128) -> bool {
    for i in 0..bets.len() {
        let b = bets.get(i).unwrap();
        if b.user == *user {
            let updated = Bet { user: b.user.clone(), amount: b.amount + amount, claimed: false };
            bets.set(i, updated);
            return true;
        }
    }
    bets.push_back(Bet { user: user.clone(), amount, claimed: false });
    false
}

#[contractimpl]
impl PredictionMarket {
    pub fn __constructor(env: Env) {
        env.storage().instance().set(&Symbol::new(&env, "markets"), &Vec::<Market>::new(&env));
        env.storage().instance().set(&Symbol::new(&env, "count"), &0u32);
    }

    pub fn create_market(env: Env, creator: Address, question: String, deadline: u64) {
        creator.require_auth();

        if question.len() == 0 { panic!("Question cannot be empty"); }
        if deadline <= env.ledger().timestamp() { panic!("Deadline must be in the future"); }

        let count: u32 = env.storage().instance().get(&Symbol::new(&env, "count")).unwrap_or(0);
        let market = Market {
            id: count,
            creator,
            question,
            deadline,
            resolved: false,
            outcome: false,
            resolved_at: 0,
            yes_pool: 0,
            no_pool: 0,
            yes_bets: Vec::new(&env),
            no_bets: Vec::new(&env),
        };

        let mut markets: Vec<Market> = env.storage().instance()
            .get(&Symbol::new(&env, "markets"))
            .unwrap_or(Vec::new(&env));
        markets.push_back(market);
        env.storage().instance().set(&Symbol::new(&env, "markets"), &markets);
        env.storage().instance().set(&Symbol::new(&env, "count"), &(count + 1));

        env.events().publish(
            (Symbol::new(&env, "market_created"), Symbol::new(&env, "created")),
            count,
        );
    }

    pub fn place_bet(
        env: Env,
        user: Address,
        native_token: Address,
        market_id: u32,
        side: bool,
        amount: i128,
    ) {
        user.require_auth();

        if amount <= 0 { panic!("Amount must be greater than 0"); }

        let mut markets: Vec<Market> = env.storage().instance()
            .get(&Symbol::new(&env, "markets"))
            .unwrap_or(Vec::new(&env));

        if market_id >= markets.len() { panic!("Market not found"); }
        let market = markets.get(market_id).unwrap();

        if market.resolved { panic!("Market already resolved"); }
        if env.ledger().timestamp() > market.deadline { panic!("Deadline passed"); }

        let token_client = token::Client::new(&env, &native_token);
        token_client.transfer(&user, &env.current_contract_address(), &amount);

        let mut m = Market {
            id: market.id,
            creator: market.creator.clone(),
            question: market.question.clone(),
            deadline: market.deadline,
            resolved: market.resolved,
            outcome: market.outcome,
            resolved_at: market.resolved_at,
            yes_pool: market.yes_pool,
            no_pool: market.no_pool,
            yes_bets: market.yes_bets.clone(),
            no_bets: market.no_bets.clone(),
        };

        if side {
            find_and_accumulate(&mut m.yes_bets, &user, amount);
            m.yes_pool += amount;
        } else {
            find_and_accumulate(&mut m.no_bets, &user, amount);
            m.no_pool += amount;
        }

        markets.set(market_id, m);
        env.storage().instance().set(&Symbol::new(&env, "markets"), &markets);

        env.events().publish(
            (Symbol::new(&env, "bet_placed"), Symbol::new(&env, "placed")),
            (market_id, side, amount),
        );
    }

    pub fn resolve_market(
        env: Env,
        creator: Address,
        native_token: Address,
        market_id: u32,
        outcome: bool,
    ) {
        creator.require_auth();

        let mut markets: Vec<Market> = env.storage().instance()
            .get(&Symbol::new(&env, "markets"))
            .unwrap_or(Vec::new(&env));

        if market_id >= markets.len() { panic!("Market not found"); }
        let market = markets.get(market_id).unwrap();

        if creator != market.creator { panic!("Only creator can resolve"); }
        if market.resolved { panic!("Already resolved"); }
        if env.ledger().timestamp() < market.deadline { panic!("Deadline not reached"); }

        let losing_pool = if outcome { market.no_pool } else { market.yes_pool };
        let fee = losing_pool * PROTOCOL_FEE_BPS / 10_000;

        let updated = Market {
            id: market.id,
            creator: market.creator.clone(),
            question: market.question.clone(),
            deadline: market.deadline,
            resolved: true,
            outcome,
            resolved_at: env.ledger().timestamp(),
            yes_pool: market.yes_pool,
            no_pool: market.no_pool,
            yes_bets: market.yes_bets.clone(),
            no_bets: market.no_bets.clone(),
        };

        if fee > 0 {
            let token_client = token::Client::new(&env, &native_token);
            token_client.transfer(&env.current_contract_address(), &creator, &fee);
        }

        markets.set(market_id, updated);
        env.storage().instance().set(&Symbol::new(&env, "markets"), &markets);

        env.events().publish(
            (Symbol::new(&env, "market_resolved"), Symbol::new(&env, "resolved")),
            (market_id, outcome),
        );
    }

    pub fn claim_winnings(
        env: Env,
        user: Address,
        native_token: Address,
        market_id: u32,
    ) {
        user.require_auth();

        let mut markets: Vec<Market> = env.storage().instance()
            .get(&Symbol::new(&env, "markets"))
            .unwrap_or(Vec::new(&env));

        if market_id >= markets.len() { panic!("Market not found"); }
        let market = markets.get(market_id).unwrap();

        if !market.resolved { panic!("Not resolved"); }

        let (winning_pool, losing_pool, winning_side_yes) = if market.outcome {
            (market.yes_pool, market.no_pool, true)
        } else {
            (market.no_pool, market.yes_pool, false)
        };

        let fee = losing_pool * PROTOCOL_FEE_BPS / 10_000;
        let distributable = losing_pool - fee;

        let mut reward: i128 = 0;
        let mut updated_market = Market {
            id: market.id,
            creator: market.creator.clone(),
            question: market.question.clone(),
            deadline: market.deadline,
            resolved: market.resolved,
            outcome: market.outcome,
            resolved_at: market.resolved_at,
            yes_pool: market.yes_pool,
            no_pool: market.no_pool,
            yes_bets: market.yes_bets.clone(),
            no_bets: market.no_bets.clone(),
        };

        let side_bets = if winning_side_yes { &mut updated_market.yes_bets } else { &mut updated_market.no_bets };
        let found = find_and_claim(side_bets, &user, winning_pool, distributable, &mut reward);

        if !found { panic!("No winning bet found"); }
        if reward <= 0 { panic!("Nothing to claim"); }

        markets.set(market_id, updated_market);
        env.storage().instance().set(&Symbol::new(&env, "markets"), &markets);

        let token_client = token::Client::new(&env, &native_token);
        token_client.transfer(&env.current_contract_address(), &user, &reward);

        env.events().publish(
            (Symbol::new(&env, "winnings_claimed"), Symbol::new(&env, "claimed")),
            (market_id, user, reward),
        );
    }

    pub fn get_market(env: Env, market_id: u32) -> Market {
        let markets: Vec<Market> = env.storage().instance()
            .get(&Symbol::new(&env, "markets"))
            .unwrap_or(Vec::new(&env));
        if market_id >= markets.len() { panic!("Market not found"); }
        markets.get(market_id).unwrap()
    }

    pub fn get_markets(env: Env) -> Vec<Market> {
        env.storage().instance()
            .get(&Symbol::new(&env, "markets"))
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_market_count(env: Env) -> u32 {
        env.storage().instance()
            .get(&Symbol::new(&env, "count"))
            .unwrap_or(0)
    }
}

fn find_and_claim(
    bets: &mut Vec<Bet>,
    user: &Address,
    winning_pool: i128,
    distributable: i128,
    reward: &mut i128,
) -> bool {
    for i in 0..bets.len() {
        let b = bets.get(i).unwrap();
        if b.user == *user {
            if b.claimed { panic!("Already claimed"); }
            if winning_pool > 0 {
                *reward = b.amount + (distributable * b.amount) / winning_pool;
            } else {
                *reward = b.amount;
            }
            let updated = Bet { user: b.user.clone(), amount: b.amount, claimed: true };
            bets.set(i, updated);
            return true;
        }
    }
    false
}

mod test;
