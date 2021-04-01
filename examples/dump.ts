import { getNBytes, sizeof, varbig, varnum } from "../binary.ts";

const [path] = Deno.args;

const file = await Deno.open(path);
let eof = false;
while (!eof) {
  try {
    const bytes = await getNBytes(file, 272);
    const id = varbig(bytes.subarray(0, 8), { dataType: "uint64" });
    const date = new Date(Number(varbig(
      bytes.subarray(8, 16),
      { dataType: "int64" },
    )));
    const len = varnum(bytes.subarray(16, 17), { dataType: "uint8" });
    if (len == null) {
      throw new TypeError("no length");
    }
    const stringBytes = bytes.subarray(17, 17 + len);
    console.log({
      id,
      created: date,
      username: new TextDecoder().decode(stringBytes),
    });
  } catch (err) {
    console.error(err.message);
    eof = true;
  }
}
