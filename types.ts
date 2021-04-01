import { encode } from "https://deno.land/std@0.91.0/encoding/base64url.ts";
import { ensureDir } from "https://deno.land/std@0.91.0/fs/ensure_dir.ts";
import { readerFromBuffer } from "https://raw.githubusercontent.com/trgwii/bundler/master/readerFromBuffer.ts";
import { createHash } from "https://deno.land/std@0.91.0/hash/mod.ts";

import {
  getNBytes,
  putVarbig,
  putVarnum,
  readVarbig,
  readVarnum,
  sizeof,
  varbig,
  VarbigOptions,
  varnum,
  VarnumOptions,
} from "./binary.ts";

export interface Field<T = unknown> {
  size(): number;
  pack(value: T, buf: Uint8Array): Promise<number>;
  unpack(buf: Uint8Array): Promise<T>;
  read(r: Deno.Reader): Promise<T>;
}

export type Defined<T> = Exclude<T, undefined>;

export type Inner<T extends Field<unknown>> = T extends Field<infer X> ? X
  : never;

type BigTypes = Defined<VarbigOptions["dataType"]>;
export class Big<Type extends BigTypes = BigTypes> implements Field<bigint> {
  readonly #opts: VarbigOptions;
  constructor(public readonly type: Type) {
    this.#opts = { dataType: type };
  }
  size() {
    return sizeof(this.type);
  }
  pack(value: bigint, buf: Uint8Array) {
    return Promise.resolve(putVarbig(buf, value, this.#opts));
  }
  unpack(buf: Uint8Array) {
    const result = varbig(buf, this.#opts);
    if (result == null) {
      throw new TypeError(`Big#unpack(): no ${this.type} found`);
    }
    return Promise.resolve(result);
  }
  read(r: Deno.Reader) {
    return readVarbig(r, this.#opts);
  }
}

type NumTypes = Defined<VarnumOptions["dataType"]>;
export class Num<Type extends NumTypes = NumTypes> implements Field<number> {
  readonly #opts: VarnumOptions;
  constructor(public readonly type: Type) {
    this.#opts = { dataType: type };
  }
  size() {
    return sizeof(this.type);
  }
  pack(value: number, buf: Uint8Array) {
    return Promise.resolve(putVarnum(buf, value, this.#opts));
  }
  unpack(buf: Uint8Array) {
    const result = varnum(buf, this.#opts);
    if (result == null) {
      throw new TypeError(`Num#unpack(): no ${this.type} found`);
    }
    return Promise.resolve(result);
  }
  read(r: Deno.Reader) {
    return readVarnum(r, this.#opts);
  }
}

export class DateTime implements Field<Date> {
  readonly #big: Big<"int64">;
  constructor() {
    this.#big = new Big("int64");
  }
  size() {
    return this.#big.size();
  }
  pack(value: Date, buf: Uint8Array) {
    return Promise.resolve(this.#big.pack(BigInt(value.getTime()), buf));
  }
  unpack(buf: Uint8Array) {
    return Promise.resolve(new Date(Number(this.#big.unpack(buf))));
  }
  async read(r: Deno.Reader) {
    return new Date(Number(await this.#big.read(r)));
  }
}

export class InlineText<Length extends number = number>
  implements Field<string> {
  readonly #num: Num<"uint8">;
  constructor(public readonly length: Length) {
    if (this.length > 255) {
      throw new TypeError("Max string length is 255");
    }
    this.#num = new Num("uint8");
  }
  size() {
    return this.length + this.#num.size();
  }
  async pack(value: string, buf: Uint8Array) {
    const trimmed = value.slice(0, this.length);
    const offset = await this.#num.pack(trimmed.length, buf);
    const text = new TextEncoder().encode(trimmed);
    buf.set(text, offset);
    return offset + text.byteLength;
  }
  async unpack(buf: Uint8Array) {
    const size = await this.#num.unpack(buf);
    return new TextDecoder().decode(buf.subarray(1, size + 1));
  }
  async read(r: Deno.Reader) {
    const size = await this.#num.read(r);
    return new TextDecoder().decode(await getNBytes(r, size));
  }
}

export class Binary<Name extends string> implements Field<Deno.Reader> {
  #p: Promise<void>;
  constructor(public readonly name: Name) {
    this.#p = ensureDir(name);
  }
  size() {
    return 32;
  }
  async pack(value: Deno.Reader, buf: Uint8Array) {
    await this.#p;
    const sha256 = createHash("sha256");
    let uuidStr: string;
    let filePath: string;
    do {
      uuidStr = encode(crypto.getRandomValues(new Uint8Array(16)));
      filePath = `${this.name}/${uuidStr}`;
    } while (
      await Deno.stat(filePath)
        .then(() => true, () => false)
    );
    const file = await Deno.open(filePath, { createNew: true, write: true });
    for await (const chunk of Deno.iter(value)) {
      sha256.update(chunk);
      await Deno.writeAll(file, chunk);
    }
    file.close();
    const hash = new Uint8Array(sha256.digest());
    const hashStr = encode(hash);
    const first2 = hashStr.slice(0, 2);
    const dir = `${this.name}/${first2}`;
    await ensureDir(dir);
    await Deno.rename(filePath, `${dir}/${hashStr.slice(2)}`);
    buf.set(hash);
    return hash.byteLength;
  }
  unpack(buf: Uint8Array) {
    const hashStr = encode(buf);
    return Deno.open(
      `${this.name}/${hashStr.slice(0, 2)}/${hashStr.slice(2)}`,
      { read: true },
    );
  }
  async read(r: Deno.Reader) {
    return this.unpack(await getNBytes(r, this.size()));
  }
}

export class Text<Name extends string> implements Field<string> {
  #bin: Binary<Name>;
  constructor(public readonly name: Name) {
    this.#bin = new Binary(name);
  }
  size() {
    return this.#bin.size();
  }
  pack(value: string, buf: Uint8Array) {
    return this.#bin.pack(
      readerFromBuffer(new TextEncoder().encode(value)),
      buf,
    );
  }
  async unpack(buf: Uint8Array) {
    return new TextDecoder().decode(
      await Deno.readAll(await this.#bin.unpack(buf)),
    );
  }
  async read(r: Deno.Reader) {
    return new TextDecoder().decode(
      await Deno.readAll(await this.#bin.read(r)),
    );
  }
}

export class Json<Name extends string> implements Field<unknown> {
  #text: Text<Name>;
  constructor(public readonly name: Name) {
    this.#text = new Text(name);
  }
  size() {
    return this.#text.size();
  }
  pack(value: unknown, buf: Uint8Array) {
    return this.#text.pack(JSON.stringify(value), buf);
  }
  async unpack(buf: Uint8Array) {
    return JSON.parse(await this.#text.unpack(buf));
  }
  async read(r: Deno.Reader) {
    return JSON.parse(await this.#text.read(r)) as unknown;
  }
}
