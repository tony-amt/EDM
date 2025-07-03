#!/bin/sh
export NODE_ENV=test
export DB_NAME=amt_mail_test
npx jest test/unit --runInBand
npx jest test/integration --runInBand
npx jest --coverage
