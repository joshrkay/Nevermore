# Some open items are not in the advisor queue's count

Three kinds of **open item** added by Epic K are listed for the prospect in Review and in the packet but left out of the advisor queue's open-item count: a fact PEOs ask of every employee that people on the census lack, employees with no workers' comp class code, and a state of operation with no unemployment tax rate. The queue already left out a missing census for the same reason: these are things the prospect uploads or adds, not answers waiting on a confirmation, and none blocks certification.

Counting them would have changed the queue's database function and added up to five open items to every existing submission with a census on the day it shipped, burying the count advisors sort by. The cost of not counting them is that an advisor can't see from the queue that a census lacks gender or a state has no rate; they see it in the packet's open items.

This is cheap to reverse: add the three to `public.advisor_list_submissions` and to the fixture both sides are tested against (`supabase/tests/fixtures/open_items.json`).
