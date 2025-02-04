import { assertEquals } from "https://deno.land/std@0.89.0/testing/asserts.ts";
import { addTextSpans, Entity, parseMarkup } from "./markup.ts";

Deno.test("parse multiple levels of syntax", () => {
  const text = "__~~**//italic bold  ``code`` strikethrough underline//**~~__";

  assertEquals<Entity>(
    parseMarkup(text),
    {
      type: "text",
      innerSpan: { start: 0, end: text.length },
      outerSpan: { start: 0, end: text.length },
      entities: [
        {
          type: "underline",
          innerSpan: { start: 2, end: text.length - 2 },
          outerSpan: { start: 0, end: text.length },
          entities: [
            {
              type: "strikethrough",
              innerSpan: { start: 4, end: text.length - 4 },
              outerSpan: { start: 2, end: text.length - 2 },
              entities: [
                {
                  type: "bold",
                  innerSpan: { start: 6, end: text.length - 6 },
                  outerSpan: { start: 4, end: text.length - 4 },
                  entities: [
                    {
                      type: "italic",
                      innerSpan: { start: 8, end: text.length - 8 },
                      outerSpan: { start: 6, end: text.length - 6 },
                      entities: [
                        {
                          type: "code",
                          innerSpan: { start: 23, end: 27 },
                          outerSpan: { start: 21, end: 29 },
                          entities: [],
                          params: {},
                        },
                      ],
                      params: {},
                    },
                  ],
                  params: {},
                },
              ],
              params: {},
            },
          ],
          params: {},
        },
      ],
      params: {},
    },
  );
});

Deno.test("parses a complex markup example", () => {
  const text =
    "> blockquote **bold //italic bold// bold** __underline__ ** <- unmatched marker should be safely ignored ``code//not italic because code//`` trailing text";
  assertEquals<Entity>(
    parseMarkup(text),
    {
      type: "text",
      innerSpan: { start: 0, end: text.length },
      outerSpan: { start: 0, end: text.length },
      entities: [{
        type: "blockquote",
        innerSpan: { start: 2, end: text.length },
        outerSpan: { start: 0, end: text.length },
        entities: [
          {
            type: "bold",
            innerSpan: { start: 15, end: 40 },
            outerSpan: { start: 13, end: 42 },
            entities: [{
              type: "italic",
              innerSpan: { start: 22, end: 33 },
              outerSpan: { start: 20, end: 35 },
              entities: [],
              params: {},
            }],
            params: {},
          },
          {
            type: "underline",
            innerSpan: { start: 45, end: 54 },
            outerSpan: { start: 43, end: 56 },
            entities: [],
            params: {},
          },
          {
            type: "code",
            innerSpan: { start: 107, end: 138 },
            outerSpan: { start: 105, end: 140 },
            entities: [],
            params: {},
          },
        ],
        params: {},
      }],
      params: {},
    },
  );
});

Deno.test("parsed multilines and indentation", () => {
  let text = `
> a blockquote!
    > not a blockquote
  `;

  assertEquals<Entity>(
    parseMarkup(text),
    {
      type: "text",
      innerSpan: { start: 0, end: text.length },
      outerSpan: { start: 0, end: text.length },
      entities: [{
        type: "blockquote",
        innerSpan: { start: 3, end: 16 },
        outerSpan: { start: 0, end: 17 },
        entities: [],
        params: {},
      }],
      params: {},
    },
  );
});

Deno.test("custom_end should be ignored", () => {
  let text = `abc ]`;

  assertEquals<Entity>(
    parseMarkup(text),
    {
      type: "text",
      innerSpan: { start: 0, end: text.length },
      outerSpan: { start: 0, end: text.length },
      entities: [],
      params: {},
    },
  );
});

function textSlices(text: string, entity: Entity): string[] {
  switch (entity.type) {
    case "text":
      if (entity.entities.length === 0) {
        return [text.slice(entity.innerSpan.start, entity.innerSpan.end)];
      }
    default:
      return entity.entities.flatMap((e) => textSlices(text, e));
  }
}

Deno.test("addTextSpans should add text spans", () => {
  let text = `1__2**3**4__5`;
  let textNodes = textSlices(text, addTextSpans(parseMarkup(text)));

  assertEquals(
    textNodes,
    ["1", "2", "3", "4", "5"],
  );
});

Deno.test("addTextSpans should add text spans for advanced markup", () => {
  let text = `
> 1__2__3
4 \`\`\`not
5
\`\`\` 6
7
`.trim();
  let textNodes = textSlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["1", "2", "3", "4 ", "5\n", " 6\n7"],
  );
});

Deno.test("codeblocks should work with or without the language specified", () => {
  let text = `
\`\`\`js
let x = 0;
\`\`\`

\`\`\`
just text
\`\`\`
`.trim();
  let textNodes = textSlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["let x = 0;\n", "\n\n", "just text\n"],
  );
});

// testing every type of entity
type EntitySlice = [string, object, string] | [string, object, EntitySlice[]];

function entitySlices(text: string, entity: Entity): EntitySlice {
  if (entity.type === "text" && entity.entities.length === 0) {
    return [
      entity.type,
      entity.params,
      text.slice(entity.innerSpan.start, entity.innerSpan.end),
    ];
  }
  return [
    entity.type,
    entity.params,
    entity.entities.map((e) => entitySlices(text, e)),
  ];
}

Deno.test("root text entity should parsed the remaining text", () => {
  let text = `hello world!`.trim();
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, "hello world!"],
  );
});

Deno.test("bold should be parsed", () => {
  let text = `**hello world!**`.trim();
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [["bold", {}, [["text", {}, "hello world!"]]]]],
  );
});

Deno.test("italic forward slash should be parsed", () => {
  let text = `//hello world!//`.trim();
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [["italic", {}, [["text", {}, "hello world!"]]]]],
  );
});

Deno.test("italic asterisk should be parsed", () => {
  let text = `*hello world!*`.trim();
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [["italic", {}, [["text", {}, "hello world!"]]]]],
  );
});

Deno.test("italic underline should be parsed", () => {
  let text = `_hello world!_`.trim();
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [["italic", {}, [["text", {}, "hello world!"]]]]],
  );
});

Deno.test("italic mixed should not be parsed", () => {
  let text = `_hello world!*`.trim();
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, "_hello world!*"],
  );
});

Deno.test("underline should be parsed", () => {
  let text = `__hello world!__`.trim();
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [["underline", {}, [["text", {}, "hello world!"]]]]],
  );
});

Deno.test("strikethrough should be parsed", () => {
  let text = `~~hello world!~~`.trim();
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [["strikethrough", {}, [["text", {}, "hello world!"]]]]],
  );
});

Deno.test("code should be parsed", () => {
  let text = "``hello world!``".trim();
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [["code", {}, [["text", {}, "hello world!"]]]]],
  );
});

Deno.test("code single marker should be parsed", () => {
  let text = "`hello world!`".trim();
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [["code", {}, [["text", {}, "hello world!"]]]]],
  );
});

Deno.test("code mixed marker should not be parsed", () => {
  let text = "``hello world!`".trim();
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, "``hello world!`"],
  );
});

Deno.test("code mixed marker should not be parsed", () => {
  let text = "`hello world!``".trim();
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, "`hello world!``"],
  );
});

Deno.test("code should be parsed", () => {
  let text = `
\`\`\`
hello world!
\`\`\`

\`\`\`language
hello world!
\`\`\`
`.trim();
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [
      ["codeblock", { lang: "" }, [["text", {}, "hello world!\n"]]],
      ["text", {}, "\n\n"],
      [
        "codeblock",
        { lang: "language" },
        [["text", {}, "hello world!\n"]],
      ],
    ]],
  );
});

Deno.test("blockquote should be parsed 'inline'", () => {
  let text = "> hello world!".trim();
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [["blockquote", {}, [["text", {}, "hello world!"]]]]],
  );
});

Deno.test("blockquote should be parsed", () => {
  let text = "\n> hello world!\n";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [["blockquote", {}, [["text", {}, "hello world!"]]]]],
  );
});

Deno.test("blockquote should be parsed with multiple", () => {
  let text = "\n> hello world!\n> hello world 2!";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [["blockquote", {}, [["text", {}, "hello world!"]]], [
      "blockquote",
      {},
      [["text", {}, "hello world 2!"]],
    ]]],
  );
});

Deno.test("custom entities should be parsed", () => {
  let text = "[name: hello world!]";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [["custom", { type: "name" }, [[
      "text",
      {},
      " hello world!",
    ]]]]],
  );
});

Deno.test("custom entities a single symbol should be parsed", () => {
  let text = "[@: hello world!]";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [["custom", { type: "@" }, [["text", {}, " hello world!"]]]]],
  );
});

Deno.test("escapes should escape entities", () => {
  let text = String.raw`\[@: hello world!]`;
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [
      ["text", {}, "["],
      ["text", {}, "@: hello world!]"],
    ]],
  );
});

Deno.test("escapes should escape in code entities", () => {
  let text = "`` hello \\`` world! ``";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [
      ["code", {}, [
        ["text", {}, " hello "],
        ["text", {}, "`"],
        ["text", {}, "` world! "],
      ]],
    ]],
  );
});

Deno.test("escapes should escape in codelock entities", () => {
  let text = "``` hello \\``` world! ```";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [
      ["codeblock", { lang: undefined }, [
        ["text", {}, " hello "],
        ["text", {}, "`"],
        ["text", {}, "`` world! "],
      ]],
    ]],
  );
});

Deno.test("escapes should escape in expression entities", () => {
  let text = "[name: hello \\] world! ]";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [
      ["custom", { type: "name" }, [
        ["text", {}, " hello "],
        ["text", {}, "]"],
        ["text", {}, " world! "],
      ]],
    ]],
  );
});

Deno.test("blockquotes should have entities inside of them", () => {
  let text = "> **hello world!**";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [
      ["blockquote", {}, [
        ["bold", {}, [
          ["text", {}, "hello world!"],
        ]],
      ]],
    ]],
  );
});

Deno.test("emojis should be parsed", () => {
  let text = "hello ✨ world";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [
      ["text", {}, "hello "],
      ["emoji", {}, [
        ["text", {}, "✨"],
      ]],
      ["text", {}, " world"],
    ]],
  );
});

Deno.test("emojis combinations should be parsed", () => {
  let text = "hello 🏳️‍🌈1️⃣👋🏽 1 world";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [
      ["text", {}, "hello "],
      ["emoji", {}, [["text", {}, "🏳️‍🌈"]]],
      ["emoji", {}, [["text", {}, "1️⃣"]]],
      ["emoji", {}, [["text", {}, "👋🏽"]]],
      ["text", {}, " 1 world"],
    ]],
  );
});

Deno.test("emoji names should be parsed", () => {
  let text = "hello :sparkles: world";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [
      ["text", {}, "hello "],
      ["emoji_name", {}, [
        ["text", {}, "sparkles"],
      ]],
      ["text", {}, " world"],
    ]],
  );
});

Deno.test("links should be parsed", () => {
  let text = "hello https://example.com world";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [
      ["text", {}, "hello "],
      ["link", {}, [
        ["text", {}, "https://example.com"],
      ]],
      ["text", {}, " world"],
    ]],
  );
});

Deno.test("links should be surrounded", () => {
  let text = "hello <https://example.com> world";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [
      ["text", {}, "hello "],
      ["link", {}, [
        ["text", {}, "https://example.com"],
      ]],
      ["text", {}, " world"],
    ]],
  );
});

Deno.test("links should parse unwanted symbols", () => {
  let text = "hello https://example.com) world";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [
      ["text", {}, "hello "],
      ["link", {}, [
        ["text", {}, "https://example.com"],
      ]],
      ["text", {}, ") world"],
    ]],
  );
});

Deno.test("links should parse a full url", () => {
  let text = "hello https://example.com/example?example=123) world";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [
      ["text", {}, "hello "],
      ["link", {}, [
        ["text", {}, "https://example.com/example?example=123"],
      ]],
      ["text", {}, ") world"],
    ]],
  );
});

Deno.test("links should parse a full url with a hash", () => {
  let text = "hello https://example.com/example#123) world";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [
      ["text", {}, "hello "],
      ["link", {}, [
        ["text", {}, "https://example.com/example#123"],
      ]],
      ["text", {}, ") world"],
    ]],
  );
});

Deno.test("spoilers should be parsed", () => {
  let text = "hello ||secret|| world";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [
      ["text", {}, "hello "],
      ["spoiler", {}, [
        ["text", {}, "secret"],
      ]],
      ["text", {}, " world"],
    ]],
  );
});

Deno.test("color should be parsed", () => {
  let text = "hello [#f00] red world";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [
      ["text", {}, "hello "],
      ["color", { color: "#f00" }, [
        ["text", {}, " red world"],
      ]],
    ]],
  );
});

Deno.test("color should be parsed in scope", () => {
  let text = "hello **[#f00] red** world";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [
      ["text", {}, "hello "],
      ["bold", {}, [
        ["color", { color: "#f00" }, [
          ["text", {}, " red"],
        ]],
      ]],
      ["text", {}, " world"],
    ]],
  );
});

Deno.test("color should be able to be reset", () => {
  let text = "hello **[#f00] red [#reset] not red** world";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [
      ["text", {}, "hello "],
      ["bold", {}, [
        ["color", { color: "#f00" }, [
          ["text", {}, " red "],
        ]],
        ["color", { color: "reset" }, [
          ["text", {}, " not red"],
        ]],
      ]],
      ["text", {}, " world"],
    ]],
  );
});

Deno.test("color should continue after a blockquote", () => {
  let text = "> [#f00] hello red world\nnot red";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [
      ["blockquote", {}, [
        ["color", { color: "#f00" }, [
          ["text", {}, " hello red world"],
        ]],
      ]],
      ["text", {}, "not red"],
    ]],
  );
});

Deno.test("color be contained with newlines and blockquotes", () => {
  let text =
    "[#f01] hello red [#reset] not red\n> [#f02] hello red [#reset] not red world\nno style";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [
      ["color", { color: "#f01" }, [
        ["text", {}, " hello red "],
      ]],
      ["color", { color: "reset" }, [
        ["text", {}, " not red"],
      ]],
      ["blockquote", {}, [
        ["color", { color: "#f02" }, [
          ["text", {}, " hello red "],
        ]],
        ["color", { color: "reset" }, [
          ["text", {}, " not red world"],
        ]],
      ]],
      ["text", {}, "no style"],
    ]],
  );
});

Deno.test("color should support multiple layers of colors", () => {
  let text = "[#f01] 1 [#f02] 2 [#f03] 3 ";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [
      ["color", { color: "#f01" }, [["text", {}, " 1 "]]],
      ["color", { color: "#f02" }, [["text", {}, " 2 "]]],
      ["color", { color: "#f03" }, [["text", {}, " 3 "]]],
    ]],
  );
});

Deno.test("color should work with codeblocks", () => {
  let text = "[#f01] 1 ```2```[#f03] 3";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [
      ["color", { color: "#f01" }, [["text", {}, " 1 "]]],
      ["codeblock", { lang: undefined }, [["text", {}, "2"]]],
      ["color", { color: "#f03" }, [["text", {}, " 3"]]],
    ]],
  );
});

Deno.test("color should work with code and codeblocks", () => {
  let text = "[#f01] 1 `2` 3 [#f04] 4 [#f05] 5";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [
      ["color", { color: "#f01" }, [
        ["text", {}, " 1 "],
        ["code", {}, [["text", {}, "2"]]],
        ["text", {}, " 3 "],
        ["color", { color: "#f04" }, [["text", {}, " 4 "]]],
        ["color", { color: "#f05" }, [["text", {}, " 5"]]],
      ]],
    ]],
  );
});

Deno.test("color should work with custom entities", () => {
  let text = "[#f01] 1 [test: hello world!]";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [
      ["color", { color: "#f01" }, [["text", {}, " 1 "]]],
      ["custom", { type: "test" }, [["text", {}, " hello world!"]]],
    ]],
  );
});

Deno.test("color should work with multiple entities", () => {
  let text = "**bold** [#ff0011] **test `code`**";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [
      ["bold", {}, [["text", {}, "bold"]]],
      ["text", {}, " "],
      ["color", { color: "#ff0011" }, [
        ["text", {}, " "],
        ["bold", {}, [
          ["text", {}, "test "],
          ["code", {}, [["text", {}, "code"]]],
        ]],
      ]],
    ]],
  );
});

Deno.test("eggs should be transformed into color entities", () => {
  let text = "§0 1 §r 2 §k 3";
  let textNodes = entitySlices(text, addTextSpans(parseMarkup(text)));
  assertEquals(
    textNodes,
    ["text", {}, [
      ["color", { color: "#000" }, [["text", {}, " 1 "]]],
      ["color", { color: "reset" }, [["text", {}, " 2 §k 3"]]],
    ]],
  );
});