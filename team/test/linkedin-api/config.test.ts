import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_LINKEDIN_API_VERSION,
  DEFAULT_LINKEDIN_SCOPES,
  linkedinApiEnabled,
  linkedinApiVersion,
  linkedinOAuthConfig,
} from "@/lib/linkedin-api/config";

beforeEach(() => {
  vi.stubEnv("LINKEDIN_CLIENT_ID", "client-id");
  vi.stubEnv("LINKEDIN_CLIENT_SECRET", "client-secret");
  vi.stubEnv("LINKEDIN_REDIRECT_URI", "");
  vi.stubEnv("LINKEDIN_SCOPES", "");
  vi.stubEnv("LINKEDIN_API_VERSION", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("linkedinApiEnabled", () => {
  it.each([
    ["true", true],
    ["TRUE", false],
    ["1", false],
    ["", false],
  ])("treats %j as %s", (value, expected) => {
    vi.stubEnv("LINKEDIN_API_ENABLED", value);
    expect(linkedinApiEnabled()).toBe(expected);
  });
});

describe("linkedinOAuthConfig", () => {
  it("defaults the redirect URI to this origin's callback path", () => {
    expect(linkedinOAuthConfig("https://team.example.com")).toEqual({
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "https://team.example.com/connect/linkedin/callback",
      scopes: DEFAULT_LINKEDIN_SCOPES,
    });
  });

  it("prefers LINKEDIN_REDIRECT_URI and LINKEDIN_SCOPES when set", () => {
    vi.stubEnv("LINKEDIN_REDIRECT_URI", "https://fixed.example.com/connect/linkedin/callback");
    vi.stubEnv("LINKEDIN_SCOPES", "openid r_member_postAnalytics");
    expect(linkedinOAuthConfig("http://localhost:3000")).toMatchObject({
      redirectUri: "https://fixed.example.com/connect/linkedin/callback",
      scopes: "openid r_member_postAnalytics",
    });
  });

  it("is null without client credentials or any way to build a redirect URI", () => {
    expect(linkedinOAuthConfig(null)).toBeNull();
    vi.stubEnv("LINKEDIN_CLIENT_SECRET", "");
    expect(linkedinOAuthConfig("https://team.example.com")).toBeNull();
  });
});

describe("linkedinApiVersion", () => {
  it("defaults, and follows LINKEDIN_API_VERSION when set", () => {
    expect(linkedinApiVersion()).toBe(DEFAULT_LINKEDIN_API_VERSION);
    vi.stubEnv("LINKEDIN_API_VERSION", "202610");
    expect(linkedinApiVersion()).toBe("202610");
  });
});
