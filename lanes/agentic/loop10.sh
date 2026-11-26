#!/usr/bin/env bash
cd "$(dirname "$0")"
for i in $(seq 1 10); do OUT=results/run-$i.json ./go.sh > results/run-$i.log 2>&1; echo "run $i exit $?" >> results/loop.log; done
echo DONE >> results/loop.log
