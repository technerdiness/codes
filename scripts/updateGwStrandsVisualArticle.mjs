import fs from "fs";

const GW_POST_ID = 4141;
const GW_POST_ENDPOINT = `https://www.gamingwize.com/wp-json/wp/v2/posts/${GW_POST_ID}`;
const NYT_TIMEZONE = "America/New_York";

function readEnvFile(pathname) {
  const env = {};
  const lines = fs.readFileSync(pathname, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) continue;
    env[line.slice(0, equalsIndex).trim()] = line.slice(equalsIndex + 1);
  }
  return env;
}

function getEnv(key) {
  const value = process.env[key] ?? localEnv[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeAnswer(value) {
  return String(value).trim().replace(/\s+/g, "").toUpperCase();
}

function getCurrentIsoDate(timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

function getStrandsCoordinateKey([row, col]) {
  return `${row},${col}`;
}

function buildStrandsAnswerSignature(result) {
  return [result.spangram, ...result.themeWords].join("::");
}

function buildStrandsHighlightWords(result, mode) {
  const words = [];

  if (mode === "solution") {
    for (const word of result.themeWords) {
      const coords = result.themeCoords[word] ?? [];
      if (coords.length) {
        words.push({
          kind: "theme",
          word,
          coords,
          fill: "#aedfee",
        });
      }
    }
  }

  if (result.spangramCoords.length) {
    words.push({
      kind: "spangram",
      word: result.spangram,
      coords: result.spangramCoords,
      fill: "#f8cd05",
    });
  }

  return mode === "spangram" ? words.filter((word) => word.kind === "spangram") : words;
}

function renderStrandsBoardSvg(result, mode) {
  const rows = result.startingBoard.length;
  const cols = result.startingBoard.reduce((max, row) => Math.max(max, row.length), 0);
  if (!rows || !cols) {
    return "";
  }

  const step = 54;
  const radius = 21;
  const padding = 28;
  const svgWidth = padding * 2 + (cols - 1) * step + radius * 2;
  const svgHeight = padding * 2 + (rows - 1) * step + radius * 2;
  const words = buildStrandsHighlightWords(result, mode);
  const highlights = new Map();

  for (const word of words) {
    for (const coord of word.coords) {
      highlights.set(getStrandsCoordinateKey(coord), word);
    }
  }

  const connectors = words
    .filter((word) => word.coords.length > 1)
    .map((word) => {
      const path = word.coords
        .map(([row, col], index) => {
          const x = padding + col * step + radius;
          const y = padding + row * step + radius;
          return `${index === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");
      return `<path d="${path}" fill="none" stroke="${word.fill}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join("");

  const circles = result.startingBoard
    .flatMap((boardRow, rowIndex) =>
      boardRow.split("").map((letter, colIndex) => {
        const x = padding + colIndex * step + radius;
        const y = padding + rowIndex * step + radius;
        const highlight = highlights.get(getStrandsCoordinateKey([rowIndex, colIndex]));
        const fill = highlight?.fill ?? "#ffffff";
        return [
          `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" stroke="${highlight ? "none" : "#dbd8c5"}" stroke-width="2"/>`,
          `<text x="${x}" y="${y + 1}" text-anchor="middle" dominant-baseline="middle" font-size="20" font-weight="700" fill="#111111" font-family="Arial, Helvetica, sans-serif">${escapeHtml(
            letter
          )}</text>`,
        ].join("");
      })
    )
    .join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" role="img" aria-label="${escapeHtml(
      mode === "spangram"
        ? `NYT Strands spangram board for ${result.answerDate}`
        : `NYT Strands solution board for ${result.answerDate}`
    )}">`,
    `<rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" rx="28" fill="#f8f7f2"/>`,
    connectors,
    circles,
    `</svg>`,
  ].join("");
}

function renderStrandsBoardHtml(result, mode) {
  const svg = renderStrandsBoardSvg(result, mode);
  return svg ? `<div class="tn-strands-board">${svg}</div>` : "";
}

function renderStrandsRevealHtml(summaryLabel, innerHtml, dataAttribute) {
  return [
    "<style>",
    ".tn-strands-answer-reveal{margin:1rem 0;}",
    ".tn-strands-answer-reveal summary{display:inline-flex;align-items:center;justify-content:center;padding:.8rem 1.25rem;border:0;border-radius:999px;background:#111827;color:#fff;font-weight:700;cursor:pointer;list-style:none;}",
    ".tn-strands-answer-reveal summary::-webkit-details-marker{display:none;}",
    ".tn-strands-answer-reveal[open] summary{display:none;}",
    ".tn-strands-answer-reveal__content{margin-top:1rem;padding:1rem 1.1rem;border:1px solid #e5e7eb;border-radius:16px;background:#f9fafb;}",
    ".tn-strands-answer-reveal__content p:last-child,.tn-strands-answer-reveal__content ul:last-child{margin-bottom:0;}",
    ".tn-strands-board{margin:1rem 0;overflow-x:auto;-webkit-overflow-scrolling:touch;}",
    ".tn-strands-board svg{display:block;width:100%;height:auto;min-width:320px;}",
    ".tn-strands-answer-list li{margin:.35rem 0;}",
    "</style>",
    `<details class="tn-strands-answer-reveal" ${dataAttribute}>`,
    `<summary>${escapeHtml(summaryLabel)}</summary>`,
    `<div class="tn-strands-answer-reveal__content">\n${innerHtml}\n</div>`,
    "</details>",
  ].join("\n");
}

function renderStrandsSpangramHtml(result) {
  return renderStrandsRevealHtml(
    "Reveal Spangram",
    [
      `<p><strong>Spangram:</strong> ${escapeHtml(result.spangram)}</p>`,
      `<p>The board below traces the spangram across the same NYT Strands grid, so you can see its exact route instead of guessing the path from the answer alone.</p>`,
      renderStrandsBoardHtml(result, "spangram"),
    ].join("\n"),
    `data-answer="${escapeHtml(result.spangram)}"`
  );
}

function renderStrandsThemeWordsHtml(result) {
  const items = result.themeWords.map((word) => `<li>${escapeHtml(word)}</li>`).join("");
  return renderStrandsRevealHtml(
    "Reveal Theme Words",
    [
      `<p>The solved grid below highlights the theme words in blue and the spangram in yellow, matching the way Strands separates the full answer set.</p>`,
      renderStrandsBoardHtml(result, "solution"),
      `<ul class="wp-block-list tn-strands-answer-list">${items}</ul>`,
    ].join("\n"),
    `data-answer-signature="${escapeHtml(buildStrandsAnswerSignature(result))}"`
  );
}

function replaceBlock(content, marker, replacementHtml) {
  const startMarker = `<!-- ${marker}_START -->`;
  const endMarker = `<!-- ${marker}_END -->`;
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Could not locate marker block ${marker}`);
  }
  return `${content.slice(0, startIndex + startMarker.length)}\n${replacementHtml}\n${content.slice(endIndex)}`;
}

function replaceInlineMarkerIfPresent(content, marker, replacementText) {
  const startMarker = `<!-- ${marker}_START -->`;
  const endMarker = `<!-- ${marker}_END -->`;
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return content;
  }
  return `${content.slice(0, startIndex + startMarker.length)}${replacementText}${content.slice(endIndex)}`;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status} for ${url}`);
  }
  return response.json();
}

async function fetchStrandsPayload(answerDate) {
  const url = `https://www.nytimes.com/svc/strands/v2/${answerDate}.json`;
  const payload = await requestJson(url);
  return {
    answerDate: payload.printDate,
    clue: String(payload.clue || "").trim(),
    spangram: normalizeAnswer(payload.spangram),
    spangramCoords: Array.isArray(payload.spangramCoords) ? payload.spangramCoords : [],
    themeWords: Array.isArray(payload.themeWords) ? payload.themeWords.map(normalizeAnswer) : [],
    themeCoords: Object.fromEntries(
      (Array.isArray(payload.themeWords) ? payload.themeWords : []).map((word, index) => [
        normalizeAnswer(word),
        Array.isArray(payload.themeCoords?.[word]) ? payload.themeCoords[word] : [],
      ])
    ),
    startingBoard: Array.isArray(payload.startingBoard) ? payload.startingBoard.map((row) => String(row).trim()) : [],
  };
}

async function fetchGwPost(authHeader) {
  return requestJson(`${GW_POST_ENDPOINT}?context=edit`, {
    headers: {
      Authorization: authHeader,
    },
  });
}

async function updateGwPost(authHeader, content) {
  return requestJson(GW_POST_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content,
    }),
  });
}

const localEnv = readEnvFile(".env");

async function main() {
  const answerDate = process.argv[2] || getCurrentIsoDate(NYT_TIMEZONE);
  const username = getEnv("GW_WORDPRESS_USERNAME");
  const password = getEnv("GW_WORDPRESS_APPLICATION_PASSWORD");
  const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  const result = await fetchStrandsPayload(answerDate);

  if (result.answerDate !== answerDate) {
    throw new Error(`Expected Strands payload for ${answerDate}, but received ${result.answerDate}`);
  }

  const post = await fetchGwPost(authHeader);
  let content = post.content?.raw || "";
  content = replaceBlock(content, "TN_STRANDS_SPANGRAM", renderStrandsSpangramHtml(result));
  content = replaceBlock(content, "TN_STRANDS_THEME_WORDS", renderStrandsThemeWordsHtml(result));
  content = replaceInlineMarkerIfPresent(content, "TN_STRANDS_CLUE", escapeHtml(result.clue));
  content = replaceInlineMarkerIfPresent(content, "TN_STRANDS_CURRENT_DATE", escapeHtml(result.answerDate));

  await updateGwPost(authHeader, content);

  const saved = await fetchGwPost(authHeader);
  const savedContent = saved.content?.raw || "";
  if (!savedContent.includes("<svg") || !savedContent.includes("TN_STRANDS_SPANGRAM_START")) {
    throw new Error("Saved content did not include the expected Strands visual markup.");
  }

  console.log(
    JSON.stringify(
      {
        postId: GW_POST_ID,
        answerDate: result.answerDate,
        clue: result.clue,
        spangram: result.spangram,
        themeWords: result.themeWords.length,
        updated: true,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
