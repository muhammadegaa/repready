import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

const file = process.env.DB_PATH ?? path.join(process.cwd(), "data", "app.db");
if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });

const db = new DatabaseSync(file);
db.exec("pragma busy_timeout = 5000");
db.exec(`
  create table if not exists athlete (
    id integer primary key,
    name text not null,
    code text unique not null,
    consented_at text
  );
  create table if not exists session (
    id integer primary key,
    on_date text not null,
    label text not null,
    week_type text not null default 'normal',
    exercises text not null
  );
  create table if not exists checkin (
    athlete_id integer not null,
    on_date text not null,
    sleep_h real not null,
    soreness integer not null,
    stress integer not null,
    note text,
    primary key (athlete_id, on_date)
  );
  create table if not exists session_log (
    athlete_id integer not null,
    on_date text not null,
    rpe real not null,
    primary key (athlete_id, on_date)
  );
  create table if not exists notice (
    k text primary key,
    v text not null
  );
  create table if not exists proposal (
    id integer primary key,
    athlete_id integer not null,
    session_id integer not null,
    on_date text not null,
    decision text,
    edits text not null default '[]',
    reason text,
    rules_applied text not null default '[]',
    flag text,
    status text not null,
    error text,
    created_at text not null,
    decided_at text,
    unique (athlete_id, on_date)
  );
`);

export default db;
