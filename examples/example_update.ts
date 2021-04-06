import { DB } from "../db.ts";
import { Num, InlineText } from "../types.ts";
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

console.log('Input:')

for await (const row of users.all({})) {
  console.log(row);
}

const updated = await users.update({ username: 'Jake' }, { username: 'Thomas' })

console.log(`Updated ${updated.length} documents:`)

for await (const row of users.all({ username: 'Thomas' })) {
  console.log(row);
}

const updatedOnce = await users.updateOne({ username: 'Thomas' }, { username: 'Jake' })

console.log(`Updated document. ID: ${updatedOnce}:`)

const user = await users.one({ username: 'Jake' })

console.log(user)

console.log('Results:')

for await (const row of users.all({})) {
  console.log(row);
}