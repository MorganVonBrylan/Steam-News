
export {}

declare global {

  interface Set {
    join(separator:string): string;
  }

  const error: typeof import("./utils/error.js").default;
  const tr: typeof import("./localization/index.js").default;
  type TranslatorFunction = import("./localization/index.js").TranslatorFunction;
}
