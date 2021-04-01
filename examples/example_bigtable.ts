import { DB } from "../db.ts";
import { DateTime, InlineText } from "../types.ts";

const [path] = Deno.args;

const db = new DB(path, {
  created: new DateTime(),
  username: new InlineText(23),
}, { stringIds: false });

console.log("creating big table");
for (let i = 0; i < 1_000_000; i++) {
  await db.insert({
    created: new Date(),
    username: "Thomas-" + i,
  });
  if (i % 10_000 === 0) {
    console.log("creating big table: " + i);
  }
}

console.log("searching big table");
console.time("big table search time");
const row = await db.one({ username: "Thomas-500000" });
console.log(row);
console.timeEnd("big table search time");
