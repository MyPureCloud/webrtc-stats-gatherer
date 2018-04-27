#!/bin/bash

./node_modules/.bin/istanbul check-coverage --branches 75 --lines 85 --functions 85 coverage/coverage.raw.json
