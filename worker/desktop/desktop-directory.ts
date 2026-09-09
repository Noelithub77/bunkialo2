import { DurableObject } from "cloudflare:workers";

type PairingRow = {
  session_id: string;
};

export class DesktopDirectory extends DurableObject<CloudflareBindings> {
  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS desktop_pairings (
          pairing_key TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);
    });
  }

  link(pairingKey: string, sessionId: string): void {
    this.ctx.storage.sql.exec(
      `INSERT INTO desktop_pairings (pairing_key, session_id, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(pairing_key) DO UPDATE SET
         session_id = excluded.session_id,
         updated_at = excluded.updated_at`,
      pairingKey,
      sessionId,
      Date.now(),
    );
  }

  resolve(pairingKey: string): string | null {
    const row = this.ctx.storage.sql
      .exec<PairingRow>(
        "SELECT session_id FROM desktop_pairings WHERE pairing_key = ?",
        pairingKey,
      )
      .toArray()[0];
    return row?.session_id ?? null;
  }

  unlink(pairingKey: string, sessionId: string): void {
    this.ctx.storage.sql.exec(
      "DELETE FROM desktop_pairings WHERE pairing_key = ? AND session_id = ?",
      pairingKey,
      sessionId,
    );
  }
}
