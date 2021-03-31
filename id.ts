export const id = (x: number) =>
  [...x.toString(26)]
    .map((x) =>
      "0123456789".includes(x) ? String.fromCharCode(113 + Number(x)) : x
    )
    .join("");

export const num = (id: string) =>
  parseInt(
    [...id]
      .map((x) => "qrstuvwxyz".includes(x) ? x.charCodeAt(0) - 113 : x)
      .join(""),
    26,
  );
