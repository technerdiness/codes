export type ScrapeProvider = "beebom";

export interface ScrapedCode {
  code: string;
  status: "active";
  provider: ScrapeProvider;
  rewardsText?: string;
  isNew?: boolean;
}

export interface ExpiredCode {
  code: string;
  provider: ScrapeProvider;
}

export interface ScrapeResult {
  codes: ScrapedCode[];
  expiredCodes: ExpiredCode[];
}

export interface ArticleSourceInput {
  gameName: string;
  ourArticleUrl: string;
  beebomArticleUrl: string;
}
