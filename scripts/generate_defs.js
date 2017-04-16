"use strict";

const fs   = require("fs");
const path = require("path");

const SOURCE_PATH = path.resolve(__dirname, "./EastAsianWidth.txt");
const TARGET_PATH = path.resolve(__dirname, "../src/defs.js");

const ENCODING = "utf-8";

const DEFAULT_PROP_VALUE = "N";
const MIN_CODE_POINT     = 0x0000;
const MAX_CODE_POINT     = 0x10FFFF;

const HEADER = `/*
 * This part (from BEGIN to END) is derived from the Unicode Data Files:
 *
 * UNICODE, INC. LICENSE AGREEMENT
 *
 * Copyright © 1991-2017 Unicode, Inc. All rights reserved.
 * Distributed under the Terms of Use in http://www.unicode.org/copyright.html.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of the Unicode data files and any associated documentation
 * (the "Data Files") or Unicode software and any associated documentation
 * (the "Software") to deal in the Data Files or Software
 * without restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, and/or sell copies of
 * the Data Files or Software, and to permit persons to whom the Data Files
 * or Software are furnished to do so, provided that either
 * (a) this copyright and permission notice appear with all copies
 * of the Data Files or Software, or
 * (b) this copyright and permission notice appear in associated
 * Documentation.
 *
 * THE DATA FILES AND SOFTWARE ARE PROVIDED "AS IS", WITHOUT WARRANTY OF
 * ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
 * WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT OF THIRD PARTY RIGHTS.
 * IN NO EVENT SHALL THE COPYRIGHT HOLDER OR HOLDERS INCLUDED IN THIS
 * NOTICE BE LIABLE FOR ANY CLAIM, OR ANY SPECIAL INDIRECT OR CONSEQUENTIAL
 * DAMAGES, OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE,
 * DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
 * TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THE DATA FILES OR SOFTWARE.
 */

/* BEGIN */`;

const FOOTER = "/* END */";

function readFile(path, options) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, options, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(data);
    });
  });
}

function writeFile(path, data, options) {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, data, options, err => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function parseDef(str) {
  const [range, prop]      = str.split(/\s*;\s*/, 2);
  const [startStr, endStr] = range.split(/\s*\.\.\s*/, 2);
  const start = parseInt(startStr, 16);
  const end   = parseInt(endStr || startStr, 16);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new Error("unknown range");
  }
  return { start, end, prop };
}

function generateJS(defs) {
  const a = defs
    .map(def => `  { start: ${def.start}, end: ${def.end}, prop: "${def.prop}" }`)
    .join(",\n");
  return `${HEADER}\nexport default [\n${a}\n];\n${FOOTER}\n`;
}

async function generate() {
  const src = (await readFile(SOURCE_PATH, { encoding: ENCODING }))
    .split(/[\r\n]+/)                                      // split lines
    .map(line => line.replace(/^([^#]*).*$/, "$1").trim()) // strip comments
    .filter(line => line !== "")                           // remove empty lines
    .map(parseDef);                                        // parse
  // complete and merge definitions
  const defs = [];
  let prev = null;
  for (const def of src) {
    if (!prev) {
      // complete head
      if (def.start !== MIN_CODE_POINT) {
        prev = {
          start: MIN_CODE_POINT,
          end  : def.start - 1,
          prop : DEFAULT_PROP_VALUE
        };
      }
      else {
        prev = def;
        continue;
      }
    }
    // complete
    if (prev.end + 1 !== def.start) {
      if (prev.prop === DEFAULT_PROP_VALUE) {
        prev = {
          start: prev.start,
          end  : def.start - 1,
          prop : DEFAULT_PROP_VALUE
        };
      }
      else {
        defs.push(prev);
        prev = {
          start: prev.end + 1,
          end  : def.start - 1,
          prop : DEFAULT_PROP_VALUE
        };
      }
    }
    // merge
    if (prev.prop === def.prop && prev.end + 1 === def.start) {
      prev = {
        start: prev.start,
        end  : def.end,
        prop : prev.prop
      };
    }
    else {
      defs.push(prev);
      prev = def;
    }
  }
  if (prev) {
    // complete tail
    if (prev.end !== MAX_CODE_POINT) {
      if (prev.prop === DEFAULT_PROP_VALUE) {
        prev = {
          start: prev.start,
          end  : MAX_CODE_POINT,
          prop : DEFAULT_PROP_VALUE
        };
      }
      else {
        defs.push(prev);
        prev = {
          start: prev.end + 1,
          end  : MAX_CODE_POINT,
          prop : DEFAULT_PROP_VALUE
        };
      }
    }
    // push last def
    defs.push(prev);
  }
  await writeFile(TARGET_PATH, generateJS(defs), { encoding: ENCODING });
}

generate().catch(err => {
  console.error(err); // eslint-disable-line no-console
});
