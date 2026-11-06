// Ambient declarations that let `tsc` type-check the edge functions (tsconfig.functions.json).
// The functions run on Deno and import their dependencies by URL, which tsc cannot fetch, so each
// remote module is declared here. This file must stay a plain script (no top-level import or
// export), or the `declare module` blocks below become augmentations and stop working.

// Only the parts of Deno the functions use. A connection is what the malware scanner talks to clamd over.
interface DenoConn {
  write(p: Uint8Array): Promise<number>;
  read(p: Uint8Array): Promise<number | null>;
  close(): void;
}
declare const Deno: {
  env: { get(name: string): string | undefined };
  connect(options: { hostname: string; port: number }): Promise<DenoConn>;
  connectTls(options: { hostname: string; port: number }): Promise<DenoConn>;
};

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

// The same package the front end installs, so the functions are checked against real client types.
declare module "https://esm.sh/@supabase/supabase-js@2.100.0" {
  export * from "@supabase/supabase-js";
}

// Only the parts of SheetJS that document-extract/read.ts uses. Extend it when that file uses more.
declare module "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs" {
  export interface WorkSheet {
    "!ref"?: string;
    /** The declared range when sheetRows cut "!ref" short. */
    "!fullref"?: string;
    [cell: string]: unknown;
  }
  export interface WorkBook {
    SheetNames: string[];
    Sheets: Record<string, WorkSheet>;
  }
  export function read(data: string | Uint8Array, opts: { type: "string" | "array"; raw?: boolean; cellDates?: boolean; sheetRows?: number }): WorkBook;
  export const utils: {
    decode_range(ref: string): { s: { r: number; c: number }; e: { r: number; c: number } };
    sheet_to_json<T>(
      ws: WorkSheet,
      opts?: { header?: 1; raw?: boolean; defval?: unknown; blankrows?: boolean; range?: { s: { r: number; c: number }; e: { r: number; c: number } } },
    ): T[];
  };
}

// Any other remote import resolves to an untyped module: the check still catches a duplicate
// declaration, an undefined name or a bad local import, but not a wrong call into that package.
declare module "https://*";
declare module "npm:*";
