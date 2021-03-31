import { DB } from "./db.ts";
import { DateTime, Text } from "./types.ts";
import { num } from "./id.ts";

const [path] = Deno.args;

const db = new DB(path, {
  created: new DateTime(),
  updated: new DateTime(),
  username: new Text(31),
}, { stringIds: true });

let id = "";
while (true) {
  id = await db.insert({
    created: new Date(),
    updated: new Date(),
    username: "Thomas-" + id,
  });
  const buf = new TextEncoder().encode("\r" + num(id) + " " + id);
  await Deno.writeAll(Deno.stdout, buf);
}
