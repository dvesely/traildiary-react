// Source - https://stackoverflow.com/a/39914235
// Posted by Dan Dascalescu, modified by community. See post 'Timeline' for change history
// Retrieved 2026-02-21, License - CC BY-SA 4.0

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
