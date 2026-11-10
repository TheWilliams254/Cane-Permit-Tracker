#!/bin/sh
su postgres -c "psql -h /tmp/pg -p 5433 -c 'drop database cpt' -c 'create database cpt'" >/dev/null && npx drizzle-kit migrate >/dev/null 2>&1 && npx tsx scripts/seed.ts | tail -1
