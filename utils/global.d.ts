
export {}

declare global {

  interface FunctionConstructor {
    noop: () => void;
  }
  interface ObjectConstructor {
    null: Readonly<{}>;
  }
  interface Set {
    join(separator:string): string;
  }

  const error: typeof import("./error.js").default;
  const tr: typeof import("../localization/index.js").default;
  type TranslatorFunction = import("../localization/index.js").TranslatorFunction;
}
