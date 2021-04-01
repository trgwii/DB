import { DB } from "../db.ts";
import { Binary, Num, Text } from "../types.ts";
import { readerFromBuffer } from "https://raw.githubusercontent.com/trgwii/bundler/master/readerFromBuffer.ts";

const pastebin = new DB("pastes", {
  id: new Num("uint32"),
  preview: new Text("pastes/preview"),
  data: new Binary("pastes/data"),
}, { stringIds: false });

if (await Deno.stat("pastes/data.db").then(() => false, () => true)) {
  await pastebin.insert({
    id: 1,
    preview: "Poopy",
    data: readerFromBuffer(new TextEncoder().encode("Poopy butthole lol")),
  });

  await pastebin.insert({
    id: 2,
    preview: "MEEMEE",
    data: readerFromBuffer(new TextEncoder().encode("MEEMEE butthole lol")),
  });
}

for await (const row of pastebin.all({})) {
  console.log(row);
}
