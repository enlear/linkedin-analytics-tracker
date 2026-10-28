import type { PGlite, Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES, sortCategories, type PostCategory } from "@/lib/post-categories";
import { asUser, createDatabase, createUser, migrationSql, type TestUser } from "./harness";

let db: PGlite;
let admin: TestUser;
let alice: TestUser;
let bob: TestUser;

function insertPost(tx: Transaction, employeeId: string, postUrl: string) {
  return tx.query(
    `insert into public.post_uploads
       (employee_id, file_name, post_url, post_date, impressions, reach,
        report_month, tracking_period_start, tracking_period_end, category_id)
     values ($1, 'post.xlsx', $2, '2026-05-02', 100, 80,
             '2026-05-01', '2026-04-20', '2026-05-19', 'direct-post')
     returning id`,
    [employeeId, postUrl],
  );
}

beforeAll(async () => {
  db = await createDatabase();
  admin = await createUser(db, "admin@example.com", true);
  alice = await createUser(db, "alice@example.com");
  bob = await createUser(db, "bob@example.com");
  for (const member of [alice, bob]) {
    await asUser(
      db,
      member,
      (tx) => tx.query("insert into public.employees (id, email) values ($1, $2)", [member.id, member.email]),
      { commit: true },
    );
  }
});

describe("migration", () => {
  it("can be run again without errors or duplicate seeds", async () => {
    await db.exec(migrationSql());
    const { rows } = await db.query<{ n: number }>("select count(*)::int n from public.post_categories");
    expect(rows[0].n).toBe(4);
  });

  it("seeds the same categories Settings offers to restore", async () => {
    const { rows } = await db.query(
      "select id, name, description, weight, active from public.post_categories",
    );
    expect(sortCategories(rows as PostCategory[])).toEqual(sortCategories(DEFAULT_CATEGORIES));
  });
});

describe("employees", () => {
  it("lets a member create only their own profile, under their own email", async () => {
    const carol = await createUser(db, "carol@example.com");
    await expect(
      asUser(db, carol, (tx) =>
        tx.query("insert into public.employees (id, email) values ($1, $2)", [alice.id, carol.email]),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asUser(db, carol, (tx) =>
        tx.query("insert into public.employees (id, email) values ($1, 'boss@example.com')", [carol.id]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("shows the whole team to every member", async () => {
    const { rows } = await asUser(db, alice, (tx) => tx.query("select id from public.employees"));
    expect(rows).toHaveLength(2);
  });
});

describe("post_uploads", () => {
  it("lets members add their own posts but not someone else's", async () => {
    const { rows } = await asUser(db, alice, (tx) => insertPost(tx, alice.id, "https://li/p/1"));
    expect(rows).toHaveLength(1);
    await expect(asUser(db, alice, (tx) => insertPost(tx, bob.id, "https://li/p/2"))).rejects.toThrow(
      /row-level security/,
    );
  });

  it("rejects a second accepted upload of the same post URL", async () => {
    await asUser(db, alice, (tx) => insertPost(tx, alice.id, "https://li/p/dup"), { commit: true });
    await expect(asUser(db, bob, (tx) => insertPost(tx, bob.id, "https://li/p/dup"))).rejects.toThrow(
      /post_uploads_accepted_url_key/,
    );
  });

  it("only lets the owner or an admin delete a post", async () => {
    const { rows } = await asUser(db, bob, (tx) => tx.query("delete from public.post_uploads returning id"));
    expect(rows).toHaveLength(0);
    const asAdmin = await asUser(db, admin, (tx) => tx.query("delete from public.post_uploads returning id"));
    expect(asAdmin.rows.length).toBeGreaterThan(0);
  });
});

describe("upload_activity", () => {
  it("keeps each member's history private to them and admins", async () => {
    await asUser(
      db,
      alice,
      (tx) =>
        tx.query(
          "insert into public.upload_activity (employee_id, action, file_name) values ($1, 'upload_rejected', 'x.xlsx')",
          [alice.id],
        ),
      { commit: true },
    );
    const bobSees = await asUser(db, bob, (tx) => tx.query("select id from public.upload_activity"));
    const adminSees = await asUser(db, admin, (tx) => tx.query("select id from public.upload_activity"));
    expect(bobSees.rows).toHaveLength(0);
    expect(adminSees.rows).toHaveLength(1);
  });
});

describe("post_categories", () => {
  it("is read-only for members", async () => {
    const { rows } = await asUser(db, alice, (tx) =>
      tx.query("update public.post_categories set weight = 9 returning id"),
    );
    expect(rows).toHaveLength(0);
  });
});

describe("company analytics", () => {
  const daily = [
    {
      date: "2026-05-01",
      impressions: 10,
      unique_impressions: 8,
      clicks: 1,
      reactions: 2,
      comments: 0,
      reposts: 0,
      engagement_rate: 0.3,
    },
  ];
  const posts = [
    {
      post_title: "Hello",
      impressions: 10,
      clicks: 1,
      click_through_rate: 0.1,
      likes: 2,
      comments: 0,
      reposts: 0,
      engagement_rate: 0.2,
    },
  ];

  function replace(tx: Transaction, path: string) {
    return tx.query<{ result: { id: string; replaced_storage_path: string | null } }>(
      "select public.replace_company_upload('linkedin', '2026-05-01', 'May 2026', 'may.xlsx', $1, $2, $3) as result",
      [path, JSON.stringify(daily), JSON.stringify(posts)],
    );
  }

  it("replaces a month atomically and reports the file it replaced", async () => {
    const counts = await asUser(db, admin, async (tx) => {
      const first = await replace(tx, "linkedin/a.xlsx");
      const second = await replace(tx, "linkedin/b.xlsx");
      const { rows } = await tx.query<{ uploads: number; metrics: number; posts: number }>(
        `select (select count(*)::int from public.company_analytics_uploads) uploads,
                (select count(*)::int from public.company_daily_metrics) metrics,
                (select count(*)::int from public.company_posts) posts`,
      );
      return {
        firstReplaced: first.rows[0].result.replaced_storage_path,
        secondReplaced: second.rows[0].result.replaced_storage_path,
        ...rows[0],
      };
    });
    expect(counts).toEqual({
      firstReplaced: null,
      secondReplaced: "linkedin/a.xlsx",
      uploads: 1,
      metrics: 1,
      posts: 1,
    });
  });

  it("is invisible and closed to members", async () => {
    await expect(asUser(db, alice, (tx) => replace(tx, "x"))).rejects.toThrow(/Only admins/);
    const { rows } = await asUser(db, alice, (tx) => tx.query("select id from public.company_analytics_uploads"));
    expect(rows).toHaveLength(0);
  });
});

describe("meta connection", () => {
  const save = (tx: Transaction, token: string | null) =>
    tx.query("select public.save_meta_connection('123', 'Page', $1, null, null)", [token]);

  it("stores the token without ever letting a browser read it back", async () => {
    await asUser(
      db,
      admin,
      async (tx) => {
        await save(tx, "secret-token");
        await save(tx, ""); // editing details keeps the stored token
      },
      { commit: true },
    );

    const token = await asUser(db, admin, (tx) =>
      tx.query<{ t: string }>("select public.meta_access_token() t"),
    );
    expect(token.rows[0].t).toBe("secret-token");

    await expect(
      asUser(db, admin, (tx) => tx.query("select page_access_token from public.meta_connection")),
    ).rejects.toThrow(/permission denied/);
    const details = await asUser(db, admin, (tx) => tx.query("select page_id from public.meta_connection"));
    expect(details.rows).toHaveLength(1);
  });

  it("gives members nothing", async () => {
    await expect(asUser(db, alice, (tx) => save(tx, "x"))).rejects.toThrow(/Only admins/);
    const token = await asUser(db, alice, (tx) => tx.query<{ t: string | null }>("select public.meta_access_token() t"));
    expect(token.rows[0].t).toBeNull();
  });
});

describe("delete_employee_account", () => {
  it("removes the member's sign-in and every row that belongs to them", async () => {
    const dave = await createUser(db, "dave@example.com");
    await asUser(
      db,
      dave,
      async (tx) => {
        await tx.query("insert into public.employees (id, email) values ($1, $2)", [dave.id, dave.email]);
        await insertPost(tx, dave.id, "https://li/p/dave");
      },
      { commit: true },
    );

    await asUser(db, admin, (tx) => tx.query("select public.delete_employee_account($1)", [dave.id]), {
      commit: true,
    });

    const { rows } = await db.query<{ users: number; employees: number; posts: number }>(
      `select (select count(*)::int from auth.users where id = $1) users,
              (select count(*)::int from public.employees where id = $1) employees,
              (select count(*)::int from public.post_uploads where employee_id = $1) posts`,
      [dave.id],
    );
    expect(rows[0]).toEqual({ users: 0, employees: 0, posts: 0 });
  });

  it("is admin-only", async () => {
    await expect(
      asUser(db, alice, (tx) => tx.query("select public.delete_employee_account($1)", [bob.id])),
    ).rejects.toThrow(/Only admins/);
  });
});

describe("make_admin", () => {
  it("can't be called from the app", async () => {
    await expect(
      asUser(db, alice, (tx) => tx.query("select public.make_admin($1)", [alice.email])),
    ).rejects.toThrow(/permission denied/);
  });

  it("promotes the user and drops their empty member profile", async () => {
    const erin = await createUser(db, "erin@example.com");
    await asUser(
      db,
      erin,
      (tx) => tx.query("insert into public.employees (id, email) values ($1, $2)", [erin.id, erin.email]),
      { commit: true },
    );

    await db.query("select public.make_admin('ERIN@example.com')");

    const { rows } = await db.query<{ role: string; profiles: number }>(
      `select raw_app_meta_data ->> 'role' role,
              (select count(*)::int from public.employees where id = $1) profiles
         from auth.users where id = $1`,
      [erin.id],
    );
    expect(rows[0]).toEqual({ role: "admin", profiles: 0 });
  });
});

describe("storage", () => {
  it("lets only admins touch company files", async () => {
    const insert = (tx: Transaction) =>
      tx.query("insert into storage.objects (bucket_id, name) values ('company-uploads', 'a.xlsx')");
    await expect(asUser(db, alice, insert)).rejects.toThrow(/row-level security/);
    await expect(asUser(db, admin, insert)).resolves.toBeDefined();
  });
});
