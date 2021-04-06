import { ensureDir } from "https://deno.land/std@0.91.0/fs/ensure_dir.ts";
import { getNBytes } from "./binary.ts";
import type { Field, Inner } from "./types.ts";
import { id, num } from "./id.ts";

export class DB<
  Schema extends Record<string, Field<unknown>>,
  Options extends { stringIds: boolean },
> {
  readonly #handle: Promise<Deno.File>;
  #size = 0;
  #rowSize = 0;
  #offsets: (readonly [string, Field<unknown>, number])[] = [];
  constructor(
    public readonly name: string,
    public readonly schema: Schema,
    public readonly options: Options,
  ) {
    const filePath = `${name}/data.db`;
    this.#handle = Deno.stat(filePath)
      .then((s) => this.#size = s.size, async () => {
        await ensureDir(name);
        return this.#size = 0;
      })
      .then(() => {
        let rowSize = 0;
        for (const p of Object.values(this.schema)) {
          rowSize += p.size();
        }
        this.#rowSize = rowSize;
        this.#offsets = Object.keys(this.schema)
          .map((k) => [k, this.schema[k]] as const)
          .map(([k, p]) => [k, p, p.size()] as const)
          .map(([k, p], i, arr) =>
            [k, p, arr.slice(0, i).reduce((acc, x) => acc + x[2], 0)] as const
          );
      })
      .then(() =>
        Deno.open(filePath, { create: true, read: true, write: true })
      );
  }
  async seek(n: number) {
    const handle = await this.#handle;
    await handle.seek(n, Deno.SeekMode.Start);
  }
  invalidTypeError(field: string, expected: string, got: string) {
    return new TypeError(
      `Invalid type for ${field}: expected ${expected}, got: ${got}`,
    );
  }
  async insert(data: { [K in keyof Schema]: Inner<Schema[K]> }) {
    const handle = await this.#handle;
    await handle.seek(this.#size, Deno.SeekMode.Start);
    const row = new Uint8Array(this.#rowSize);
    let offset = 0;
    for (const [k, p] of Object.entries(this.schema)) {
      const value = data[k];
      offset += await p.pack(value as unknown as never, row.subarray(offset));
    }
    await Deno.writeAll(handle, row);
    const rowId = this.#size / this.#rowSize;
    this.#size += row.byteLength;
    return (this.options.stringIds
      ? id(rowId)
      : rowId) as Options["stringIds"] extends true ? string : number;
  }
  async update(query: { [K in keyof Schema]?: Inner<Schema[K]> }, data: { [K in keyof Schema]?: Inner<Schema[K]>}) {
    const handle = await this.#handle;
    //const updated: { seek: number, newRow: Uint8Array }[] = [];  
    const updated: Array< number | string | unknown> = [];  
    for await (const row of this.all(query)) {
      const newRow = new Uint8Array(this.#rowSize);
      const { _id: id } = row;
      const seek = this.#rowSize *
      ((this.options.stringIds ? num(id as string) : id) as number);
      let offset = 0;
      for (const [k, p] of Object.entries(this.schema)) {
        const value = data[k] || row[k];
        offset += await p.pack(value as unknown as never, newRow.subarray(offset))
      }  
      await handle.seek(seek, Deno.SeekMode.Start);
      await Deno.writeAll(handle, newRow);
      updated.push(id);
    }
    return updated
  }
  async updateOne(query: { [K in keyof Schema]?: Inner<Schema[K]> }, data: { [K in keyof Schema]?: Inner<Schema[K]>}) {
    const handle = await this.#handle;
    const row = await this.one(query);
    if (typeof row === 'undefined') return 0;
    const newRow = new Uint8Array(this.#rowSize);
    const { _id: id } = row;
    let offset = 0;
    for (const [k, p] of Object.entries(this.schema)) {
      const value = data[k] || row[k];
      offset += await p.pack(value as unknown as never, newRow.subarray(offset))
    }
    const seek = this.#rowSize *
      ((this.options.stringIds ? num(id as string) : id) as number);  
    await handle.seek(seek, Deno.SeekMode.Start);
    await Deno.writeAll(handle, newRow);
    return id;
  }
  async byId(id: Options["stringIds"] extends true ? string : number) {
    const handle = await this.#handle;
    const seek = this.#rowSize *
      ((this.options.stringIds ? num(id as string) : id) as number);
    await handle.seek(seek, Deno.SeekMode.Start);
    return this.fetchRow(id);
  }
  async one(data: { [K in keyof Schema]?: Inner<Schema[K]> }) {
    for await (const row of this.all(data)) {
      return row;
    }
  }
  async *all(data: { [K in keyof Schema]?: Inner<Schema[K]> }) {
    const handle = await this.#handle;
    const offsets = this.#offsets.filter((x) => x[0] in data); 

    const rows = this.#size / this.#rowSize;
    await handle.seek(0, Deno.SeekMode.Start);
    row:
    for (let i = 0; i < rows; i++) {
      const offset = i * this.#rowSize;
      for (const [k, p, localOffset] of offsets) {
        await handle.seek(offset + localOffset, Deno.SeekMode.Start);
        const stored = await getNBytes(handle, p.size());
        const buf = new Uint8Array(p.size());
        await p.pack(data[k] as never, buf);
        for (let i = 0; i < buf.length; i++) {
          if (buf[i] !== stored[i]) {
            continue row;
          }
        }
      }
      await handle.seek(offset, Deno.SeekMode.Start);
      yield this.fetchRow(this.options.stringIds ? id(i) : i);
    }
  }
  async fetchRow(_id?: string | number) {
    const handle = await this.#handle;
    const result: Record<string, unknown> = { _id };
    for (const [k, p] of Object.entries(this.schema)) {
      result[k] = await p.read(handle);
    }
    return result as { [K in keyof Schema]: Inner<Schema[K]> };
  }
}
