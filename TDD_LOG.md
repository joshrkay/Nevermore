# TDD log: slice 6.6b, the bundle link (M-2.1, ADR 0003, D-609, D-640 to D-649)

One test per cycle: the test, the failing line seen, then green once only the code for it was written.

1. `bundle_links` 1, an advisor issues a link (id, 43-character token, expires_at, version): `ERROR:  function public.issue_bundle_link(bigint, integer, uuid, jsonb) does not exist`. green
2. `bundle_links` 2, only the token's hash is kept and the link expires 30 days after issue: passed on its first run (cycle 1's code already did it); kept as a guard, not counted as a red.
3. `bundle_links` 3, issuing again revokes the earlier link as replaced: `ERROR:  FAIL: the earlier link is revoked as replaced gave <NULL>, expected replaced`. green
4. `bundle_links` 4, another firm's quote request is not found and no link is made: `ERROR:  FAIL: another firm's quote request gave ok, expected PT404`. green
5. `bundle_links` 5, a closed quote request gets no link: `ERROR:  FAIL: a closed quote request gave ok, expected 22023`. green
6. `bundle_links` 6, a version never certified (or none) gets no link: `ERROR:  FAIL: version 2, never certified gave ok, expected 22023`. green
7. `bundle_links` 7, a closing firm issues no link (assert_firm_writable): `ERROR:  FAIL: a closing firm gave ok, expected PT423`. green
8. `bundle_links` 8, a PEO the employer has not authorized gets no link (peo_authorized): `ERROR:  FAIL: a PEO without the employer's authorization gave ok, expected 42501`. green
9. `bundle_links` 9, a link names only documents of its own intake that passed their scan: `ERROR:  FAIL: another intake's document gave ok, expected 22023`. green
10. `bundle_links` 10, what a link's list of files must be (no slash, not empty, a list, a name and what it is; open items a list): `ERROR:  FAIL: a name with a slash gave ok, expected 22023`. green
11. `bundle_links` 11, issuing and the replaced link are on the quote request's timeline, by the advisor, never the token: `ERROR:  FAIL: issued, replaced, issued gave <NULL>, expected Issued for version 1 | Revoked: replaced | Issued for version 1`. green
12. `bundle_links` 12, bundle_link_revoke revokes the live link with its reason, answers 0 or 1, refuses an unknown reason, and no API role may call it: `ERROR:  function public.bundle_link_revoke(bigint, unknown) does not exist`. green
13. `bundle_links` 13, revoke_bundle_link: the advisor revokes their own firm's link (revoked_by_advisor, on the timeline); another firm's member: not found; a closing firm: PT423: `ERROR:  FAIL: another firm's member gave 42883, expected PT404`. green
14. `bundle_links` 14, opening a live link answers the employer as certified, File ID, version, PEO, expiry, numbered files, open items, and never the intake id or folder: `ERROR:  function public.bundle_link_open(text, text) does not exist`. green
15. `bundle_links` 15, an expired, revoked or unknown link answers only {"state": "gone"}: `ERROR:  FAIL: expired gave {"peo": "Oasis", ... "state": "open", ...}, expected {"state": "gone"}`. green
16. `bundle_links` 16, a live link of a PEO the employer no longer authorizes is gone: `ERROR:  FAIL: withdrawn gave {"peo": "Insperity", ... "state": "open", ...}, expected {"state": "gone"}`. green
17. `bundle_links` 17, guessing: 20 misses an hour per address hash, then refused for the hour (a live link too), other addresses and a live link's own use unaffected: `ERROR:  FAIL: after 20 misses the address is refused, even a live link gave open, expected refused`. green
18. `bundle_links` 18, downloading a made file answers its place in the link's folder and puts "<what> (<name>)" on the timeline with no person: `ERROR:  function public.bundle_link_file(text, integer, text) does not exist`. green
19. `bundle_links` 19, a document is named, not copied: its download is found in the documents bucket where the intake keeps it: `ERROR:  FAIL: the document, where the intake keeps it gave {... "bucket": "bundle-links"}, expected {... "bucket": "documents"}`. green
20. `bundle_links` 20, a download from a link that does not open (unknown, expired, revoked, no such file, over the limit, PEO withdrawn) gives nothing and logs nothing; the bad tokens are misses: `ERROR:  null value in column "quote_request_id" of relation "quote_request_events" violates not-null constraint`. green
21. `bundle_links` 21, a document that no longer passes its scan is not served or logged: `ERROR:  FAIL: an infected document gave {... "bucket": "documents"}, expected <NULL>`. green
22. `bundle_links` 22, both tables are closed to anon, authenticated and service_role, with row security on: `ERROR:  FAIL: anon on public.bundle_links gave t, expected f`. green (test 20 then read the hashes before switching to the service role)
23. `bundle_links` 23, the private bucket bundle-links takes a file only under the caller's own firm's quote request and a folder, never from a closing firm, and reads none back: `ERROR:  FAIL: the bucket is private gave <NULL>, expected f`. green
24. `bundle_links` 24, a link's files are listed by intake_stored_files, so they are deleted with the intake (and not another intake's): `ERROR:  FAIL: the intake's own link files, and not another's gave <NULL>, expected 1/.../1-packet.pdf`. green
