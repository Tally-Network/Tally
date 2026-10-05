# History rewrite, 2026-10-05

The commit "feat(demo): reproducible round" (originally `83f3f8c`, 2026-08-21) committed a demo auditor secret key in `demo/deployment.testnet.json`. The key was demo-only and is retired (see the README). On 2026-10-05 the value was replaced in every historical blob with `REDACTED-retired-demo-auditor-key` using `git filter-repo --replace-text`. No other content changed, but every commit from that one onward has a new id.

Copies of the old history may persist outside this repository (forks, caches, earlier clones). Removing the value from history reduces exposure; it does not un-publish it. Rotation, not the rewrite, is what made the exposure harmless.

| Old id | New id | Subject |
|:---|:---|:---|
| `0361aa9` | `7d09555` | docs: reshape U2 around canonical archives, not an indexer we run |
| `0851858` | `4f4aa32` | docs: Grainlify round sizing + cryptographic accuracy pass |
| `1591f76` | `8855745` | feat(site): landing page — evidence-led, no invented data |
| `2b690cf` | `7fa6168` | docs(registration): state the tested/untested boundary explicitly |
| `2b9f836` | `c4459c3` | docs: sketch the alternative target-4 shape (not scoped, not started) |
| `3358db3` | `0c5c4d5` | docs: non-custodial registration is a schedule constraint, not a crypto one |
| `5009851` | `f29b6bf` | docs: correct §4 demonstration status — target 4 is NOT covered |
| `58d8b1d` | `c0cc50a` | feat(evidence): publish a round an independent party can verify |
| `5be76cf` | `65dab6c` | chore: repoint to Tally-Network after repo transfer |
| `61996ea` | `33db54a` | Refer to the exposed-key commit by subject ahead of the history rewrite |
| `686537d` | `77153ee` | Add a secret guard to the build and CI |
| `7f1ac5c` | `05f5c1c` | feat(evidence): detect retention expiry, make the pack refreshable |
| `83f3f8c` | `b2dfe46` | feat(demo): reproducible round — open, run, close, donor-verify |
| `87ccc54` | `7ef4553` | fix: re-measure zk figures, retract address claim, correct Grainlify framing |
| `bfddacd` | `9c09e58` | feat(registration): non-custodial registration core, spec-compliant and tested |
| `c00737d` | `da3fb7b` | Port to OpenZeppelin stellar-contracts v0.9.0 and redeploy on testnet |
| `c129eb3` | `6633f2e` | chore: submission-ready — site deployed, evidence refreshed, target 2 covered |
| `c619323` | `f0edd20` | ci: deploy the site to GitHub Pages |
| `c77f687` | `f9fea70` | Re-measure under protocol 29 and correct every changed claim |
| `eac40bc` | `2c7d09e` | Refresh the published round from a clean clone |
| `fa48bee` | `c3cf305` | fix: disclosure proofs must be ZERO-KNOWLEDGE — they were not |
| `fb54fb9` | `7ad0b0f` | feat(cli): standalone tally verify — makes the donor assurance real |
