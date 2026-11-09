import { promises as fs } from "fs";
import path from "path";
import type { Db } from "./types";

/**
 * 프로토타입용 JSON 파일 저장소. 데이터는 이 컴퓨터의 data/db.json 에만 저장된다.
 * 배포할 때는 이 파일만 Supabase/Postgres 같은 DB로 바꾸면 된다.
 */
const DB_PATH = path.join(process.cwd(), "data", "db.json");

let queue: Promise<unknown> = Promise.resolve();

async function read(): Promise<Db> {
  try {
    return JSON.parse(await fs.readFile(DB_PATH, "utf8")) as Db;
  } catch {
    return { persons: [], sessions: [] };
  }
}

export async function getDb(): Promise<Db> {
  await queue;
  return read();
}

/** 읽기-수정-쓰기를 순서대로 실행해서 동시 요청이 서로 덮어쓰지 않게 한다. */
export function updateDb<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await read();
    const result = await fn(db);
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export function newId(): string {
  return crypto.randomUUID();
}
