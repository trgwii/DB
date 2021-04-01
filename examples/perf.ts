import { DB } from "../db.ts";
import { DateTime, InlineText } from "../types.ts";
import { num } from "../id.ts";

const [path] = Deno.args;

const db = new DB(path, {
  created: new DateTime(),
  updated: new DateTime(),
  username: new InlineText(31),
}, { stringIds: true });

let id = "";

let amount = 0;
setInterval(() => {
  console.log(`${amount} rows / sec`);
  amount = 0;
}, 1000);
while (true) {
  id = await db.insert({
    created: new Date(),
    updated: new Date(),
    username: "Thomas-" + id,
  });
  amount++;
  // const buf = new TextEncoder().encode("\r" + num(id) + " " + id);
  // await Deno.writeAll(Deno.stdout, buf);
}
