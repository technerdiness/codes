/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as addManualNewsLink from "../addManualNewsLink.js";
import type * as articles from "../articles.js";
import type * as articlesInternal from "../articlesInternal.js";
import type * as auth from "../auth.js";
import type * as codes from "../codes.js";
import type * as collectGamingNews from "../collectGamingNews.js";
import type * as crons from "../crons.js";
import type * as gamingNews from "../gamingNews.js";
import type * as http from "../http.js";
import type * as letrosoAnswers from "../letrosoAnswers.js";
import type * as lib_providers_beebom from "../lib/providers/beebom.js";
import type * as lib_providers_beebomLetroso from "../lib/providers/beebomLetroso.js";
import type * as lib_providers_techwiser from "../lib/providers/techwiser.js";
import type * as lib_types from "../lib/types.js";
import type * as lib_wordpress from "../lib/wordpress.js";
import type * as nytAnswers from "../nytAnswers.js";
import type * as resolveWordpressPostId from "../resolveWordpressPostId.js";
import type * as syncCodes from "../syncCodes.js";
import type * as syncLetroso from "../syncLetroso.js";
import type * as syncNytPuzzles from "../syncNytPuzzles.js";
import type * as syncRuns from "../syncRuns.js";
import type * as wordpressState from "../wordpressState.js";
import type * as writeGamingNewsArticle from "../writeGamingNewsArticle.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  addManualNewsLink: typeof addManualNewsLink;
  articles: typeof articles;
  articlesInternal: typeof articlesInternal;
  auth: typeof auth;
  codes: typeof codes;
  collectGamingNews: typeof collectGamingNews;
  crons: typeof crons;
  gamingNews: typeof gamingNews;
  http: typeof http;
  letrosoAnswers: typeof letrosoAnswers;
  "lib/providers/beebom": typeof lib_providers_beebom;
  "lib/providers/beebomLetroso": typeof lib_providers_beebomLetroso;
  "lib/providers/techwiser": typeof lib_providers_techwiser;
  "lib/types": typeof lib_types;
  "lib/wordpress": typeof lib_wordpress;
  nytAnswers: typeof nytAnswers;
  resolveWordpressPostId: typeof resolveWordpressPostId;
  syncCodes: typeof syncCodes;
  syncLetroso: typeof syncLetroso;
  syncNytPuzzles: typeof syncNytPuzzles;
  syncRuns: typeof syncRuns;
  wordpressState: typeof wordpressState;
  writeGamingNewsArticle: typeof writeGamingNewsArticle;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
