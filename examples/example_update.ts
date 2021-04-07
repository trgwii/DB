import { DB } from "../db.ts";
import { Num, InlineText } from "../types.ts";
import * as Colors from 'https://deno.land/std/fmt/colors.ts'
const users = new DB("users", {
  age: new Num("uint32"),
  username: new InlineText(255)
}, { stringIds: false });

if (await Deno.stat("users/data.db").then(() => false, () => true)) {
  await users.insert({
    age: 22,
    username: "Miguel"
  });
  
  await users.insert({
    age: 23,
    username: "Lol"
  });

  await users.insert({
    age: 30,
    username: "Jake",
  });

  await users.insert({
    age: 26,
    username: "Jake",
  });

}

console.log(Colors.blue('Input:'))

for await (const row of users.all({})) {
  console.log(row);
}

console.log(Colors.blue('Updating multiple usernames of collection from "Jake" to "Thomas":'))

let updated = 0;
for await (const id of users.update({ username: 'Jake' }, { username: 'Thomas' })) {
  updated += 1
  console.log(Colors.green(`Updated document - ID: ${id}`))
}

for await (const row of users.all({ username: 'Thomas' })) {
  console.log(row);
}

console.log(Colors.green(`Updated ${updated} documents.`))

console.log(Colors.blue('Updating one username of collection from "Thomas" to: "Jake":'))

const updatedOnce = await users.updateOne({ username: 'Thomas' }, { username: 'Jake' })

const user = await users.one({ username: 'Jake' })

console.log(user)

console.log(Colors.green(`Updated document - ID: ${updatedOnce}:`))

console.log(Colors.blue('Output:'))

for await (const row of users.all({})) {
  console.log(row);
}