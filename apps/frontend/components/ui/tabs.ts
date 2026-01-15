// TypeScript shim: TS doesn't always resolve platform extensions like .web.tsx/.native.tsx.
// Metro will still pick `tabs.web.tsx` / `tabs.native.tsx` at runtime.
export * from "./tabs.web";


