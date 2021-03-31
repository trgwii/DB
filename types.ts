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

export interface Field<T> {
  size(): number;
  pack(value: T, buf: Uint8Array): number;
  unpack(buf: Uint8Array): T;
  read(r: Deno.Reader): Promise<T>;
}

export type Defined<T> = Exclude<T, undefined>;

export type Inner<T extends Field<unknown>> = T extends Field<infer X> ? X
  : never;

export class Big<
  Type extends Defined<VarbigOptions["dataType"]> = Defined<
    VarbigOptions["dataType"]
  >,
> implements Field<bigint> {
  readonly #opts: VarbigOptions;
  constructor(public readonly type: Type) {
    this.#opts = { dataType: type };
  }
  size() {
    return sizeof(this.type);
  }
  pack(value: bigint, buf: Uint8Array) {
    return putVarbig(buf, value, this.#opts);
  }
  unpack(buf: Uint8Array) {
    const result = varbig(buf, this.#opts);
    if (result == null) {
      throw new TypeError(`Big#unpack(): no ${this.type} found`);
    }
    return result;
  }
  read(r: Deno.Reader) {
    return readVarbig(r, this.#opts);
  }
}
export class Num<
  Type extends Defined<VarnumOptions["dataType"]> = Defined<
    VarnumOptions["dataType"]
  >,
> implements Field<number> {
  readonly #opts: VarnumOptions;
  constructor(public readonly type: Type) {
    this.#opts = { dataType: type };
  }
  size() {
    return sizeof(this.type);
  }
  pack(value: number, buf: Uint8Array) {
    return putVarnum(buf, value, this.#opts);
  }
  unpack(buf: Uint8Array) {
    const result = varnum(buf, this.#opts);
    if (result == null) {
      throw new TypeError(`Num#unpack(): no ${this.type} found`);
    }
    return result;
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
    return this.#big.pack(BigInt(value.getTime()), buf);
  }
  unpack(buf: Uint8Array) {
    return new Date(Number(this.#big.unpack(buf)));
  }
  async read(r: Deno.Reader) {
    return new Date(Number(await this.#big.read(r)));
  }
}

export class Text<Length extends number = number> implements Field<string> {
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
  pack(value: string, buf: Uint8Array) {
    const trimmed = value.slice(0, this.length);
    const offset = this.#num.pack(trimmed.length, buf);
    const text = new TextEncoder().encode(trimmed);
    buf.set(text, offset);
    return offset + text.byteLength;
  }
  unpack(buf: Uint8Array) {
    const size = this.#num.unpack(buf);
    return new TextDecoder().decode(buf.subarray(1, size + 1));
  }
  async read(r: Deno.Reader) {
    const size = await this.#num.read(r);
    return new TextDecoder().decode(await getNBytes(r, size));
  }
}
