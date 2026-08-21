//! Tally round registry — the on-chain half of the completeness story.
//!
//! A disbursement round's aggregate proof asserts a total over a set of
//! confidential transfers. For that total to mean anything, a donor must be
//! able to determine **which transfers belong to the round** from chain state
//! rather than from the funder's say-so. This contract supplies exactly that
//! and nothing more:
//!
//!   * the **lane set** — the sender accounts whose transfers count, and
//!   * the **window** — the ledger range over which they count.
//!
//! The transfers themselves are *not* recorded here. They do not need to be:
//! `Transfer.from` / `Transfer.to` are topic-indexed and emission is
//! unconditional inside `confidential_transfer`, so a donor enumerates the
//! round's transfers directly from chain events and a withheld transfer shows
//! up as a set mismatch. Recording them per-transfer would also be worse than
//! useless — it would reintroduce the very cherry-picking it appears to
//! prevent, since a funder could simply decline to record one.
//!
//! # The constraint this contract exists to enforce
//!
//! **A round's declaration cannot be backdated, extended, or revised after the
//! fact.** Without that, cherry-picking merely moves one level up: run the
//! transfers first, then declare only the lanes that look good. Enforced here
//! as, not documented as:
//!
//! | Constraint | How it is enforced |
//! |:---|:---|
//! | `opened_at` is the true ledger | Stamped from `e.ledger().sequence()`. It is not a parameter, so a caller cannot supply or backdate it. |
//! | The lane set is immutable | Written once in [`open_round`]; no mutator exists on this contract. |
//! | A round is declared once | [`open_round`] rejects a `round_id` that already exists. |
//! | A round closes once, by its funder | [`close_round`] rejects a foreign caller, a missing round, or a second close. |
//! | Lanes are distinct and non-empty | Rejected at declaration; a duplicated lane would let one event be counted twice. |
//!
//! A donor MUST reject any aggregate covering an event whose ledger falls
//! outside `[opened_at, closed_at]`, or whose sender is not in `lanes`. Because
//! both are contract-stamped and immutable, that check is sound against a
//! funder who controls every other input.
//!
//! # What this contract deliberately does not do
//!
//! It cannot observe the token, so it cannot prevent a funder transferring from
//! an **undeclared** account — that limit is inherent and is stated plainly in
//! `docs/TRUST-STATEMENT.md`. What it does guarantee is that the account set
//! and window a donor checks against were fixed before the round ran.
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, BytesN, Env, Vec,
};

/// Upper bound on lanes per round. Fan-out past a handful buys nothing —
/// proof generation, not ledger-close parallelism, is the ceiling — and an
/// unbounded set would make [`is_lane`] cost unbounded.
pub const MAX_LANES: u32 = 64;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Round {
    /// The account that declared the round; the only one that may close it.
    pub funder: Address,
    /// Sender accounts whose transfers count toward this round. Immutable.
    pub lanes: Vec<Address>,
    /// Ledger at declaration, stamped by this contract.
    pub opened_at: u32,
    /// Ledger at close, stamped by this contract. `None` while open.
    pub closed_at: Option<u32>,
}

#[contracttype]
enum DataKey {
    Round(BytesN<32>),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum RegistryError {
    /// `round_id` is already declared. Redeclaring would allow a revised lane set.
    RoundAlreadyExists = 1,
    /// No round is declared under `round_id`.
    RoundNotFound = 2,
    /// The round is already closed; its window is fixed.
    RoundAlreadyClosed = 3,
    /// Only the declaring funder may close a round.
    NotRoundFunder = 4,
    /// A round with no lanes can never contain a transfer.
    EmptyLaneSet = 5,
    /// A duplicated lane would let one transfer be counted twice.
    DuplicateLane = 6,
    /// Lane set exceeds [`MAX_LANES`].
    TooManyLanes = 7,
}

#[contractevent]
pub struct RoundOpened {
    #[topic]
    pub funder: Address,
    #[topic]
    pub round_id: BytesN<32>,
    pub lanes: Vec<Address>,
    pub opened_at: u32,
}

#[contractevent]
pub struct RoundClosed {
    #[topic]
    pub funder: Address,
    #[topic]
    pub round_id: BytesN<32>,
    pub opened_at: u32,
    pub closed_at: u32,
}

#[contract]
pub struct RoundRegistry;

#[contractimpl]
impl RoundRegistry {
    /// Declares a round's lane set, stamping the current ledger as its opening.
    ///
    /// Must be called **before the round's first transfer**. That ordering is
    /// enforced rather than assumed: `opened_at` comes from the ledger, not
    /// from the caller, and the lane set cannot be revised afterwards, so a
    /// transfer made before this call can never be brought inside the window.
    pub fn open_round(
        e: &Env,
        funder: Address,
        round_id: BytesN<32>,
        lanes: Vec<Address>,
    ) -> Round {
        funder.require_auth();

        if lanes.is_empty() {
            panic_with_error(e, RegistryError::EmptyLaneSet);
        }
        if lanes.len() > MAX_LANES {
            panic_with_error(e, RegistryError::TooManyLanes);
        }
        // O(n^2) over a set capped at MAX_LANES, and only at declaration.
        for i in 0..lanes.len() {
            for j in (i + 1)..lanes.len() {
                if lanes.get_unchecked(i) == lanes.get_unchecked(j) {
                    panic_with_error(e, RegistryError::DuplicateLane);
                }
            }
        }

        let key = DataKey::Round(round_id.clone());
        if e.storage().persistent().has(&key) {
            panic_with_error(e, RegistryError::RoundAlreadyExists);
        }

        let round = Round {
            funder: funder.clone(),
            lanes: lanes.clone(),
            opened_at: e.ledger().sequence(),
            closed_at: None,
        };
        e.storage().persistent().set(&key, &round);

        RoundOpened { funder, round_id, lanes, opened_at: round.opened_at }.publish(e);
        round
    }

    /// Closes the round, stamping the current ledger as its end. Idempotence is
    /// deliberately NOT offered: a second close would move the window.
    pub fn close_round(e: &Env, funder: Address, round_id: BytesN<32>) -> Round {
        funder.require_auth();

        let key = DataKey::Round(round_id.clone());
        let mut round: Round = e
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic_with_error(e, RegistryError::RoundNotFound));

        if round.funder != funder {
            panic_with_error(e, RegistryError::NotRoundFunder);
        }
        if round.closed_at.is_some() {
            panic_with_error(e, RegistryError::RoundAlreadyClosed);
        }

        let closed_at = e.ledger().sequence();
        round.closed_at = Some(closed_at);
        e.storage().persistent().set(&key, &round);

        RoundClosed { funder, round_id, opened_at: round.opened_at, closed_at }.publish(e);
        round
    }

    /// The declared round. This is the donor's source of truth for the lane set
    /// and window — never the funder's bundle.
    pub fn get_round(e: &Env, round_id: BytesN<32>) -> Round {
        e.storage()
            .persistent()
            .get(&DataKey::Round(round_id))
            .unwrap_or_else(|| panic_with_error(e, RegistryError::RoundNotFound))
    }

    /// Whether `who` is a declared lane of `round_id`.
    pub fn is_lane(e: &Env, round_id: BytesN<32>, who: Address) -> bool {
        Self::get_round(e, round_id).lanes.contains(&who)
    }
}

fn panic_with_error(e: &Env, err: RegistryError) -> ! {
    soroban_sdk::panic_with_error!(e, err)
}

#[cfg(test)]
mod test;
