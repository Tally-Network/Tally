//! Negative tests first — every constraint this contract claims to enforce has
//! a test that proves it rejects the violation, not merely a test that the
//! happy path works. The floor bug in the aggregate circuit family was caught
//! by a negative test rather than by reasoning; this suite is written on that
//! assumption.

extern crate std;

use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    vec, Address, BytesN, Env, Vec,
};

use crate::{RegistryError, Round, RoundRegistry, RoundRegistryClient, MAX_LANES};

fn setup(e: &Env) -> RoundRegistryClient<'_> {
    e.mock_all_auths();
    RoundRegistryClient::new(e, &e.register(RoundRegistry, ()))
}

fn rid(e: &Env, b: u8) -> BytesN<32> {
    BytesN::from_array(e, &[b; 32])
}

fn lanes(e: &Env, n: u32) -> Vec<Address> {
    let mut v = Vec::new(e);
    for _ in 0..n {
        v.push_back(Address::generate(e));
    }
    v
}

// ---------------------------------------------------------------------------
// NEGATIVE — the declaration cannot be revised after the fact
// ---------------------------------------------------------------------------

#[test]
fn rejects_redeclaring_a_round() {
    // The core cherry-picking defence: if a round_id could be reopened, a
    // funder could run the transfers and then swap in a flattering lane set.
    let e = Env::default();
    let c = setup(&e);
    let f = Address::generate(&e);
    c.open_round(&f, &rid(&e, 1), &lanes(&e, 3));

    let err = c.try_open_round(&f, &rid(&e, 1), &lanes(&e, 2));
    assert_eq!(err, Err(Ok(RegistryError::RoundAlreadyExists.into())));
}

#[test]
fn rejects_redeclaring_even_by_a_different_funder() {
    let e = Env::default();
    let c = setup(&e);
    c.open_round(&Address::generate(&e), &rid(&e, 1), &lanes(&e, 2));

    let err = c.try_open_round(&Address::generate(&e), &rid(&e, 1), &lanes(&e, 2));
    assert_eq!(err, Err(Ok(RegistryError::RoundAlreadyExists.into())));
}

#[test]
fn rejects_duplicate_lanes() {
    // A duplicated lane would let one transfer be counted twice by a verifier
    // that trusts the declared set.
    let e = Env::default();
    let c = setup(&e);
    let dup = Address::generate(&e);
    let set = vec![&e, dup.clone(), Address::generate(&e), dup];

    let err = c.try_open_round(&Address::generate(&e), &rid(&e, 1), &set);
    assert_eq!(err, Err(Ok(RegistryError::DuplicateLane.into())));
}

#[test]
fn rejects_empty_lane_set() {
    let e = Env::default();
    let c = setup(&e);
    let err = c.try_open_round(&Address::generate(&e), &rid(&e, 1), &Vec::new(&e));
    assert_eq!(err, Err(Ok(RegistryError::EmptyLaneSet.into())));
}

#[test]
fn rejects_lane_set_over_the_cap() {
    let e = Env::default();
    let c = setup(&e);
    let err = c.try_open_round(&Address::generate(&e), &rid(&e, 1), &lanes(&e, MAX_LANES + 1));
    assert_eq!(err, Err(Ok(RegistryError::TooManyLanes.into())));
}

// ---------------------------------------------------------------------------
// NEGATIVE — the window cannot be moved
// ---------------------------------------------------------------------------

#[test]
fn rejects_closing_twice() {
    // A second close would extend the window and pull later transfers in.
    let e = Env::default();
    let c = setup(&e);
    let f = Address::generate(&e);
    c.open_round(&f, &rid(&e, 1), &lanes(&e, 2));
    c.close_round(&f, &rid(&e, 1));

    let err = c.try_close_round(&f, &rid(&e, 1));
    assert_eq!(err, Err(Ok(RegistryError::RoundAlreadyClosed.into())));
}

#[test]
fn rejects_closing_a_round_that_was_never_opened() {
    let e = Env::default();
    let c = setup(&e);
    let err = c.try_close_round(&Address::generate(&e), &rid(&e, 9));
    assert_eq!(err, Err(Ok(RegistryError::RoundNotFound.into())));
}

#[test]
fn rejects_closing_by_a_non_funder() {
    let e = Env::default();
    let c = setup(&e);
    let funder = Address::generate(&e);
    c.open_round(&funder, &rid(&e, 1), &lanes(&e, 2));

    let err = c.try_close_round(&Address::generate(&e), &rid(&e, 1));
    assert_eq!(err, Err(Ok(RegistryError::NotRoundFunder.into())));
}

#[test]
fn rejects_reading_an_unknown_round() {
    let e = Env::default();
    let c = setup(&e);
    assert_eq!(c.try_get_round(&rid(&e, 7)), Err(Ok(RegistryError::RoundNotFound.into())));
}

// ---------------------------------------------------------------------------
// The enforced ordering: opened_at is stamped, never supplied
// ---------------------------------------------------------------------------

#[test]
fn opened_at_is_the_true_ledger_and_not_caller_supplied() {
    // `opened_at` is not a parameter of open_round — there is no way to pass
    // one. This pins that it tracks the ledger, which is what makes a donor's
    // "event.ledger >= opened_at" check sound against a hostile funder.
    let e = Env::default();
    let c = setup(&e);
    let f = Address::generate(&e);

    e.ledger().set_sequence_number(1000);
    let a = c.open_round(&f, &rid(&e, 1), &lanes(&e, 2));
    assert_eq!(a.opened_at, 1000);
    assert_eq!(a.closed_at, None);

    e.ledger().set_sequence_number(2500);
    let b = c.open_round(&f, &rid(&e, 2), &lanes(&e, 2));
    assert_eq!(b.opened_at, 2500);

    // A round declared later cannot claim an earlier opening.
    assert!(b.opened_at > a.opened_at);
}

#[test]
fn window_is_stamped_at_both_ends() {
    let e = Env::default();
    let c = setup(&e);
    let f = Address::generate(&e);

    e.ledger().set_sequence_number(500);
    c.open_round(&f, &rid(&e, 1), &lanes(&e, 3));

    e.ledger().set_sequence_number(900);
    let closed = c.close_round(&f, &rid(&e, 1));

    assert_eq!(closed.opened_at, 500);
    assert_eq!(closed.closed_at, Some(900));
    // Any event outside [500, 900] is out of the round by construction.
}

// ---------------------------------------------------------------------------
// Happy path + read surface
// ---------------------------------------------------------------------------

#[test]
fn declares_and_reads_back_the_lane_set() {
    let e = Env::default();
    let c = setup(&e);
    let f = Address::generate(&e);
    let set = lanes(&e, 5);

    let r: Round = c.open_round(&f, &rid(&e, 1), &set);
    assert_eq!(r.funder, f);
    assert_eq!(r.lanes, set);

    let read = c.get_round(&rid(&e, 1));
    assert_eq!(read, r);
    assert_eq!(read.lanes.len(), 5);
}

#[test]
fn is_lane_discriminates_declared_from_undeclared() {
    let e = Env::default();
    let c = setup(&e);
    let set = lanes(&e, 3);
    c.open_round(&Address::generate(&e), &rid(&e, 1), &set);

    assert!(c.is_lane(&rid(&e, 1), &set.get_unchecked(0)));
    assert!(c.is_lane(&rid(&e, 1), &set.get_unchecked(2)));
    // An account the funder never declared is outside the round — this is the
    // inherent limit recorded in docs/TRUST-STATEMENT.md, made explicit here.
    assert!(!c.is_lane(&rid(&e, 1), &Address::generate(&e)));
}

#[test]
fn rounds_are_independent() {
    let e = Env::default();
    let c = setup(&e);
    let f = Address::generate(&e);
    let a = lanes(&e, 2);
    let b = lanes(&e, 3);
    c.open_round(&f, &rid(&e, 1), &a);
    c.open_round(&f, &rid(&e, 2), &b);

    assert_eq!(c.get_round(&rid(&e, 1)).lanes, a);
    assert_eq!(c.get_round(&rid(&e, 2)).lanes, b);
    c.close_round(&f, &rid(&e, 1));
    assert!(c.get_round(&rid(&e, 1)).closed_at.is_some());
    assert!(c.get_round(&rid(&e, 2)).closed_at.is_none());
}

#[test]
fn max_lanes_exactly_is_accepted() {
    let e = Env::default();
    let c = setup(&e);
    let r = c.open_round(&Address::generate(&e), &rid(&e, 1), &lanes(&e, MAX_LANES));
    assert_eq!(r.lanes.len(), MAX_LANES);
}
