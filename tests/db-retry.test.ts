import { describe, expect, it } from "vitest";

import {
  isRetriableRead,
  isTransientConnectionError,
  statementText,
} from "@/db/retry";

describe("isTransientConnectionError", () => {
  it("mengenali WebSocket ErrorEvent tanpa message", () => {
    expect(
      isTransientConnectionError({ type: "error", timeStamp: 127102 }),
    ).toBe(true);
  });

  it("mengenali cause berantai dari Drizzle", () => {
    const error = new Error(
      'Failed query: select "content_submissions"."id" from "content_submissions"',
    );
    (error as Error & { cause?: unknown }).cause = new Error(
      "Connection terminated unexpectedly",
    );
    expect(isTransientConnectionError(error)).toBe(true);
  });

  it("mengabaikan galat SQL non-transien", () => {
    expect(
      isTransientConnectionError(
        new Error('column "nonexistent" does not exist'),
      ),
    ).toBe(false);
  });
});

describe("isRetriableRead", () => {
  it("mengizinkan SELECT dan CTE baca", () => {
    expect(isRetriableRead("select 1")).toBe(true);
    expect(isRetriableRead("  WITH x AS (select 1) select * from x")).toBe(
      true,
    );
  });

  it("menolak SELECT dengan row lock dan semua penulisan", () => {
    expect(isRetriableRead("select * from t for update")).toBe(false);
    expect(
      isRetriableRead(
        "with x as (insert into t values (1) returning *) select * from x",
      ),
    ).toBe(false);
    expect(isRetriableRead("insert into t values (1)")).toBe(false);
    expect(isRetriableRead("update t set a = 1")).toBe(false);
    expect(isRetriableRead("delete from t")).toBe(false);
  });
});

describe("statementText", () => {
  it("mendukung string dan objek query", () => {
    expect(statementText("select 1")).toBe("select 1");
    expect(statementText({ text: "select 2", values: [] })).toBe("select 2");
    expect(statementText(undefined)).toBe("");
  });
});
