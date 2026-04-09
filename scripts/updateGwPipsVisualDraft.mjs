import fs from "fs";

const GW_POST_ID = 4662;
const GW_POST_ENDPOINT = `https://www.gamingwize.com/wp-json/wp/v2/posts/${GW_POST_ID}`;
const NYT_TIMEZONE = "America/New_York";
const REGION_PALETTES = [
  {
    name: "purple",
    fill: "#c7a8c8",
    stroke: "#7617d6",
    badge: "#9251ca",
  },
  {
    name: "pink",
    fill: "#e49baa",
    stroke: "#c70042",
    badge: "#db137a",
  },
  {
    name: "teal",
    fill: "#a8bec4",
    stroke: "#006c7b",
    badge: "#008ea4",
  },
  {
    name: "orange",
    fill: "#ebbf97",
    stroke: "#b94b00",
    badge: "#d35a08",
  },
  {
    name: "navy",
    fill: "#b5b0bf",
    stroke: "#0c386a",
    badge: "#124076",
  },
  {
    name: "green",
    fill: "#bcb589",
    stroke: "#486700",
    badge: "#618200",
  },
];

function readEnvFile(pathname) {
  const env = {};
  const lines = fs.readFileSync(pathname, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) continue;
    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1);
    env[key] = value;
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

function getCurrentIsoDate(timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

function formatLongDate(isoDate) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

function coordKey(row, col) {
  return `${row},${col}`;
}

function coordLabel([row, col]) {
  return `R${row + 1}C${col + 1}`;
}

function buildAnswerSignature(difficulty) {
  return `${difficulty.id}::${difficulty.dominoes
    .map((domino, index) => {
      const [firstCell, secondCell] = difficulty.solution[index];
      return `${domino[0]}-${domino[1]}:${coordLabel(firstCell)}-${coordLabel(secondCell)}`;
    })
    .join("|")}`;
}

function buildCellMaps(difficulty) {
  const occupied = new Set();
  const regionIndexByCell = new Map();
  const rows = [];
  const cols = [];

  difficulty.regions.forEach((region, regionIndex) => {
    for (const [row, col] of region.indices) {
      occupied.add(coordKey(row, col));
      regionIndexByCell.set(coordKey(row, col), regionIndex);
      rows.push(row);
      cols.push(col);
    }
  });

  difficulty.solution.forEach(([firstCell, secondCell]) => {
    for (const [row, col] of [firstCell, secondCell]) {
      occupied.add(coordKey(row, col));
      rows.push(row);
      cols.push(col);
    }
  });

  const maxRow = Math.max(...rows);
  const maxCol = Math.max(...cols);

  let colorCursor = 0;
  const styledRegions = difficulty.regions.map((region) => {
    if (region.type === "empty") {
      return { ...region, palette: null };
    }
    const palette = REGION_PALETTES[colorCursor % REGION_PALETTES.length];
    colorCursor += 1;
    return { ...region, palette };
  });

  return {
    occupied,
    regionIndexByCell,
    styledRegions,
    maxRow,
    maxCol,
  };
}

function getBoardMetrics(maxRow, maxCol) {
  if (maxRow >= 7) {
    return { cell: 72, gap: 10, boardPad: 14, radius: 15, dashRadius: 15 };
  }
  if (maxCol >= 4) {
    return { cell: 76, gap: 10, boardPad: 14, radius: 16, dashRadius: 16 };
  }
  return { cell: 82, gap: 10, boardPad: 14, radius: 17, dashRadius: 17 };
}

function getCellTopLeft(row, col, metrics, originX, originY) {
  return {
    x: originX + col * (metrics.cell + metrics.gap),
    y: originY + row * (metrics.cell + metrics.gap),
  };
}

function renderLine(x1, y1, x2, y2, stroke) {
  return `<path d="M ${x1} ${y1} L ${x2} ${y2}" fill="none" stroke="${stroke}" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="10 10"/>`;
}

function renderArc(startX, startY, endX, endY, sweepFlag, radius, stroke) {
  return `<path d="M ${startX} ${startY} A ${radius} ${radius} 0 0 ${sweepFlag} ${endX} ${endY}" fill="none" stroke="${stroke}" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="10 10"/>`;
}

function renderRegionOutlines(context) {
  const segments = [];

  for (const region of context.styledRegions) {
    if (!region.palette) continue;
    const sameRegion = new Set(region.indices.map(([row, col]) => coordKey(row, col)));
    const stroke = region.palette.stroke;

    for (const [row, col] of region.indices) {
      const { x, y } = getCellTopLeft(row, col, context.metrics, context.originX, context.originY);
      const top = !sameRegion.has(coordKey(row - 1, col));
      const right = !sameRegion.has(coordKey(row, col + 1));
      const bottom = !sameRegion.has(coordKey(row + 1, col));
      const left = !sameRegion.has(coordKey(row, col - 1));
      const r = context.metrics.dashRadius;
      const size = context.metrics.cell;

      if (top) {
        segments.push(renderLine(x + r, y, x + size - r, y, stroke));
      }
      if (right) {
        segments.push(renderLine(x + size, y + r, x + size, y + size - r, stroke));
      }
      if (bottom) {
        segments.push(renderLine(x + r, y + size, x + size - r, y + size, stroke));
      }
      if (left) {
        segments.push(renderLine(x, y + r, x, y + size - r, stroke));
      }

      if (top && left) {
        segments.push(renderArc(x + r, y, x, y + r, 0, r, stroke));
      }
      if (top && right) {
        segments.push(renderArc(x + size - r, y, x + size, y + r, 1, r, stroke));
      }
      if (bottom && right) {
        segments.push(renderArc(x + size, y + size - r, x + size - r, y + size, 1, r, stroke));
      }
      if (bottom && left) {
        segments.push(renderArc(x + r, y + size, x, y + size - r, 1, r, stroke));
      }

      const rightNeighbor = sameRegion.has(coordKey(row, col + 1));
      const bottomNeighbor = sameRegion.has(coordKey(row + 1, col));

      if (rightNeighbor) {
        const neighborTop = !sameRegion.has(coordKey(row - 1, col + 1));
        const neighborBottom = !sameRegion.has(coordKey(row + 1, col + 1));
        if (top && neighborTop) {
          const start = x + size - r;
          const end = x + size + context.metrics.gap + r;
          segments.push(renderLine(start, y, end, y, stroke));
        }
        if (bottom && neighborBottom) {
          const start = x + size - r;
          const end = x + size + context.metrics.gap + r;
          segments.push(renderLine(start, y + size, end, y + size, stroke));
        }
      }

      if (bottomNeighbor) {
        const neighborLeft = !sameRegion.has(coordKey(row + 1, col - 1));
        const neighborRight = !sameRegion.has(coordKey(row + 1, col + 1));
        if (left && neighborLeft) {
          const start = y + size - r;
          const end = y + size + context.metrics.gap + r;
          segments.push(renderLine(x, start, x, end, stroke));
        }
        if (right && neighborRight) {
          const start = y + size - r;
          const end = y + size + context.metrics.gap + r;
          segments.push(renderLine(x + size, start, x + size, end, stroke));
        }
      }
    }
  }

  return segments.join("");
}

function getClueLabel(region) {
  if (region.type === "equals") return "=";
  if (region.type === "unequal") return "&#8800;";
  if (region.type === "sum") return String(region.target);
  if (region.type === "greater") return `&gt;${region.target}`;
  if (region.type === "less") return `&lt;${region.target}`;
  return "";
}

function getLabelPlacement(region, occupied, maxRow) {
  const anchor = [...region.indices].sort((a, b) => {
    if (a[0] !== b[0]) return b[0] - a[0];
    return b[1] - a[1];
  })[0];
  const [row, col] = anchor;
  const belowOpen = !occupied.has(coordKey(row + 1, col));
  const placement = row === maxRow || belowOpen ? "bottom" : "right";
  return { anchor, placement };
}

function renderBadge(label, centerX, centerY, palette) {
  const squareSide = 40;
  const fontSize = label.length >= 3 ? 18 : label.length === 2 ? 22 : 30;
  const diamondTransform = `rotate(45 ${centerX} ${centerY})`;
  return [
    `<g>`,
    `<rect x="${centerX - squareSide / 2}" y="${centerY - squareSide / 2}" width="${squareSide}" height="${squareSide}" rx="7" fill="${palette.badge}" transform="${diamondTransform}"/>`,
    `<text x="${centerX}" y="${centerY + 0.5}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}" font-weight="800" fill="#ffffff" font-family="Arial, Helvetica, sans-serif">${label}</text>`,
    `</g>`,
  ].join("");
}

function renderClueBadges(context) {
  const badges = [];

  for (const region of context.styledRegions) {
    if (!region.palette || region.type === "empty") continue;
    const label = getClueLabel(region);
    const { anchor, placement } = getLabelPlacement(region, context.occupied, context.maxRow);
    const { x, y } = getCellTopLeft(anchor[0], anchor[1], context.metrics, context.originX, context.originY);
    const cornerX = x + context.metrics.cell;
    const cornerY = y + context.metrics.cell;
    const centerX = placement === "right" ? cornerX + 18 : cornerX - 18;
    const centerY = placement === "right" ? cornerY - 18 : cornerY + 18;
    badges.push(renderBadge(label, centerX, centerY, region.palette));
  }

  return badges.join("");
}

function pipOffsets(value, spreadX, spreadY) {
  const left = -spreadX;
  const center = 0;
  const right = spreadX;
  const top = -spreadY;
  const middle = 0;
  const bottom = spreadY;
  switch (value) {
    case 0:
      return [];
    case 1:
      return [[center, middle]];
    case 2:
      return [[left, top], [right, bottom]];
    case 3:
      return [[left, top], [center, middle], [right, bottom]];
    case 4:
      return [[left, top], [right, top], [left, bottom], [right, bottom]];
    case 5:
      return [[left, top], [right, top], [center, middle], [left, bottom], [right, bottom]];
    case 6:
      return [
        [left, top],
        [right, top],
        [left, middle],
        [right, middle],
        [left, bottom],
        [right, bottom],
      ];
    default:
      return [];
  }
}

function renderDominoes(context) {
  const output = [];
  const inset = Math.round(context.metrics.cell * 0.12);
  const pipRadius = Math.max(3.5, context.metrics.cell * 0.055);
  const spreadX = context.metrics.cell * 0.15;
  const spreadY = context.metrics.cell * 0.15;

  context.difficulty.dominoes.forEach((domino, index) => {
    const [firstCell, secondCell] = context.difficulty.solution[index];
    const [r1, c1] = firstCell;
    const [r2, c2] = secondCell;
    const firstPos = getCellTopLeft(r1, c1, context.metrics, context.originX, context.originY);
    const secondPos = getCellTopLeft(r2, c2, context.metrics, context.originX, context.originY);
    const horizontal = r1 === r2;
    const x = Math.min(firstPos.x, secondPos.x) + inset;
    const y = Math.min(firstPos.y, secondPos.y) + inset;
    const width = horizontal
      ? context.metrics.cell * 2 + context.metrics.gap - inset * 2
      : context.metrics.cell - inset * 2;
    const height = horizontal
      ? context.metrics.cell - inset * 2
      : context.metrics.cell * 2 + context.metrics.gap - inset * 2;
    const dividerX = horizontal
      ? Math.min(firstPos.x, secondPos.x) + context.metrics.cell + context.metrics.gap / 2
      : null;
    const dividerY = horizontal
      ? null
      : Math.min(firstPos.y, secondPos.y) + context.metrics.cell + context.metrics.gap / 2;

    output.push(
      `<g>`,
      `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${Math.max(
        11,
        context.metrics.radius - 3
      )}" fill="#f6f6f6" stroke="#444444" stroke-width="3"/>`
    );

    if (horizontal) {
      output.push(
        `<path d="M ${dividerX} ${y + 8} L ${dividerX} ${y + height - 8}" fill="none" stroke="#e2dbdb" stroke-width="3" stroke-linecap="round"/>`
      );
    } else {
      output.push(
        `<path d="M ${x + 8} ${dividerY} L ${x + width - 8} ${dividerY}" fill="none" stroke="#e2dbdb" stroke-width="3" stroke-linecap="round"/>`
      );
    }

    [firstCell, secondCell].forEach(([row, col], valueIndex) => {
      const center = {
        x:
          context.originX +
          col * (context.metrics.cell + context.metrics.gap) +
          context.metrics.cell / 2,
        y:
          context.originY +
          row * (context.metrics.cell + context.metrics.gap) +
          context.metrics.cell / 2,
      };
      pipOffsets(domino[valueIndex], spreadX, spreadY).forEach(([dx, dy]) => {
        output.push(
          `<circle cx="${center.x + dx}" cy="${center.y + dy}" r="${pipRadius}" fill="#2c2c2c"/>`
        );
      });
    });

    output.push(`</g>`);
  });

  return output.join("");
}

function renderBoardSvg(difficultyName, answerDate, difficulty) {
  const { occupied, regionIndexByCell, styledRegions, maxRow, maxCol } = buildCellMaps(difficulty);
  const metrics = getBoardMetrics(maxRow, maxCol);
  const originX = 30;
  const originY = 30;
  const gridWidth = (maxCol + 1) * metrics.cell + maxCol * metrics.gap;
  const gridHeight = (maxRow + 1) * metrics.cell + maxRow * metrics.gap;
  const svgWidth = originX + gridWidth + 86;
  const svgHeight = originY + gridHeight + 86;

  const context = {
    difficulty,
    occupied,
    regionIndexByCell,
    styledRegions,
    maxRow,
    maxCol,
    metrics,
    originX,
    originY,
  };

  const cells = [];
  for (let row = 0; row <= maxRow; row += 1) {
    for (let col = 0; col <= maxCol; col += 1) {
      const key = coordKey(row, col);
      if (!occupied.has(key)) continue;
      const regionIndex = regionIndexByCell.get(key);
      const region = regionIndex === undefined ? null : styledRegions[regionIndex];
      const palette = region?.palette ?? null;
      const { x, y } = getCellTopLeft(row, col, metrics, originX, originY);
      cells.push(
        `<rect x="${x}" y="${y}" width="${metrics.cell}" height="${metrics.cell}" rx="${metrics.radius}" fill="#e1cbc5"/>`
      );
      if (palette) {
        cells.push(
          `<rect x="${x}" y="${y}" width="${metrics.cell}" height="${metrics.cell}" rx="${metrics.radius}" fill="${palette.fill}"/>`
        );
      }
    }
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" role="img" aria-label="${escapeHtml(
      `Solved ${difficultyName} NYT Pips board for ${formatLongDate(answerDate)}`
    )}">`,
    `<rect x="${originX - metrics.boardPad}" y="${originY - metrics.boardPad}" width="${gridWidth + metrics.boardPad * 2}" height="${
      gridHeight + metrics.boardPad * 2
    }" rx="26" fill="#dbc2b9"/>`,
    cells.join(""),
    renderRegionOutlines(context),
    renderDominoes(context),
    renderClueBadges(context),
    `</svg>`,
  ].join("");

  return svg;
}

function renderPlacementList(difficulty) {
  return difficulty.dominoes
    .map((domino, index) => {
      const [firstCell, secondCell] = difficulty.solution[index];
      const firstValue = domino[0];
      const secondValue = domino[1];

      if (firstValue === secondValue) {
        return `<li><strong>${firstValue}-${secondValue}:</strong> ${firstValue}s fill ${coordLabel(
          firstCell
        )} and ${coordLabel(secondCell)}.</li>`;
      }

      return `<li><strong>${firstValue}-${secondValue}:</strong> ${firstValue} goes in ${coordLabel(
        firstCell
      )}, and ${secondValue} goes in ${coordLabel(secondCell)}.</li>`;
    })
    .join("");
}

function renderDifficultyIntro(difficultyName) {
  if (difficultyName === "Easy") {
    return "The solved board below keeps the NYT region layout intact, so you can compare the answer without decoding raw coordinates first.";
  }
  if (difficultyName === "Medium") {
    return "This version works best as a visual cross-check: the clue regions stay in place, and every finished domino sits exactly where it belongs.";
  }
  return "Hard Pips is much easier to verify when the full board is visible, so the answer below pairs the NYT-style board with the exact solved placement of every domino.";
}

function renderDifficultyBlock(difficultyName, answerDate, difficulty) {
  const answerSignature = buildAnswerSignature(difficulty);
  const svg = renderBoardSvg(difficultyName, answerDate, difficulty);
  const placementList = renderPlacementList(difficulty);

  return [
    `<style>`,
    `.tn-pips-answer-reveal{margin:1rem 0;}`,
    `.tn-pips-answer-reveal summary{display:inline-flex;align-items:center;justify-content:center;padding:.8rem 1.25rem;border:0;border-radius:999px;background:#111827;color:#fff;font-weight:700;cursor:pointer;list-style:none;}`,
    `.tn-pips-answer-reveal summary::-webkit-details-marker{display:none;}`,
    `.tn-pips-answer-reveal[open] summary{display:none;}`,
    `.tn-pips-answer-reveal__content{margin-top:1rem;padding:1rem 1.1rem;border:1px solid #e5e7eb;border-radius:16px;background:#f9fafb;}`,
    `.tn-pips-answer-reveal__content p:last-child,.tn-pips-answer-reveal__content ul:last-child,.tn-pips-answer-reveal__content ol:last-child{margin-bottom:0;}`,
    `.tn-pips-answer-figure{margin:1rem 0;overflow-x:auto;-webkit-overflow-scrolling:touch;}`,
    `.tn-pips-answer-figure svg{display:block;width:100%;height:auto;min-width:280px;}`,
    `.tn-pips-answer-list{margin-top:1rem;}`,
    `.tn-pips-answer-list li{margin:.4rem 0;}`,
    `</style>`,
    `<details class="tn-pips-answer-reveal" data-answer-signature="${escapeHtml(answerSignature)}">`,
    `<summary>Reveal ${difficultyName} Solution</summary>`,
    `<div class="tn-pips-answer-reveal__content">`,
    `<p><strong>${difficultyName} puzzle #${difficulty.id}</strong></p>`,
    `<p>${renderDifficultyIntro(difficultyName)}</p>`,
    `<div class="tn-pips-answer-figure">${svg}</div>`,
    `<p>The placement list below matches the solved board cell by cell, so you can confirm one domino at a time if you would rather not scan the whole puzzle at once.</p>`,
    `<ul class="wp-block-list tn-pips-answer-list">${placementList}</ul>`,
    `</div>`,
    `</details>`,
  ].join("");
}

function replaceBlock(content, marker, replacementHtml) {
  const startMarker = `<!-- ${marker}_START -->`;
  const endMarker = `<!-- ${marker}_END -->`;
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Could not locate marker block ${marker}`);
  }

  const before = content.slice(0, startIndex + startMarker.length);
  const after = content.slice(endIndex);
  return `${before}\n${replacementHtml}\n${after}`;
}

function replaceInlineMarker(content, marker, replacementText) {
  const startMarker = `<!-- ${marker}_START -->`;
  const endMarker = `<!-- ${marker}_END -->`;
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Could not locate inline marker block ${marker}`);
  }

  return `${content.slice(0, startIndex + startMarker.length)}${replacementText}${content.slice(endIndex)}`;
}

function updateHowToReadParagraph(content) {
  const oldParagraph =
    "<p>Start with the current puzzle date below, then open only the difficulty you are solving. Inside each reveal, matching letters mark the two cells occupied by the same domino and the coordinate list tells you exactly where each piece belongs.</p>";
  const newParagraph =
    "<p>Start with the current puzzle date below, then open only the difficulty you are solving. Each reveal shows the solved board in the same visual layout as NYT Pips, followed by a placement list that spells out where every domino half goes.</p>";

  if (!content.includes(oldParagraph)) {
    throw new Error("Could not find the existing Pips reading guide paragraph to update.");
  }

  return content.replace(oldParagraph, newParagraph);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status} for ${url}`);
  }
  return response.json();
}

async function fetchPipsPayload(answerDate) {
  const url = `https://www.nytimes.com/svc/pips/v1/${answerDate}.json`;
  return requestJson(url);
}

async function fetchGwPostContent(authHeader) {
  const post = await requestJson(`${GW_POST_ENDPOINT}?context=edit`, {
    headers: {
      Authorization: authHeader,
    },
  });

  if (!post?.content?.raw) {
    throw new Error("GamingWize draft did not include content.raw");
  }

  return post.content.raw;
}

async function updateGwPostContent(authHeader, content) {
  return requestJson(GW_POST_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content,
      status: "draft",
    }),
  });
}

function verifySavedMarkup(content) {
  const requiredSnippets = [
    "Reveal Easy Solution",
    "Reveal Medium Solution",
    "Reveal Hard Solution",
    "The placement list below matches the solved board cell by cell",
    "<svg",
  ];

  for (const snippet of requiredSnippets) {
    if (!content.includes(snippet)) {
      throw new Error(`Saved WordPress content is missing expected snippet: ${snippet}`);
    }
  }
}

const localEnv = readEnvFile(".env");

async function main() {
  const answerDate = process.argv[2] || getCurrentIsoDate(NYT_TIMEZONE);
  const gwUsername = getEnv("GW_WORDPRESS_USERNAME");
  const gwPassword = getEnv("GW_WORDPRESS_APPLICATION_PASSWORD");
  const authHeader = `Basic ${Buffer.from(`${gwUsername}:${gwPassword}`).toString("base64")}`;
  const payload = await fetchPipsPayload(answerDate);

  if (payload.printDate !== answerDate) {
    throw new Error(
      `Expected NYT Pips payload for ${answerDate}, but the live endpoint returned ${payload.printDate}`
    );
  }

  let updatedContent = await fetchGwPostContent(authHeader);
  updatedContent = updateHowToReadParagraph(updatedContent);
  updatedContent = replaceInlineMarker(updatedContent, "TN_PIPS_CURRENT_DATE", formatLongDate(payload.printDate));
  updatedContent = replaceBlock(updatedContent, "TN_PIPS_EASY", renderDifficultyBlock("Easy", payload.printDate, payload.easy));
  updatedContent = replaceBlock(
    updatedContent,
    "TN_PIPS_MEDIUM",
    renderDifficultyBlock("Medium", payload.printDate, payload.medium)
  );
  updatedContent = replaceBlock(updatedContent, "TN_PIPS_HARD", renderDifficultyBlock("Hard", payload.printDate, payload.hard));

  await updateGwPostContent(authHeader, updatedContent);

  const savedContent = await fetchGwPostContent(authHeader);
  verifySavedMarkup(savedContent);

  console.log(
    JSON.stringify(
      {
        postId: GW_POST_ID,
        answerDate: payload.printDate,
        easyPuzzleId: payload.easy.id,
        mediumPuzzleId: payload.medium.id,
        hardPuzzleId: payload.hard.id,
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
