#!/usr/bin/env bash
set -e
cd /home/eloy/test0101/espaciokooplagunak/.worktrees/t_6c580159
node --experimental-test-coverage --test foundry-module/tests/station-handover.test.mjs
