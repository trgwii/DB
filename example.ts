import { DB } from "./db.ts";
import { Big, DateTime, Text } from "./types.ts";

const [path] = Deno.args;

const db = new DB(path, {
  created: new DateTime(),
  username: new Text(255),
}, { stringIds: false });

const firstRun = await Deno.stat(path).then(() => false, () => true);
if (firstRun) {
  await db.insert({
    created: new Date(),
    username: "Thomas",
  });

  await db.insert({
    created: new Date(),
    username: "Miguel",
  });

  console.time("100k inserts");
  for (let i = 3; i < 100000; i++) {
    await db.insert({
      created: new Date(),
      username: "Fart-" + i,
    });
  }
  console.timeEnd("100k inserts");
}

console.time("date search");
for await (
  const row of db.all({
    created: new Date("2021-03-30T22:18:16.659Z"),
  })
) {
  console.log("date search: got", row);
}
console.timeEnd("date search");

console.time("username search");
for await (const row of db.all({ username: "Miguel" })) {
  console.log("username search: got", row);
}
console.timeEnd("username search");

console.time("username search 2");
for await (const row of db.all({ username: "Fart-9998" })) {
  console.log(row);
}
console.timeEnd("username search 2");

console.time("fetch row");
console.log(await db.byId(2));
console.log(await db.byId(99));
console.timeEnd("fetch row");
