#!/bin/bash
RUN=${RUN_DIR:-/tmp/verify-harness}
for p in func front resend pgrst; do [ -f $RUN/$p.pid ] && kill $(cat $RUN/$p.pid) 2>/dev/null; done; exit 0
