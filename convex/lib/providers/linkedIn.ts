"use node";

import type { ZipAnswerResult, ZipWall } from "../types";

export interface CrossclimbAnswerResult {
  sourceUrl: string;
  fetchedAt: string;
  answerDate: string;
  puzzleId: number;
  words: string[];  // ordered top to bottom
  clues: string[];  // matching each word
  extractedFrom: "linkedin:voyager-api";
}

export interface QueensAnswerResult {
  sourceUrl: string;
  fetchedAt: string;
  answerDate: string;
  puzzleId: number;
  gridSize: number;
  solution: { row: number; col: number }[];  // one queen per color region
  colorGrid: number[];  // flat row-major, each value = color index
  extractedFrom: "linkedin:voyager-api";
}

export interface TangoAnswerResult {
  sourceUrl: string;
  fetchedAt: string;
  answerDate: string;
  puzzleId: number;
  gridSize: number;
  solution: string[];  // "ZERO" | "ONE" per cell, row-major
  presetCellIdxes: number[];
  edges: { startIdx: number; endIdx: number; isEqual: boolean }[];  // constraint edges between adjacent cells
  extractedFrom: "linkedin:voyager-api";
}

export interface MiniSudokuAnswerResult {
  sourceUrl: string;
  fetchedAt: string;
  answerDate: string;
  puzzleId: number;
  name: string;
  gridRowSize: number;
  gridColSize: number;
  solution: number[];  // flat row-major, values 1–N
  presetCellIdxes: number[];
  extractedFrom: "linkedin:voyager-api";
}

const VOYAGER_QUERY_ID = "voyagerIdentityDashGames.882556aa369e9517b26dadb09a426063";
const VOYAGER_BASE_URL = "https://www.linkedin.com/voyager/api/graphql";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ── Auth helpers ───────────────────────────────────────────────────────────

async function getJsessionId(gamePageUrl: string, liAt: string): Promise<string> {
  const response = await fetch(gamePageUrl, {
    headers: {
      cookie: `li_at=${liAt}`,
      "user-agent": USER_AGENT,
    },
    redirect: "follow",
  });

  // Node 18+ fetch returns headers with getSetCookie()
  const setCookies: string[] =
    typeof (response.headers as any).getSetCookie === "function"
      ? (response.headers as any).getSetCookie()
      : [response.headers.get("set-cookie") ?? ""];

  for (const header of setCookies) {
    const match = header.match(/JSESSIONID="?([^;,"]+)"?/i);
    if (match) {
      return match[1].replace(/^"(.*)"$/, "$1");
    }
  }

  throw new Error(
    `Could not extract JSESSIONID from ${gamePageUrl} (HTTP ${response.status}). ` +
      `Check that LINKEDIN_LI_AT is set and valid.`
  );
}

async function fetchVoyagerGame(
  gameTypeId: number,
  liAt: string,
  jsessionId: string
): Promise<Record<string, unknown>> {
  const url = `${VOYAGER_BASE_URL}?includeWebMetadata=true&variables=(gameTypeId:${gameTypeId})&queryId=${VOYAGER_QUERY_ID}`;

  const response = await fetch(url, {
    headers: {
      cookie: `li_at=${liAt}; JSESSIONID="${jsessionId}"`,
      "csrf-token": jsessionId,
      "user-agent": USER_AGENT,
      accept: "application/vnd.linkedin.normalized+json+2.1",
      "x-restli-protocol-version": "2.0.0",
    },
  });

  if (!response.ok) {
    throw new Error(`LinkedIn Voyager API returned ${response.status} for gameTypeId=${gameTypeId}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

// ── Zip (gameTypeId 6) ─────────────────────────────────────────────────────

const ZIP_GAME_TYPE_ID = 6;
const ZIP_GAME_PAGE_URL = "https://www.linkedin.com/games/view/zip/desktop/";

function parseZipWalls(rawWalls: unknown[]): ZipWall[] {
  return rawWalls
    .filter((w): w is Record<string, unknown> => typeof w === "object" && w !== null)
    .map((w) => ({
      cellIdx: Number(w.cellIdx ?? w.cell_idx ?? 0),
      direction: String(w.direction ?? "RIGHT") as ZipWall["direction"],
    }));
}

export async function revealZipAnswer(liAt: string): Promise<ZipAnswerResult> {
  const fetchedAt = new Date().toISOString();

  const jsessionId = await getJsessionId(ZIP_GAME_PAGE_URL, liAt);
  const data = await fetchVoyagerGame(ZIP_GAME_TYPE_ID, liAt, jsessionId);

  const included = (data.included ?? []) as Record<string, unknown>[];

  // Find the entry that has gamePuzzle
  const gamePuzzleEntry = included.find(
    (item) => item.gamePuzzle && typeof item.gamePuzzle === "object"
  );
  if (!gamePuzzleEntry) {
    throw new Error("No gamePuzzle found in LinkedIn Voyager API response for Zip");
  }

  const gamePuzzle = gamePuzzleEntry.gamePuzzle as Record<string, unknown>;
  const trailPuzzle = gamePuzzle.trailGamePuzzle as Record<string, unknown>;
  if (!trailPuzzle) {
    throw new Error("No trailGamePuzzle found in gamePuzzle response");
  }

  const puzzleId = Number(gamePuzzleEntry.puzzleId ?? 0);
  const gridSize = Number(trailPuzzle.gridSize ?? trailPuzzle.grid_size ?? 0);
  const solution = (trailPuzzle.solution ?? []) as number[];
  const orderedSequence = (trailPuzzle.orderedSequence ?? trailPuzzle.ordered_sequence ?? []) as number[];
  const rawWalls = (trailPuzzle.walls ?? []) as unknown[];

  // Extract answer date from playedOn field if available
  const playedOn = (trailPuzzle.playedOn ?? gamePuzzle.playedOn) as Record<string, unknown> | undefined;
  let answerDate = fetchedAt.slice(0, 10); // fallback: today UTC
  if (playedOn && playedOn.year && playedOn.month && playedOn.day) {
    const y = Number(playedOn.year);
    const m = String(Number(playedOn.month)).padStart(2, "0");
    const d = String(Number(playedOn.day)).padStart(2, "0");
    answerDate = `${y}-${m}-${d}`;
  }

  return {
    sourceUrl: `${VOYAGER_BASE_URL}?variables=(gameTypeId:${ZIP_GAME_TYPE_ID})`,
    fetchedAt,
    answerDate,
    puzzleId,
    gridSize,
    solution: solution.map(Number),
    orderedSequence: orderedSequence.map(Number),
    walls: parseZipWalls(rawWalls),
    extractedFrom: "linkedin:voyager-api",
  };
}

// ── Shared helpers ─────────────────────────────────────────────────────────

function extractPuzzleEntry(data: Record<string, unknown>, gameName: string): {
  entry: Record<string, unknown>;
  gamePuzzle: Record<string, unknown>;
  puzzleId: number;
  answerDate: string;
  fetchedAt: string;
} {
  const fetchedAt = new Date().toISOString();
  const included = (data.included ?? []) as Record<string, unknown>[];
  const entry = included.find((item) => item.gamePuzzle && typeof item.gamePuzzle === "object");
  if (!entry) throw new Error(`No gamePuzzle found in Voyager API response for ${gameName}`);
  const gamePuzzle = entry.gamePuzzle as Record<string, unknown>;
  const puzzleId = Number(entry.puzzleId ?? entry.id ?? 0);

  const playedOn = entry.playedOn as Record<string, unknown> | undefined;
  let answerDate = fetchedAt.slice(0, 10);
  if (playedOn?.year && playedOn?.month && playedOn?.day) {
    const y = Number(playedOn.year);
    const m = String(Number(playedOn.month)).padStart(2, "0");
    const d = String(Number(playedOn.day)).padStart(2, "0");
    answerDate = `${y}-${m}-${d}`;
  }

  return { entry, gamePuzzle, puzzleId, answerDate, fetchedAt };
}

// ── Crossclimb (gameTypeId 2) ───────────────────────────────────────────────

const CROSSCLIMB_GAME_TYPE_ID = 2;
const CROSSCLIMB_GAME_PAGE_URL = "https://www.linkedin.com/games/view/crossclimb/desktop/";

export async function revealCrossclimbAnswer(liAt: string): Promise<CrossclimbAnswerResult> {
  const fetchedAt = new Date().toISOString();
  const jsessionId = await getJsessionId(CROSSCLIMB_GAME_PAGE_URL, liAt);
  const data = await fetchVoyagerGame(CROSSCLIMB_GAME_TYPE_ID, liAt, jsessionId);
  const { gamePuzzle, puzzleId, answerDate } = extractPuzzleEntry(data, "Crossclimb");

  const crossClimbPuzzle = gamePuzzle.crossClimbGamePuzzle as Record<string, unknown>;
  if (!crossClimbPuzzle) throw new Error("No crossClimbGamePuzzle in response");

  const rungs = (crossClimbPuzzle.rungs ?? []) as Record<string, unknown>[];
  const ordered = [...rungs].sort((a, b) => Number(a.solutionRungIndex ?? 0) - Number(b.solutionRungIndex ?? 0));
  const words = ordered.map((r) => String(r.word ?? ""));
  const clues = ordered.map((r) => String(r.clue ?? ""));

  return {
    sourceUrl: `${VOYAGER_BASE_URL}?variables=(gameTypeId:${CROSSCLIMB_GAME_TYPE_ID})`,
    fetchedAt,
    answerDate,
    puzzleId,
    words,
    clues,
    extractedFrom: "linkedin:voyager-api",
  };
}

// ── Queens (gameTypeId 3) ───────────────────────────────────────────────────

const QUEENS_GAME_TYPE_ID = 3;
const QUEENS_GAME_PAGE_URL = "https://www.linkedin.com/games/view/queens/desktop/";

export async function revealQueensAnswer(liAt: string): Promise<QueensAnswerResult> {
  const fetchedAt = new Date().toISOString();
  const jsessionId = await getJsessionId(QUEENS_GAME_PAGE_URL, liAt);
  const data = await fetchVoyagerGame(QUEENS_GAME_TYPE_ID, liAt, jsessionId);
  const { gamePuzzle, puzzleId, answerDate } = extractPuzzleEntry(data, "Queens");

  const queensPuzzle = gamePuzzle.queensGamePuzzle as Record<string, unknown>;
  if (!queensPuzzle) throw new Error("No queensGamePuzzle in response");

  const gridSize = Number(queensPuzzle.gridSize ?? 0);
  const rawSolution = (queensPuzzle.solution ?? []) as Record<string, unknown>[];
  const solution = rawSolution.map((s) => ({ row: Number(s.row), col: Number(s.col) }));

  const rawColorGrid = (queensPuzzle.colorGrid ?? []) as Record<string, unknown>[];
  const colorGrid = rawColorGrid.flatMap((row) => (row.colors as number[] ?? []));

  return {
    sourceUrl: `${VOYAGER_BASE_URL}?variables=(gameTypeId:${QUEENS_GAME_TYPE_ID})`,
    fetchedAt,
    answerDate,
    puzzleId,
    gridSize,
    solution,
    colorGrid,
    extractedFrom: "linkedin:voyager-api",
  };
}

// ── Tango (gameTypeId 5) ────────────────────────────────────────────────────

const TANGO_GAME_TYPE_ID = 5;
const TANGO_GAME_PAGE_URL = "https://www.linkedin.com/games/view/tango/desktop/";

export async function revealTangoAnswer(liAt: string): Promise<TangoAnswerResult> {
  const fetchedAt = new Date().toISOString();
  const jsessionId = await getJsessionId(TANGO_GAME_PAGE_URL, liAt);
  const data = await fetchVoyagerGame(TANGO_GAME_TYPE_ID, liAt, jsessionId);
  const { gamePuzzle, puzzleId, answerDate } = extractPuzzleEntry(data, "Tango");

  const lotkaPuzzle = gamePuzzle.lotkaGamePuzzle as Record<string, unknown>;
  if (!lotkaPuzzle) throw new Error("No lotkaGamePuzzle in response");

  const rawEdges = (lotkaPuzzle.edges ?? []) as Record<string, unknown>[];
  const edges = rawEdges.map((e) => ({
    startIdx: Number(e.startIdx ?? e.start_idx ?? 0),
    endIdx: Number(e.endIdx ?? e.end_idx ?? 0),
    isEqual: Boolean(e.isEqual ?? e.is_equal ?? false),
  }));

  return {
    sourceUrl: `${VOYAGER_BASE_URL}?variables=(gameTypeId:${TANGO_GAME_TYPE_ID})`,
    fetchedAt,
    answerDate,
    puzzleId,
    gridSize: Number(lotkaPuzzle.gridSize ?? 0),
    solution: (lotkaPuzzle.solution ?? []) as string[],
    presetCellIdxes: (lotkaPuzzle.presetCellIdxes ?? []) as number[],
    edges,
    extractedFrom: "linkedin:voyager-api",
  };
}

// ── Mini Sudoku (gameTypeId 7) ──────────────────────────────────────────────

const MINI_SUDOKU_GAME_TYPE_ID = 7;
const MINI_SUDOKU_GAME_PAGE_URL = "https://www.linkedin.com/games/view/mini-sudoku/desktop/";

export async function revealMiniSudokuAnswer(liAt: string): Promise<MiniSudokuAnswerResult> {
  const fetchedAt = new Date().toISOString();
  const jsessionId = await getJsessionId(MINI_SUDOKU_GAME_PAGE_URL, liAt);
  const data = await fetchVoyagerGame(MINI_SUDOKU_GAME_TYPE_ID, liAt, jsessionId);
  const { gamePuzzle, puzzleId, answerDate } = extractPuzzleEntry(data, "Mini Sudoku");

  const sudokuPuzzle = gamePuzzle.miniSudokuGamePuzzle as Record<string, unknown>;
  if (!sudokuPuzzle) throw new Error("No miniSudokuGamePuzzle in response");

  return {
    sourceUrl: `${VOYAGER_BASE_URL}?variables=(gameTypeId:${MINI_SUDOKU_GAME_TYPE_ID})`,
    fetchedAt,
    answerDate,
    puzzleId,
    name: String(sudokuPuzzle.name ?? ""),
    gridRowSize: Number(sudokuPuzzle.gridRowSize ?? 0),
    gridColSize: Number(sudokuPuzzle.gridColSize ?? 0),
    solution: (sudokuPuzzle.solution ?? []) as number[],
    presetCellIdxes: (sudokuPuzzle.presetCellIdxes ?? []) as number[],
    extractedFrom: "linkedin:voyager-api",
  };
}
