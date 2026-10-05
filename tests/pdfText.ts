import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

// ReportLab streams are ASCII85-wrapped Flate data.
const ascii85Decode = (input: string) => {
  const text = input.replace(/\s+/g, "").replace(/~>$/, "");
  const bytes: number[] = [];
  let group: number[] = [];
  const flush = (count: number) => {
    let value = 0;
    for (const digit of group) value = value * 85 + digit;
    const chunk = [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
    bytes.push(...chunk.slice(0, count));
  };
  for (const char of text) {
    if (char === "z" && group.length === 0) {
      bytes.push(0, 0, 0, 0);
      continue;
    }
    group.push(char.charCodeAt(0) - 33);
    if (group.length === 5) {
      flush(4);
      group = [];
    }
  }
  if (group.length > 0) {
    const count = group.length - 1;
    while (group.length < 5) group.push(84);
    flush(count);
  }
  return Buffer.from(bytes);
};

export const pdfText = (file: string) => {
  const data = readFileSync(file).toString("latin1");
  const streams = [...data.matchAll(/<<([^]*?)>>\s*stream\r?\n([^]*?)endstream/g)];
  return streams
    .map(([, header, body]) => {
      let raw = Buffer.from(body, "latin1");
      if (header.includes("ASCII85Decode")) raw = ascii85Decode(body);
      if (header.includes("FlateDecode")) raw = inflateSync(raw);
      return raw.toString("latin1");
    })
    .join("\n");
};
