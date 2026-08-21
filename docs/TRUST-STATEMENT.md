# Tally — Trust Statement

Two sentences. They ship verbatim to the landing page and the SCF submission. Nothing else in Tally's public material may state the guarantee more strongly than this.

---

> **The donor is assured that** the confidential transfers sent from the lane accounts Tally declared on-chain before the round opened, within that round's declared ledger window, total exactly the disclosed amount and that none has been withheld — because every confidential transfer publishes its sender address on-chain whether or not the funder chooses to disclose it, so an omitted transfer is visible as one the proof fails to cover.
>
> **This does not assure** that the funder made no other payments, nor that the recipients are independent of the funder: the guarantee is scoped to transfers from the accounts declared before the round, **not to the funder's total spend**, and it establishes what amounts moved, not who ultimately controls the accounts that received them.

---

## Why it is worded this way

**The scope is a declared account set, not the funder.** These are different claims and only the first is true. A funder can operate confidential accounts Tally never declared; transfers from them are outside the proof and are not detectable from it.

**An earlier draft said this was "bounded by deposits being public." That overstated it and has been removed.** Public deposits let a donor audit money flowing *out of a pool they already know about* — they do not reveal that some unrelated address is a lane. A lane funded out of band from a source with no visible link to the declared pool is not visible as a lane at all. Deposit transparency constrains a *declared* pool; it does not make the account set self-discovering.

**Completeness within the declared set is real, and does not depend on the funder cooperating.** `Transfer.from` and `Transfer.to` are topic-indexed and emission is unconditional inside `confidential_transfer` — there is no code path that moves confidential value without publishing the sender. So the donor enumerates the round's transfers from chain state directly, and a withheld transfer surfaces as a set mismatch rather than as a smaller total.

**The window is what stops retroactive cherry-picking.** `open_round` stamps its ledger from the contract, not from the caller, and the lane set is immutable once written. Without that, a funder could run the round first and declare only the flattering lanes afterwards — the same cherry-picking one level up.

**Recipient independence is a separate, unsolved thing.** A funder paying accounts it controls and counting them inflates the apparent disbursement. No amount-hiding primitive can settle this; it needs recipient attestation, which is out of MVP scope. Sentence 2 says so rather than leaving it implied.

## Rules for public copy

- Never write "provably disbursed X" without the scope. Write "provably disbursed X from the declared lanes in round R."
- Never imply the total covers the funder's whole programme.
- Never claim recipient identity or independence is verified.
- If a claim cannot be traced to sentence 1, it does not ship.
